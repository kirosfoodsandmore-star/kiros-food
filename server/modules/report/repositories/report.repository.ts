import { tzDateBetween, tzLocalDate } from "../../../infrastructure/database/sql";
import { db } from "../../../infrastructure/database/transaction";

export interface SalesScope {
  organizationId: string;
  branchIds: string[] | null;
  from: string;
  to: string;
  timezone: string;
}

export interface SalesRow {
  key: string;
  label: string;
  orders: number;
  items: number;
  subtotal: number;
  deliveryFees: number;
  discounts: number;
  revenue: number;
}

export interface SalesTotals {
  orders: number;
  revenue: number;
  averageOrderValue: number;
  items: number;
  deliveryOrders: number;
  pickupOrders: number;
}

/** Completed-or-active paid orders count as sales; cancelled and refunded never do. */
const PAID = `o.status IN ('paid','accepted','preparing','ready','out_for_delivery','completed')`;

export class ReportRepository {
  static Instance = new ReportRepository();
  private constructor() {}

  private scopeSql(s: SalesScope, params: unknown[]): string {
    params.push(s.organizationId, s.from, s.to, s.timezone);
    const where = [`o.organization_id = $1`, PAID, tzDateBetween("o.created_at", "$2", "$3", "$4")];
    if (s.branchIds) {
      params.push(s.branchIds);
      where.push(`o.branch_id = ANY($${params.length}::uuid[])`);
    }
    return where.join(" AND ");
  }

  async totals(s: SalesScope): Promise<SalesTotals> {
    const params: unknown[] = [];
    const where = this.scopeSql(s, params);
    const rows = await db().query(
      `SELECT COUNT(*)::int AS orders, COALESCE(SUM(o.total),0) AS revenue,
              COALESCE((SELECT SUM(l.quantity) FROM order_lines l JOIN orders o2 ON o2.id = l.order_id WHERE o2.id = ANY(ARRAY(SELECT o3.id FROM orders o3 WHERE ${where.replace(/\bo\./g, "o3.")}))),0)::int AS items,
              COUNT(*) FILTER (WHERE o.fulfilment = 'delivery')::int AS "deliveryOrders",
              COUNT(*) FILTER (WHERE o.fulfilment = 'pickup')::int AS "pickupOrders"
       FROM orders o WHERE ${where}`,
      params
    );
    const r = rows[0];
    const orders = Number(r.orders);
    return { orders, revenue: Number(r.revenue), averageOrderValue: orders > 0 ? Math.round(Number(r.revenue) / orders) : 0, items: Number(r.items), deliveryOrders: Number(r.deliveryOrders), pickupOrders: Number(r.pickupOrders) };
  }

  async byDay(s: SalesScope): Promise<SalesRow[]> {
    const params: unknown[] = [];
    const where = this.scopeSql(s, params);
    const day = tzLocalDate("o.created_at", "$4");
    return db().query(
      `SELECT ${day}::text AS key, ${day}::text AS label, COUNT(*)::int AS orders,
              COALESCE((SELECT SUM(l.quantity) FROM order_lines l WHERE l.order_id = ANY(array_agg(o.id))),0)::int AS items,
              COALESCE(SUM(o.subtotal),0) AS subtotal, COALESCE(SUM(o.delivery_fee),0) AS "deliveryFees", COALESCE(SUM(o.discount),0) AS discounts, COALESCE(SUM(o.total),0) AS revenue
       FROM orders o WHERE ${where} GROUP BY 1 ORDER BY 1`,
      params
    );
  }

  async byBranch(s: SalesScope): Promise<SalesRow[]> {
    const params: unknown[] = [];
    const where = this.scopeSql(s, params);
    return db().query(
      `SELECT b.id::text AS key, b.name AS label, COUNT(*)::int AS orders,
              COALESCE((SELECT SUM(l.quantity) FROM order_lines l WHERE l.order_id = ANY(array_agg(o.id))),0)::int AS items,
              COALESCE(SUM(o.subtotal),0) AS subtotal, COALESCE(SUM(o.delivery_fee),0) AS "deliveryFees", COALESCE(SUM(o.discount),0) AS discounts, COALESCE(SUM(o.total),0) AS revenue
       FROM orders o JOIN branches b ON b.id = o.branch_id WHERE ${where} GROUP BY b.id, b.name ORDER BY revenue DESC`,
      params
    );
  }

  async byMenu(s: SalesScope): Promise<SalesRow[]> {
    const params: unknown[] = [];
    const where = this.scopeSql(s, params);
    return db().query(
      `SELECT COALESCE(m.id::text, 'none') AS key, COALESCE(m.name, 'No menu') AS label, COUNT(*)::int AS orders,
              COALESCE((SELECT SUM(l.quantity) FROM order_lines l WHERE l.order_id = ANY(array_agg(o.id))),0)::int AS items,
              COALESCE(SUM(o.subtotal),0) AS subtotal, COALESCE(SUM(o.delivery_fee),0) AS "deliveryFees", COALESCE(SUM(o.discount),0) AS discounts, COALESCE(SUM(o.total),0) AS revenue
       FROM orders o LEFT JOIN menus m ON m.id = o.menu_id WHERE ${where} GROUP BY m.id, m.name ORDER BY revenue DESC`,
      params
    );
  }

  async byItem(s: SalesScope, limit = 100): Promise<SalesRow[]> {
    const params: unknown[] = [];
    const where = this.scopeSql(s, params);
    params.push(limit);
    return db().query(
      `SELECT COALESCE(l.item_id::text, l.item_name) AS key, l.item_name AS label, COUNT(DISTINCT o.id)::int AS orders, SUM(l.quantity)::int AS items,
              SUM(l.line_total) AS subtotal, 0 AS "deliveryFees", 0 AS discounts, SUM(l.line_total) AS revenue
       FROM order_lines l JOIN orders o ON o.id = l.order_id WHERE ${where} GROUP BY 1, 2 ORDER BY items DESC LIMIT $${params.length}`,
      params
    );
  }

  async byOption(s: SalesScope, limit = 100): Promise<SalesRow[]> {
    const params: unknown[] = [];
    const where = this.scopeSql(s, params);
    params.push(limit);
    return db().query(
      `SELECT opt->>'optionId' AS key, (opt->>'groupName') || ': ' || (opt->>'name') AS label, COUNT(DISTINCT o.id)::int AS orders, SUM(l.quantity)::int AS items,
              SUM((opt->>'priceDelta')::bigint * l.quantity) AS subtotal, 0 AS "deliveryFees", 0 AS discounts, SUM((opt->>'priceDelta')::bigint * l.quantity) AS revenue
       FROM order_lines l JOIN orders o ON o.id = l.order_id, jsonb_array_elements(l.options) AS opt
       WHERE ${where} GROUP BY 1, 2 ORDER BY items DESC LIMIT $${params.length}`,
      params
    );
  }

  /** Dashboard: today's numbers and the open/paused state per branch are composed in the service. */
  async topItemsToday(s: SalesScope, limit = 5): Promise<Array<{ label: string; items: number }>> {
    const rows = await this.byItem(s, limit);
    return rows.map((r) => ({ label: r.label, items: r.items }));
  }

  async statusCounts(organizationId: string, branchIds: string[] | null): Promise<Record<string, number>> {
    const rows: Array<{ status: string; n: number }> = await db().query(
      `SELECT status, COUNT(*)::int AS n FROM orders WHERE organization_id = $1 AND ($2::uuid[] IS NULL OR branch_id = ANY($2))
         AND status IN ('pending_payment','awaiting_confirmation','paid','accepted','preparing','ready','out_for_delivery') GROUP BY status`,
      [organizationId, branchIds]
    );
    return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  }
}
