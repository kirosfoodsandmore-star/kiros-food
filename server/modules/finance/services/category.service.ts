// Each restaurant's finance categories: seeded with the built-in ones, then added to, renamed, regrouped and hidden by
// the owner (finance.manage). Everything else in finance reads the list through catalog(), which caches it briefly.
import { assertPermission, can } from "../../../shared/access/can";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import { CATEGORY_KEY_PATTERN, type ExpenseGroup, type FinanceKind } from "../catalog/finance.catalog";
import { Catalog, type CategoryInfo } from "../domain/catalog";
import type { FinanceCategoryRow } from "../entities/financeCategory.entity";
import { CategoryRepository, type CategoryUsage } from "../repositories/category.repository";
import type { CategoryBody, UpdateCategoryBody } from "../validators/finance.schema";

/** How long a restaurant's list is reused before it's read again. Changes made here refresh it straight away. */
const CACHE_MS = 30_000;

export interface CategoryDTO extends CategoryInfo {
  /** Entries filed under it (finance.view only). */
  entries?: number;
  /** Monthly budgets set on it (finance.view only). */
  budgets?: number;
}

const toInfo = (r: FinanceCategoryRow): CategoryInfo => ({ id: r.id, key: r.key, label: r.label, kind: r.kind, group: r.expenseGroup, isSale: r.isSale, isBuiltin: r.isBuiltin, isActive: r.isActive, sortOrder: r.sortOrder });

/** A short code from a name: "Generator servicing" → generator_servicing. */
export function slugKey(label: string, taken: ReadonlySet<string>): string {
  const base = label.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "category";
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base.slice(0, 27 - String(n).length)}_${n}`;
  return CATEGORY_KEY_PATTERN.test(key) ? key : `category_${taken.size + 1}`;
}

export class CategoryService {
  static Instance = new CategoryService();
  private readonly cache = new Map<string, { at: number; catalog: Catalog }>();
  private constructor(
    private readonly repo = CategoryRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  private invalidate(organizationId: string): void {
    this.cache.delete(organizationId);
  }

  /** The restaurant's categories, giving a new restaurant its built-in ones on first use. */
  async catalog(organizationId: string): Promise<Catalog> {
    const hit = this.cache.get(organizationId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.catalog;
    let rows = await this.repo.list(organizationId);
    if (rows.length === 0) {
      await this.repo.seedDefaults(organizationId);
      rows = await this.repo.list(organizationId);
    }
    const catalog = new Catalog(rows.map(toInfo));
    this.cache.set(organizationId, { at: Date.now(), catalog });
    return catalog;
  }

  /**
   * For the screens. Sales-only staff get just the active income categories (what a sale can be filed under); everyone
   * else gets the whole list, hidden ones included (so old entries still show their category), with usage for finance.view.
   */
  async list(actor: Actor): Promise<CategoryDTO[]> {
    const catalog = await this.catalog(actor.organizationId);
    if (!can(actor, "finance.view")) {
      assertPermission(actor, "finance.record_sales");
      return catalog.active().filter((c) => c.kind === "income");
    }
    const usage = await this.repo.usage(actor.organizationId);
    const none: CategoryUsage = { entries: 0, budgets: 0 };
    return catalog.all.map((c) => ({ ...c, entries: (usage.get(c.key) ?? none).entries, budgets: (usage.get(c.key) ?? none).budgets }));
  }

  private assertLabelFree(catalog: Catalog, kind: FinanceKind, label: string, exceptId?: string): void {
    const clash = catalog.all.find((c) => c.id !== exceptId && c.kind === kind && c.label.trim().toLowerCase() === label.trim().toLowerCase());
    if (clash) throw AppError.conflict(`"${clash.label}" already exists${clash.isActive ? "" : " (hidden: show it again instead)"}`);
  }

  async create(actor: Actor, b: CategoryBody): Promise<CategoryDTO> {
    assertPermission(actor, "finance.manage");
    const catalog = await this.catalog(actor.organizationId);
    const label = b.label.trim();
    this.assertLabelFree(catalog, b.kind, label);
    const group: ExpenseGroup | null = b.kind === "expense" ? (b.group ?? null) : null;
    if (b.kind === "expense" && !group) throw AppError.badRequest("Choose where this expense belongs: cost of sales, running costs or assets");
    if (b.isSale && b.kind !== "income") throw AppError.badRequest("Only other-income categories can count as sales");
    const key = slugKey(label, new Set(catalog.all.map((c) => c.key)));
    const created = await this.repo.create({
      organizationId: actor.organizationId,
      key,
      label,
      kind: b.kind,
      expenseGroup: group,
      isSale: Boolean(b.isSale),
      isBuiltin: false,
      isActive: true,
      sortOrder: await this.repo.nextSortOrder(actor.organizationId),
    });
    this.invalidate(actor.organizationId);
    await this.audit.log(actor, { action: "create", entityType: "finance_category", entityId: created.id, summary: `Added finance category "${label}" (${b.kind}${group ? `, ${group}` : ""}${b.isSale ? ", counts as a sale" : ""})` });
    return toInfo(created);
  }

  async update(actor: Actor, id: string, b: UpdateCategoryBody): Promise<CategoryDTO> {
    assertPermission(actor, "finance.manage");
    const catalog = await this.catalog(actor.organizationId);
    const cat = catalog.all.find((c) => c.id === id);
    if (!cat) throw AppError.notFound("Category not found");
    const patch: { label?: string; expenseGroup?: ExpenseGroup | null; isSale?: boolean; isActive?: boolean } = {};
    if (b.label !== undefined && b.label.trim() !== cat.label) {
      this.assertLabelFree(catalog, cat.kind, b.label, id);
      patch.label = b.label.trim();
    }
    if (b.group !== undefined && b.group !== cat.group) {
      if (cat.kind !== "expense") throw AppError.badRequest("Only expenses belong to a group");
      if (!b.group) throw AppError.badRequest("Choose a group");
      patch.expenseGroup = b.group;
    }
    if (b.isSale !== undefined && b.isSale !== cat.isSale) {
      if (cat.kind !== "income") throw AppError.badRequest("Only other-income categories can count as sales");
      patch.isSale = b.isSale;
    }
    if (b.isActive !== undefined && b.isActive !== cat.isActive) patch.isActive = b.isActive;
    if (Object.keys(patch).length === 0) return cat;
    await this.repo.update(actor.organizationId, id, patch);
    this.invalidate(actor.organizationId);
    const bits = [patch.label !== undefined ? `renamed "${cat.label}" to "${patch.label}"` : null, patch.expenseGroup ? `moved to ${patch.expenseGroup}` : null, patch.isSale !== undefined ? (patch.isSale ? "now counts as a sale" : "no longer counts as a sale") : null, patch.isActive !== undefined ? (patch.isActive ? "shown again" : "hidden") : null].filter(Boolean);
    await this.audit.log(actor, { action: "update", entityType: "finance_category", entityId: id, summary: `Finance category "${cat.label}": ${bits.join(", ")}`, before: cat as unknown as Record<string, unknown>, after: patch });
    return (await this.catalog(actor.organizationId)).all.find((c) => c.id === id)!;
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "finance.manage");
    const catalog = await this.catalog(actor.organizationId);
    const cat = catalog.all.find((c) => c.id === id);
    if (!cat) throw AppError.notFound("Category not found");
    if (cat.isBuiltin) throw AppError.conflict(`"${cat.label}" came with the app: hide it instead of deleting it`);
    const used = (await this.repo.usage(actor.organizationId)).get(cat.key);
    if (used && (used.entries > 0 || used.budgets > 0)) throw AppError.conflict(`"${cat.label}" is used by ${used.entries} entr${used.entries === 1 ? "y" : "ies"}${used.budgets ? " and a budget" : ""}: hide it instead of deleting it`);
    await this.repo.remove(actor.organizationId, id);
    this.invalidate(actor.organizationId);
    await this.audit.log(actor, { action: "delete", entityType: "finance_category", entityId: id, summary: `Deleted finance category "${cat.label}"` });
  }
}
