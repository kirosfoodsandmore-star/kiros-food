// The business's own books: capital, expenses, off-app income and money taken out, plus monthly budgets.
// Owner-only by default (finance.view / finance.manage). Branch scope applies: someone limited to some branches only
// sees entries filed against those branches, never the business-wide ones.
import { assertPermission } from "../../../shared/access/can";
import { assertBranchAccess, branchScope } from "../../../shared/access/scope";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { AppError } from "../../../shared/errors/AppError";
import { FileResult } from "../../../shared/http/handler";
import type { Actor } from "../../../shared/types/actor";
import { toCsv } from "../../../shared/utils/csv";
import { todayIn } from "../../../shared/utils/dates";
import { AuditService } from "../../audit/services/audit.service";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { categoryLabel, categoryOf, EXPENSE_GROUP_LABELS, FINANCE_CATEGORIES, FINANCE_KIND_LABELS, FINANCE_PAYMENT_METHODS } from "../catalog/finance.catalog";
import type { FinanceEntry } from "../entities/financeEntry.entity";
import { FinanceRepository, type NewEntry } from "../repositories/finance.repository";
import type { BudgetRow, EntryBody, ListEntriesQuery, UpdateEntryBody } from "../validators/finance.schema";

export type FinanceEntryDTO = Omit<FinanceEntry, "organizationId" | "deletedAt" | "organization">;

export function toEntryDTO(e: FinanceEntry): FinanceEntryDTO {
  const { organizationId: _o, deletedAt: _d, organization: _r, ...rest } = e;
  return rest;
}

export class FinanceService {
  static Instance = new FinanceService();
  private constructor(
    private readonly repo = FinanceRepository.Instance,
    private readonly organizations = OrganizationRepository.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  categories() {
    return {
      kinds: Object.entries(FINANCE_KIND_LABELS).map(([key, label]) => ({ key, label })),
      groups: Object.entries(EXPENSE_GROUP_LABELS).map(([key, label]) => ({ key, label })),
      paymentMethods: FINANCE_PAYMENT_METHODS,
      categories: FINANCE_CATEGORIES,
    };
  }

  async list(actor: Actor, q: ListEntriesQuery) {
    const scope = branchScope(actor, q.branchId);
    if (q.format === "csv") {
      assertPermission(actor, "reports.export");
      const all = await this.repo.list(actor.organizationId, scope, { ...q, page: 1, limit: 20_000 });
      const csv = toCsv<FinanceEntry>(all.data, [
        { header: "Date", value: (e) => e.entryDate },
        { header: "Kind", value: (e) => FINANCE_KIND_LABELS[e.kind] },
        { header: "Category", value: (e) => categoryLabel(e.category) },
        { header: "Title", value: (e) => e.title },
        { header: "Amount (kobo)", value: (e) => e.amount },
        { header: "Branch id", value: (e) => e.branchId ?? "" },
        { header: "Paid by", value: (e) => e.paymentMethod ?? "" },
        { header: "Vendor / party", value: (e) => e.party ?? "" },
        { header: "Reference", value: (e) => e.reference ?? "" },
        { header: "Notes", value: (e) => e.notes ?? "" },
        { header: "Recorded by", value: (e) => e.createdByName ?? "" },
      ]);
      return new FileResult(`finance-${q.kind ?? "all"}-${q.from ?? "start"}-to-${q.to ?? "today"}.csv`, "text/csv; charset=utf-8", csv);
    }
    const page = await this.repo.list(actor.organizationId, scope, q);
    return { data: page.data.map(toEntryDTO), meta: page.meta, sum: page.sum };
  }

  private async assertDate(actor: Actor, date: string): Promise<void> {
    const org = await this.organizations.findById(actor.organizationId);
    if (date > todayIn(org?.timezone ?? "Africa/Lagos")) throw AppError.badRequest("Entries can't be dated in the future");
  }

  private toNew(actor: Actor, b: EntryBody): NewEntry {
    if (b.branchId) assertBranchAccess(actor, b.branchId);
    else if (branchScope(actor) !== null) throw AppError.forbidden("Only someone who works across every branch can record business-wide entries; choose a branch");
    return {
      organizationId: actor.organizationId,
      branchId: b.branchId ?? null,
      kind: b.kind,
      category: b.category,
      title: b.title,
      amount: b.amount,
      entryDate: b.entryDate,
      paymentMethod: b.paymentMethod ?? null,
      party: b.party ?? null,
      reference: b.reference ?? null,
      notes: b.notes ?? null,
      createdBy: actor.id,
      createdByName: actor.name,
    };
  }

  async create(actor: Actor, b: EntryBody): Promise<FinanceEntryDTO> {
    assertPermission(actor, "finance.manage");
    await this.assertDate(actor, b.entryDate);
    const entry = await inTransaction(async (tx) => {
      const saved = await this.repo.create(this.toNew(actor, b), tx);
      await this.audit.log(actor, { action: "create", entityType: "finance_entry", entityId: saved.id, branchId: saved.branchId, summary: `Recorded ${FINANCE_KIND_LABELS[saved.kind].toLowerCase()} "${saved.title}" (${categoryLabel(saved.category)}, ${saved.amount} kobo, ${saved.entryDate})`, after: b }, tx);
      return saved;
    });
    return toEntryDTO(entry);
  }

  async importMany(actor: Actor, rows: EntryBody[]): Promise<{ imported: number }> {
    assertPermission(actor, "finance.manage");
    const latest = rows.reduce((m, r) => (r.entryDate > m ? r.entryDate : m), "0000-00-00");
    await this.assertDate(actor, latest);
    const entries = rows.map((r) => this.toNew(actor, r));
    const total = entries.reduce((s, e) => s + e.amount, 0);
    const imported = await inTransaction(async (tx) => {
      const n = await this.repo.createMany(entries, tx);
      await this.audit.log(actor, { action: "import", entityType: "finance_entry", summary: `Imported ${n} finance entries (${total} kobo in total)` }, tx);
      return n;
    });
    return { imported };
  }

  async update(actor: Actor, id: string, b: UpdateEntryBody): Promise<FinanceEntryDTO> {
    assertPermission(actor, "finance.manage");
    const entry = await this.repo.findById(actor.organizationId, id);
    if (!entry) throw AppError.notFound("Entry not found");
    if (entry.branchId) assertBranchAccess(actor, entry.branchId);
    else if (branchScope(actor) !== null) throw AppError.forbidden("This is a business-wide entry");
    const kind = b.kind ?? entry.kind;
    const category = b.category ?? entry.category;
    if (categoryOf(category)?.kind !== kind) throw AppError.badRequest("That category does not belong to this kind of entry");
    if (b.branchId) assertBranchAccess(actor, b.branchId);
    if (b.entryDate) await this.assertDate(actor, b.entryDate);
    await this.repo.update(actor.organizationId, id, { ...b, kind, category });
    await this.audit.log(actor, { action: "update", entityType: "finance_entry", entityId: id, branchId: entry.branchId, summary: `Edited finance entry "${entry.title}"`, before: entry as unknown as Record<string, unknown>, after: b });
    return toEntryDTO((await this.repo.findById(actor.organizationId, id))!);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    assertPermission(actor, "finance.manage");
    const entry = await this.repo.findById(actor.organizationId, id);
    if (!entry) throw AppError.notFound("Entry not found");
    if (entry.branchId) assertBranchAccess(actor, entry.branchId);
    else if (branchScope(actor) !== null) throw AppError.forbidden("This is a business-wide entry");
    await this.repo.softDelete(actor.organizationId, id);
    await this.audit.log(actor, { action: "delete", entityType: "finance_entry", entityId: id, branchId: entry.branchId, summary: `Deleted finance entry "${entry.title}" (${entry.amount} kobo, ${entry.entryDate})`, before: entry as unknown as Record<string, unknown> });
  }

  async budgets(actor: Actor) {
    const rows = await this.repo.budgets(actor.organizationId);
    return rows.map((b) => ({ category: b.category, monthlyAmount: b.monthlyAmount }));
  }

  async setBudgets(actor: Actor, rows: BudgetRow[]) {
    assertPermission(actor, "finance.manage");
    await inTransaction(async (tx) => {
      await this.repo.replaceBudgets(actor.organizationId, rows, tx);
      await this.audit.log(actor, { action: "update", entityType: "finance_budget", summary: `Updated monthly budgets (${rows.filter((r) => r.monthlyAmount > 0).length} categories)`, after: Object.fromEntries(rows.map((r) => [r.category, r.monthlyAmount])) }, tx);
    });
    return this.budgets(actor);
  }
}
