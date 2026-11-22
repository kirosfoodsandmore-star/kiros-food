// Counter sales (walk-in and catering: finance entries of kind income in the sales categories) shaped like the online
// numbers in report.repository.ts, so the Sales reports page can show both together. Money is kobo.
import { SqlParams } from "../../../infrastructure/database/sql";
import { db } from "../../../infrastructure/database/transaction";

export interface CounterScope {
  organizationId: string;
  /** null = every branch (and entries filed for the whole business). */
  branchIds: string[] | null;
  from: string;
  to: string;
}

export interface CounterRow {
  key: string;
  label: string;
  /** Sales (finance entries) in the group. */
  sales: number;
  /** Units, counted only where the sale listed its items. */
  items: number;
  revenue: number;
}

export interface CounterTotals {
  sales: number;
  items: number;
  revenue: number;
}

/** Group key for sales that didn't list their items (they have an amount but no products to attribute it to). */
export const UNLISTED_KEY = "unlisted";
export const UNLISTED_LABEL = "Sales without items listed";

export class CounterSalesRepository {
  static Instance = new CounterSalesRepository();
  private constructor() {}

  /** WITH-clause body: the entries in scope. Binds its values on `p`. */
  private entries(p: SqlParams, s: CounterScope): string {
    const where = [
      `e.organization_id = ${p.add(s.organizationId)}`,
      `e.deleted_at IS NULL`,
      `e.kind = 'income'`,
      // Income categories this restaurant marks as sales (walk-in and catering unless the owner changed it).
      `e.category IN (SELECT c.key FROM finance_categories c WHERE c.organization_id = e.organization_id AND c.is_sale)`,
      `e.entry_date BETWEEN ${p.add(s.from)}::date AND ${p.add(s.to)}::date`,
    ];
    if (s.branchIds) where.push(`e.branch_id = ANY(${p.add(s.branchIds)}::uuid[])`);
    return `SELECT e.id, e.entry_date, e.branch_id, e.amount FROM finance_entries e WHERE ${where.join(" AND ")}`;
  }

  private map(rows: Array<{ key: string; label: string; sales: number; items: number; revenue: number }>): CounterRow[] {
    return rows.map((r) => ({ key: r.key, label: r.label, sales: Number(r.sales), items: Number(r.items), revenue: Number(r.revenue) }));
  }

  async totals(s: CounterScope): Promise<CounterTotals> {
    const p = new SqlParams();
    const rows = await db().query(
      `WITH ent AS (${this.entries(p, s)})
       SELECT COUNT(*)::int AS sales, COALESCE(SUM(ent.amount), 0) AS revenue,
              COALESCE((SELECT SUM(i.quantity) FROM finance_entry_items i JOIN ent e2 ON e2.id = i.entry_id), 0)::int AS items
       FROM ent`,
      p.values
    );
    return { sales: Number(rows[0].sales), items: Number(rows[0].items), revenue: Number(rows[0].revenue) };
  }

  async byDay(s: CounterScope): Promise<CounterRow[]> {
    const p = new SqlParams();
    return this.map(
      await db().query(
        `WITH ent AS (${this.entries(p, s)}),
         itm AS (SELECT i.entry_id, SUM(i.quantity) AS q FROM finance_entry_items i JOIN ent ON ent.id = i.entry_id GROUP BY i.entry_id)
         SELECT ent.entry_date::text AS key, ent.entry_date::text AS label, COUNT(*)::int AS sales, COALESCE(SUM(itm.q), 0)::int AS items, SUM(ent.amount) AS revenue
         FROM ent LEFT JOIN itm ON itm.entry_id = ent.id GROUP BY 1 ORDER BY 1`,
        p.values
      )
    );
  }

  async byBranch(s: CounterScope): Promise<CounterRow[]> {
    const p = new SqlParams();
    return this.map(
      await db().query(
        `WITH ent AS (${this.entries(p, s)}),
         itm AS (SELECT i.entry_id, SUM(i.quantity) AS q FROM finance_entry_items i JOIN ent ON ent.id = i.entry_id GROUP BY i.entry_id)
         SELECT COALESCE(b.id::text, 'business') AS key, COALESCE(b.name, 'Whole business') AS label, COUNT(*)::int AS sales, COALESCE(SUM(itm.q), 0)::int AS items, SUM(ent.amount) AS revenue
         FROM ent LEFT JOIN itm ON itm.entry_id = ent.id LEFT JOIN branches b ON b.id = ent.branch_id GROUP BY b.id, b.name`,
        p.values
      )
    );
  }

  /** Sales that listed no items: they count in the totals but belong to no product or menu. */
  private async unlisted(s: CounterScope): Promise<CounterRow[]> {
    const p = new SqlParams();
    const rows = await db().query(
      `WITH ent AS (${this.entries(p, s)})
       SELECT '${UNLISTED_KEY}' AS key, '${UNLISTED_LABEL}' AS label, COUNT(*)::int AS sales, 0 AS items, SUM(ent.amount) AS revenue
       FROM ent WHERE NOT EXISTS (SELECT 1 FROM finance_entry_items i WHERE i.entry_id = ent.id) HAVING COUNT(*) > 0`,
      p.values
    );
    return this.map(rows);
  }

  async byMenu(s: CounterScope): Promise<CounterRow[]> {
    const p = new SqlParams();
    const listed = this.map(
      await db().query(
        `WITH ent AS (${this.entries(p, s)})
         SELECT COALESCE(m.id::text, 'none') AS key, COALESCE(m.name, 'No menu') AS label, COUNT(DISTINCT i.entry_id)::int AS sales, SUM(i.quantity)::int AS items, SUM(i.quantity::bigint * i.unit_price) AS revenue
         FROM finance_entry_items i JOIN ent ON ent.id = i.entry_id
         LEFT JOIN items it ON it.id = i.item_id LEFT JOIN categories c ON c.id = it.category_id LEFT JOIN menus m ON m.id = c.menu_id
         GROUP BY m.id, m.name`,
        p.values
      )
    );
    return [...listed, ...(await this.unlisted(s))];
  }

  async byItem(s: CounterScope, limit = 100): Promise<CounterRow[]> {
    const p = new SqlParams();
    const listed = this.map(
      await db().query(
        `WITH ent AS (${this.entries(p, s)})
         SELECT COALESCE(i.item_id::text, i.item_name) AS key, MIN(i.item_name) AS label, COUNT(DISTINCT i.entry_id)::int AS sales, SUM(i.quantity)::int AS items, SUM(i.quantity::bigint * i.unit_price) AS revenue
         FROM finance_entry_items i JOIN ent ON ent.id = i.entry_id GROUP BY 1 ORDER BY items DESC LIMIT ${p.add(limit)}`,
        p.values
      )
    );
    return [...listed, ...(await this.unlisted(s))];
  }
}
