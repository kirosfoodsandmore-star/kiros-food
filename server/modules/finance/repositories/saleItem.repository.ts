// Menu items offered when recording an offline sale, the items on each sale, and the best-sellers figures that put
// walk-in sales next to app orders. Money is kobo.
import { SqlParams } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { PAID } from "../../report/repositories/report.repository";
import { FinanceEntryItemEntity } from "../entities/financeEntryItem.entity";

export interface MenuItemOption {
  id: string;
  name: string;
  /** The menu's base price, kobo. */
  price: number;
  category: string;
  menu: string;
}

export interface EntryItemLine {
  entryId: string;
  itemId: string | null;
  name: string;
  categoryName: string | null;
  quantity: number;
  unitPrice: number;
}

export interface BestSellerRow {
  /** item id, or the lower-cased name for hand-typed / since-deleted items. */
  key: string;
  name: string;
  units: number;
  appUnits: number;
  walkInUnits: number;
  revenue: number;
}

export interface SoldScope {
  organizationId: string;
  branchIds: string[] | null;
  from: string;
  to: string;
  timezone: string;
}

export class SaleItemRepository {
  static Instance = new SaleItemRepository();
  private constructor() {}

  /** Active items on active menus. With a branch: only menus that branch serves. */
  async menuItems(organizationId: string, branchId: string | null): Promise<MenuItemOption[]> {
    const p = new SqlParams();
    const where = [`i.organization_id = ${p.add(organizationId)}`, `i.is_active AND i.deleted_at IS NULL`, `c.deleted_at IS NULL`, `m.is_active AND m.deleted_at IS NULL`];
    if (branchId) where.push(`EXISTS (SELECT 1 FROM branch_menus bm WHERE bm.menu_id = m.id AND bm.branch_id = ${p.add(branchId)})`);
    const rows: MenuItemOption[] = await db().query(
      `SELECT i.id, i.name, i.base_price AS price, c.name AS category, m.name AS menu
       FROM items i JOIN categories c ON c.id = i.category_id JOIN menus m ON m.id = c.menu_id
       WHERE ${where.join(" AND ")} ORDER BY m.sort_order, c.sort_order, i.sort_order, lower(i.name)`,
      p.values
    );
    return rows.map((r) => ({ ...r, price: Number(r.price) }));
  }

  /** The items asked for (this restaurant's, not deleted) with their category: names are taken from here, never from the client. */
  async findItems(organizationId: string, ids: string[], tx?: Tx): Promise<Array<{ id: string; name: string; category: string }>> {
    if (!ids.length) return [];
    return db(tx).query(
      `SELECT i.id, i.name, c.name AS category FROM items i JOIN categories c ON c.id = i.category_id
       WHERE i.organization_id = $1 AND i.deleted_at IS NULL AND i.id = ANY($2::uuid[])`,
      [organizationId, ids]
    );
  }

  async linesFor(entryIds: string[], tx?: Tx): Promise<EntryItemLine[]> {
    if (!entryIds.length) return [];
    const rows: EntryItemLine[] = await db(tx).query(
      `SELECT entry_id AS "entryId", item_id AS "itemId", item_name AS name, category_name AS "categoryName", quantity, unit_price AS "unitPrice"
       FROM finance_entry_items WHERE entry_id = ANY($1::uuid[]) ORDER BY sort_order, id`,
      [entryIds]
    );
    return rows.map((r) => ({ ...r, quantity: Number(r.quantity), unitPrice: Number(r.unitPrice) }));
  }

  async replaceLines(entryId: string, lines: Array<Omit<EntryItemLine, "entryId">>, tx: Tx): Promise<void> {
    await tx.query(`DELETE FROM finance_entry_items WHERE entry_id = $1`, [entryId]);
    await this.insertLines(lines.map((l, i) => ({ entryId, ...l, sortOrder: i })), tx);
  }

  async insertLines(rows: Array<Omit<EntryItemLine, never> & { sortOrder: number }>, tx: Tx): Promise<void> {
    const repo = tx.getRepository(FinanceEntryItemEntity);
    for (let i = 0; i < rows.length; i += 500) {
      await repo.insert(rows.slice(i, i + 500).map((r) => ({ entryId: r.entryId, itemId: r.itemId, itemName: r.name, categoryName: r.categoryName, quantity: r.quantity, unitPrice: r.unitPrice, sortOrder: r.sortOrder })));
    }
  }

  /** Best sellers over a range: paid app orders and offline sales together, by units sold. */
  async bestSellers(s: SoldScope, limit = 8): Promise<BestSellerRow[]> {
    const p = new SqlParams();
    const org = p.add(s.organizationId);
    const tz = p.add(s.timezone);
    const from = p.add(s.from);
    const to = p.add(s.to);
    const branch = s.branchIds ? p.add(s.branchIds) : null;
    const orderWhere = [`o.organization_id = ${org}`, PAID, `o.created_at >= (CAST(${from} AS date)::timestamp AT TIME ZONE ${tz})`, `o.created_at < ((CAST(${to} AS date) + 1)::timestamp AT TIME ZONE ${tz})`];
    if (branch) orderWhere.push(`o.branch_id = ANY(${branch}::uuid[])`);
    const saleWhere = [`e.organization_id = ${org}`, `e.deleted_at IS NULL`, `e.kind = 'income'`, `e.entry_date BETWEEN ${from}::date AND ${to}::date`];
    if (branch) saleWhere.push(`e.branch_id = ANY(${branch}::uuid[])`);
    const rows: Array<{ key: string; name: string; units: number; appUnits: number; walkInUnits: number; revenue: number }> = await db().query(
      `WITH sold AS (
         SELECT COALESCE(l.item_id::text, lower(l.item_name)) AS key, l.item_name AS name, l.quantity AS qty, l.line_total AS revenue, 'app' AS source
           FROM order_lines l JOIN orders o ON o.id = l.order_id WHERE ${orderWhere.join(" AND ")}
         UNION ALL
         SELECT COALESCE(i.item_id::text, lower(i.item_name)), i.item_name, i.quantity, i.quantity::bigint * i.unit_price, 'walkin'
           FROM finance_entry_items i JOIN finance_entries e ON e.id = i.entry_id WHERE ${saleWhere.join(" AND ")}
       )
       SELECT key, MIN(name) AS name, SUM(qty)::int AS units,
              COALESCE(SUM(qty) FILTER (WHERE source = 'app'), 0)::int AS "appUnits",
              COALESCE(SUM(qty) FILTER (WHERE source = 'walkin'), 0)::int AS "walkInUnits",
              SUM(revenue) AS revenue
       FROM sold GROUP BY key ORDER BY units DESC, revenue DESC LIMIT ${p.add(limit)}`,
      p.values
    );
    return rows.map((r) => ({ ...r, revenue: Number(r.revenue) }));
  }
}
