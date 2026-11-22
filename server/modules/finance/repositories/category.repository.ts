import { db, type Tx } from "../../../infrastructure/database/transaction";
import { DEFAULT_FINANCE_CATEGORIES } from "../catalog/finance.catalog";
import { FinanceCategoryEntity, type FinanceCategoryRow } from "../entities/financeCategory.entity";

export interface CategoryUsage {
  /** Entries filed under the category (deleted ones included: they still point at it). */
  entries: number;
  budgets: number;
}

export class CategoryRepository {
  static Instance = new CategoryRepository();
  private constructor() {}

  list(organizationId: string, tx?: Tx): Promise<FinanceCategoryRow[]> {
    return db(tx).getRepository(FinanceCategoryEntity).find({ where: { organizationId }, order: { sortOrder: "ASC", label: "ASC" } });
  }

  findById(organizationId: string, id: string, tx?: Tx): Promise<FinanceCategoryRow | null> {
    return db(tx).getRepository(FinanceCategoryEntity).findOne({ where: { organizationId, id } });
  }

  /** Gives a restaurant the built-in categories if it has none yet. Safe to call concurrently. */
  async seedDefaults(organizationId: string): Promise<void> {
    const values: unknown[] = [organizationId];
    const rows = DEFAULT_FINANCE_CATEGORIES.map((c, i) => {
      const base = values.length;
      values.push(c.key, c.label, c.kind, c.group ?? null, c.isSale ?? false, i + 1);
      return `($1, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, true, true, $${base + 6})`;
    });
    await db().query(
      `INSERT INTO finance_categories (organization_id, key, label, kind, expense_group, is_sale, is_builtin, is_active, sort_order)
       VALUES ${rows.join(", ")} ON CONFLICT (organization_id, key) DO NOTHING`,
      values
    );
  }

  async create(data: Omit<FinanceCategoryRow, "id" | "createdAt" | "updatedAt">, tx?: Tx): Promise<FinanceCategoryRow> {
    const repo = db(tx).getRepository(FinanceCategoryEntity);
    return repo.save(repo.create(data));
  }

  async update(organizationId: string, id: string, data: Partial<Pick<FinanceCategoryRow, "label" | "expenseGroup" | "isSale" | "isActive">>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(FinanceCategoryEntity).update({ organizationId, id }, data);
  }

  async remove(organizationId: string, id: string, tx?: Tx): Promise<void> {
    await db(tx).getRepository(FinanceCategoryEntity).delete({ organizationId, id });
  }

  async nextSortOrder(organizationId: string, tx?: Tx): Promise<number> {
    const rows: Array<{ n: number | null }> = await db(tx).query(`SELECT MAX(sort_order) AS n FROM finance_categories WHERE organization_id = $1`, [organizationId]);
    return Number(rows[0]?.n ?? 0) + 1;
  }

  /** How many entries and budgets point at each category key. */
  async usage(organizationId: string): Promise<Map<string, CategoryUsage>> {
    const [entries, budgets]: [Array<{ category: string; n: number }>, Array<{ category: string; n: number }>] = await Promise.all([
      db().query(`SELECT category, COUNT(*)::int AS n FROM finance_entries WHERE organization_id = $1 GROUP BY category`, [organizationId]),
      db().query(`SELECT category, COUNT(*)::int AS n FROM finance_budgets WHERE organization_id = $1 GROUP BY category`, [organizationId]),
    ]);
    const out = new Map<string, CategoryUsage>();
    for (const r of entries) out.set(r.category, { entries: Number(r.n), budgets: 0 });
    for (const r of budgets) out.set(r.category, { entries: out.get(r.category)?.entries ?? 0, budgets: Number(r.n) });
    return out;
  }
}
