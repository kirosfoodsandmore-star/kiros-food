// Data access for the finance ledger, budgets, and the order aggregates the analytics page needs.
// All values bound; branch scope `null` means every branch plus business-wide rows.
import { In } from "typeorm";
import { SqlParams, likePattern, tzDateBetween, tzLocalDate } from "../../../infrastructure/database/sql";
import { db, type Tx } from "../../../infrastructure/database/transaction";
import { buildMetaFromTotal, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { PAID } from "../../report/repositories/report.repository";
import { FinanceBudgetEntity, type FinanceBudget } from "../entities/financeBudget.entity";
import { FinanceEntryEntity, type FinanceEntry } from "../entities/financeEntry.entity";
import type { Granularity } from "../validators/finance.schema";

export interface LedgerScope {
  organizationId: string;
  branchIds: string[] | null;
  from: string;
  to: string;
}

export interface OrderScope extends LedgerScope {
  timezone: string;
}

export interface EntryFilter {
  page: number;
  limit: number;
  search?: string;
  kind?: string;
  category?: string;
  from?: string;
  to?: string;
}

export interface LedgerBucketRow {
  bucket: string;
  kind: string;
  category: string;
  amount: number;
}

export interface OrderBucketRow {
  bucket: string;
  orders: number;
  revenue: number;
  discounts: number;
  deliveryFees: number;
  customers: number;
  newCustomers: number;
}

export type NewEntry = Omit<FinanceEntry, "id" | "createdAt" | "updatedAt" | "deletedAt">;

const GRAN_SQL: Record<Granularity, string> = { day: "day", week: "week", month: "month" };

/** SQL: bucket start (YYYY-MM-DD text) of a date expression. */
const bucketOf = (dateExpr: string, g: Granularity) => `date_trunc('${GRAN_SQL[g]}', (${dateExpr})::timestamp)::date::text`;

export class FinanceRepository {
  static Instance = new FinanceRepository();
  private constructor() {}

  private entryWhere(p: SqlParams, organizationId: string, branchIds: string[] | null, alias = "e"): string[] {
    const where = [`${alias}.organization_id = ${p.add(organizationId)}`, `${alias}.deleted_at IS NULL`];
    if (branchIds) where.push(`${alias}.branch_id = ANY(${p.add(branchIds)}::uuid[])`);
    return where;
  }

  private orderWhere(p: SqlParams, s: OrderScope, alias = "o"): string[] {
    const org = p.add(s.organizationId);
    const tz = p.add(s.timezone);
    const where = [`${alias}.organization_id = ${org}`, PAID.replace(/\bo\./g, `${alias}.`), tzDateBetween(`${alias}.created_at`, p.add(s.from), p.add(s.to), tz)];
    if (s.branchIds) where.push(`${alias}.branch_id = ANY(${p.add(s.branchIds)}::uuid[])`);
    return where;
  }

  // ── Ledger CRUD ──────────────────────────────────────────────────────────

  async list(organizationId: string, branchIds: string[] | null, f: EntryFilter): Promise<PagedRows<FinanceEntry> & { sum: number }> {
    const p = new SqlParams();
    const where = this.entryWhere(p, organizationId, branchIds);
    if (f.kind) where.push(`e.kind = ${p.add(f.kind)}`);
    if (f.category) where.push(`e.category = ${p.add(f.category)}`);
    if (f.from) where.push(`e.entry_date >= ${p.add(f.from)}::date`);
    if (f.to) where.push(`e.entry_date <= ${p.add(f.to)}::date`);
    if (f.search) {
      const term = p.add(likePattern(f.search));
      where.push(`(e.title ILIKE ${term} OR e.party ILIKE ${term} OR e.reference ILIKE ${term})`);
    }
    const sql = where.join(" AND ");
    const [{ n, sum }] = await db().query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(e.amount),0) AS sum FROM finance_entries e WHERE ${sql}`, p.values);
    const limit = p.add(f.limit);
    const offset = p.add(getOffset(f.page, f.limit));
    const ids: Array<{ id: string }> = await db().query(`SELECT e.id FROM finance_entries e WHERE ${sql} ORDER BY e.entry_date DESC, e.created_at DESC, e.id DESC LIMIT ${limit} OFFSET ${offset}`, p.values);
    const rows = ids.length ? await db().getRepository(FinanceEntryEntity).findBy({ id: In(ids.map((r) => r.id)) }) : [];
    const order = new Map(ids.map((r, i) => [r.id, i]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { data: rows, meta: buildMetaFromTotal(f.page, f.limit, Number(n)), sum: Number(sum) };
  }

  findById(organizationId: string, id: string): Promise<FinanceEntry | null> {
    return db().getRepository(FinanceEntryEntity).findOne({ where: { id, organizationId } });
  }

  async create(data: NewEntry, tx?: Tx): Promise<FinanceEntry> {
    const repo = db(tx).getRepository(FinanceEntryEntity);
    return repo.save(repo.create(data));
  }

  async createMany(rows: NewEntry[], tx: Tx): Promise<number> {
    const repo = tx.getRepository(FinanceEntryEntity);
    for (let i = 0; i < rows.length; i += 200) await repo.insert(rows.slice(i, i + 200));
    return rows.length;
  }

  async update(organizationId: string, id: string, data: Partial<FinanceEntry>): Promise<void> {
    await db().getRepository(FinanceEntryEntity).update({ id, organizationId }, data);
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    await db().getRepository(FinanceEntryEntity).softDelete({ id, organizationId });
  }

  // ── Ledger aggregates ────────────────────────────────────────────────────

  async ledgerBuckets(s: LedgerScope, g: Granularity): Promise<LedgerBucketRow[]> {
    const p = new SqlParams();
    const where = this.entryWhere(p, s.organizationId, s.branchIds);
    where.push(`e.entry_date BETWEEN ${p.add(s.from)}::date AND ${p.add(s.to)}::date`);
    const rows: LedgerBucketRow[] = await db().query(
      `SELECT ${bucketOf("e.entry_date", g)} AS bucket, e.kind, e.category, SUM(e.amount) AS amount
       FROM finance_entries e WHERE ${where.join(" AND ")} GROUP BY 1, 2, 3 ORDER BY 1`,
      p.values
    );
    return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  }

  /** Everything ever recorded up to `to` (for cash position, capital invested, payback). */
  async ledgerTotalsUpTo(organizationId: string, branchIds: string[] | null, to: string): Promise<Array<{ kind: string; category: string; amount: number }>> {
    const p = new SqlParams();
    const where = this.entryWhere(p, organizationId, branchIds);
    where.push(`e.entry_date <= ${p.add(to)}::date`);
    const rows: Array<{ kind: string; category: string; amount: number }> = await db().query(
      `SELECT e.kind, e.category, SUM(e.amount) AS amount FROM finance_entries e WHERE ${where.join(" AND ")} GROUP BY 1, 2`,
      p.values
    );
    return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  }

  async firstEntryDate(organizationId: string, branchIds: string[] | null): Promise<string | null> {
    const p = new SqlParams();
    const rows: Array<{ d: string | null }> = await db().query(`SELECT MIN(e.entry_date)::text AS d FROM finance_entries e WHERE ${this.entryWhere(p, organizationId, branchIds).join(" AND ")}`, p.values);
    return rows[0]?.d ?? null;
  }

  async topParties(s: LedgerScope, limit = 6): Promise<Array<{ party: string; amount: number; entries: number }>> {
    const p = new SqlParams();
    const where = this.entryWhere(p, s.organizationId, s.branchIds);
    where.push(`e.kind = 'expense'`, `e.party IS NOT NULL`, `e.party <> ''`, `e.entry_date BETWEEN ${p.add(s.from)}::date AND ${p.add(s.to)}::date`);
    const rows: Array<{ party: string; amount: number; entries: number }> = await db().query(
      `SELECT MIN(e.party) AS party, SUM(e.amount) AS amount, COUNT(*)::int AS entries FROM finance_entries e
       WHERE ${where.join(" AND ")} GROUP BY lower(trim(e.party)) ORDER BY 2 DESC LIMIT ${p.add(limit)}`,
      p.values
    );
    return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  }

  /** Capital in and money out, oldest first, for the funding timeline. */
  async fundingHistory(organizationId: string, branchIds: string[] | null, to: string, limit = 200): Promise<FinanceEntry[]> {
    const p = new SqlParams();
    const where = this.entryWhere(p, organizationId, branchIds);
    where.push(`e.kind IN ('capital','withdrawal')`, `e.entry_date <= ${p.add(to)}::date`);
    const ids: Array<{ id: string }> = await db().query(`SELECT e.id FROM finance_entries e WHERE ${where.join(" AND ")} ORDER BY e.entry_date ASC, e.created_at ASC LIMIT ${p.add(limit)}`, p.values);
    if (!ids.length) return [];
    const rows = await db().getRepository(FinanceEntryEntity).findBy({ id: In(ids.map((r) => r.id)) });
    return rows.sort((a, b) => (a.entryDate < b.entryDate ? -1 : a.entryDate > b.entryDate ? 1 : a.createdAt.getTime() - b.createdAt.getTime()));
  }

  async ledgerByBranch(s: LedgerScope): Promise<Array<{ branchId: string | null; kind: string; category: string; amount: number }>> {
    const p = new SqlParams();
    const where = this.entryWhere(p, s.organizationId, s.branchIds);
    where.push(`e.entry_date BETWEEN ${p.add(s.from)}::date AND ${p.add(s.to)}::date`);
    const rows: Array<{ branchId: string | null; kind: string; category: string; amount: number }> = await db().query(
      `SELECT e.branch_id::text AS "branchId", e.kind, e.category, SUM(e.amount) AS amount FROM finance_entries e WHERE ${where.join(" AND ")} GROUP BY 1, 2, 3`,
      p.values
    );
    return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  }

  // ── Orders (the storefront's sales) ──────────────────────────────────────

  async orderBuckets(s: OrderScope, g: Granularity): Promise<OrderBucketRow[]> {
    const p = new SqlParams();
    const where = this.orderWhere(p, s);
    const tz = "$2"; // orderWhere binds the timezone second
    const bucket = bucketOf(tzLocalDate("o.created_at", tz), g);
    // A customer is "new" in the bucket that holds their first paid order with the business (any branch).
    const rows: OrderBucketRow[] = await db().query(
      `WITH firsts AS (
         SELECT f.customer_id, ${bucketOf(tzLocalDate("MIN(f.created_at)", tz), g)} AS first_bucket
         FROM orders f WHERE f.organization_id = $1 AND ${PAID.replace(/\bo\./g, "f.")} GROUP BY f.customer_id
       )
       SELECT ${bucket} AS bucket, COUNT(*)::int AS orders, COALESCE(SUM(o.total),0) AS revenue,
              COALESCE(SUM(o.discount),0) AS discounts, COALESCE(SUM(o.delivery_fee),0) AS "deliveryFees",
              COUNT(DISTINCT o.customer_id)::int AS customers,
              COUNT(DISTINCT o.customer_id) FILTER (WHERE fi.first_bucket = ${bucket})::int AS "newCustomers"
       FROM orders o LEFT JOIN firsts fi ON fi.customer_id = o.customer_id
       WHERE ${where.join(" AND ")} GROUP BY 1 ORDER BY 1`,
      p.values
    );
    return rows.map((r) => ({ ...r, revenue: Number(r.revenue), discounts: Number(r.discounts), deliveryFees: Number(r.deliveryFees) }));
  }

  async orderRevenueUpTo(s: Omit<OrderScope, "from">): Promise<number> {
    const p = new SqlParams();
    const org = p.add(s.organizationId);
    const tz = p.add(s.timezone);
    const where = [`o.organization_id = ${org}`, PAID, `o.created_at < ((CAST(${p.add(s.to)} AS date) + 1)::timestamp AT TIME ZONE ${tz})`];
    if (s.branchIds) where.push(`o.branch_id = ANY(${p.add(s.branchIds)}::uuid[])`);
    const rows: Array<{ revenue: number }> = await db().query(`SELECT COALESCE(SUM(o.total),0) AS revenue FROM orders o WHERE ${where.join(" AND ")}`, p.values);
    return Number(rows[0]?.revenue ?? 0);
  }

  async firstOrderDate(organizationId: string, branchIds: string[] | null, timezone: string): Promise<string | null> {
    const p = new SqlParams();
    const where = [`o.organization_id = ${p.add(organizationId)}`, PAID];
    const tz = p.add(timezone);
    if (branchIds) where.push(`o.branch_id = ANY(${p.add(branchIds)}::uuid[])`);
    const rows: Array<{ d: string | null }> = await db().query(`SELECT (MIN(o.created_at) AT TIME ZONE ${tz})::date::text AS d FROM orders o WHERE ${where.join(" AND ")}`, p.values);
    return rows[0]?.d ?? null;
  }

  /** Orders by local weekday (0 = Sunday) and hour, for the busy-times heatmap. */
  async heatmap(s: OrderScope): Promise<Array<{ weekday: number; hour: number; orders: number; revenue: number }>> {
    const p = new SqlParams();
    const where = this.orderWhere(p, s);
    const local = `(o.created_at AT TIME ZONE $2)`;
    const rows: Array<{ weekday: number; hour: number; orders: number; revenue: number }> = await db().query(
      `SELECT EXTRACT(DOW FROM ${local})::int AS weekday, EXTRACT(HOUR FROM ${local})::int AS hour, COUNT(*)::int AS orders, COALESCE(SUM(o.total),0) AS revenue
       FROM orders o WHERE ${where.join(" AND ")} GROUP BY 1, 2`,
      p.values
    );
    return rows.map((r) => ({ ...r, revenue: Number(r.revenue) }));
  }

  async ordersByBranch(s: OrderScope): Promise<Array<{ branchId: string; name: string; orders: number; revenue: number }>> {
    const p = new SqlParams();
    const where = this.orderWhere(p, s);
    const rows: Array<{ branchId: string; name: string; orders: number; revenue: number }> = await db().query(
      `SELECT b.id::text AS "branchId", b.name, COUNT(*)::int AS orders, COALESCE(SUM(o.total),0) AS revenue
       FROM orders o JOIN branches b ON b.id = o.branch_id WHERE ${where.join(" AND ")} GROUP BY b.id, b.name`,
      p.values
    );
    return rows.map((r) => ({ ...r, revenue: Number(r.revenue) }));
  }

  // ── Budgets ──────────────────────────────────────────────────────────────

  budgets(organizationId: string): Promise<FinanceBudget[]> {
    return db().getRepository(FinanceBudgetEntity).find({ where: { organizationId }, order: { category: "ASC" } });
  }

  async replaceBudgets(organizationId: string, rows: Array<{ category: string; monthlyAmount: number }>, tx: Tx): Promise<void> {
    await tx.query(`DELETE FROM finance_budgets WHERE organization_id = $1`, [organizationId]);
    const keep = rows.filter((r) => r.monthlyAmount > 0);
    if (keep.length) await tx.getRepository(FinanceBudgetEntity).insert(keep.map((r) => ({ organizationId, category: r.category, monthlyAmount: r.monthlyAmount })));
  }
}
