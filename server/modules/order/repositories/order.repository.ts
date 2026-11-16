import { likePattern, SqlParams, tzDateBetween } from "../../../infrastructure/database/sql";
import { db, type Tx, updateReturning } from "../../../infrastructure/database/transaction";
import type { OrderStatus } from "../../../config/constants";
import { env } from "../../../config/env";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import type { OrderEventDTO, OrderLineDTO, OrderListFilter, OrderSummaryDTO, RiderDeliveryDTO } from "../dto/order.dto";
import { OrderEntity, type Order } from "../entities/order.entity";
import { OrderLineEntity, type OrderLine } from "../entities/orderLine.entity";
import { OrderStatusEventEntity, type OrderStatusEvent } from "../entities/orderStatusEvent.entity";

const SELECT_SUMMARY = `
  SELECT o.id, o.number, o.branch_id AS "branchId", b.name AS "branchName", o.customer_id AS "customerId", o.customer_phone AS "customerPhone",
         o.customer_name AS "customerName", o.fulfilment, o.scheduled_for AS "scheduledFor", o.status, o.payment_method AS "paymentMethod",
         o.subtotal, o.delivery_fee AS "deliveryFee", o.discount, o.total, o.rider_id AS "riderId", r.name AS "riderName", o.rider_response AS "riderResponse", o.paid_at AS "paidAt",
         o.created_at AS "createdAt", o.updated_at AS "updatedAt",
         (SELECT COALESCE(SUM(l.quantity), 0)::int FROM order_lines l WHERE l.order_id = o.id) AS "itemCount"
  FROM orders o JOIN branches b ON b.id = o.branch_id LEFT JOIN users r ON r.id = o.rider_id`;

/** Statuses where a rider can still answer or give a delivery back: before it has been picked up. */
const BEFORE_PICKUP = ["paid", "accepted", "preparing", "ready"];

/** Wrong delivery codes allowed before the rider is locked out and the restaurant has to complete the order. */
export const MAX_CODE_ATTEMPTS = 5;

export class OrderRepository {
  static Instance = new OrderRepository();
  private constructor() {}

  async create(data: Omit<Order, "id" | "createdAt" | "updatedAt">, tx: Tx): Promise<Order> {
    const repo = tx.getRepository(OrderEntity);
    return repo.save(repo.create(data));
  }

  async addLines(lines: Array<Omit<OrderLine, "id">>, tx: Tx): Promise<void> {
    if (lines.length > 0) await tx.getRepository(OrderLineEntity).insert(lines);
  }

  async addEvent(event: Omit<OrderStatusEvent, "id" | "createdAt">, tx: Tx): Promise<void> {
    await tx.getRepository(OrderStatusEventEntity).insert(event);
  }

  async findById(organizationId: string, id: string, tx?: Tx): Promise<Order | null> {
    return db(tx).getRepository(OrderEntity).findOne({ where: { id, organizationId } });
  }

  /** Lock the order so concurrent status changes are serialised. */
  async findForUpdate(organizationId: string, id: string, tx: Tx): Promise<Order | null> {
    return tx.getRepository(OrderEntity).createQueryBuilder("o").setLock("pessimistic_write").where("o.id = :id AND o.organizationId = :organizationId", { id, organizationId }).getOne();
  }

  async update(id: string, data: Partial<Order>, tx?: Tx): Promise<void> {
    await db(tx).getRepository(OrderEntity).update({ id }, data);
  }

  // A rider's answer. Each is one conditional UPDATE, so it can't race with the timeout or a manager's change.

  /** Accept: only while the order is still this rider's and waiting for an answer. */
  async acceptAssignment(id: string, riderId: string): Promise<boolean> {
    const rows = await updateReturning<{ id: string }>(
      db(),
      `UPDATE orders SET rider_response = 'accepted', rider_responded_at = now() WHERE id = $1 AND rider_id = $2 AND rider_response = 'pending' AND status = ANY($3::text[]) RETURNING id`,
      [id, riderId, BEFORE_PICKUP]
    );
    return rows.length > 0;
  }

  /** Decline: the order goes back to unassigned and the rider is remembered so it isn't offered to them again. */
  async releaseAssignment(id: string, riderId: string): Promise<boolean> {
    const rows = await updateReturning<{ id: string }>(
      db(),
      `UPDATE orders SET rider_id = NULL, rider_response = NULL, rider_responded_at = NULL, rider_assigned_at = NULL, tried_rider_ids = array_append(tried_rider_ids, $2::uuid)
       WHERE id = $1 AND rider_id = $2 AND status = ANY($3::text[]) RETURNING id`,
      [id, riderId, BEFORE_PICKUP]
    );
    return rows.length > 0;
  }

  /** Time ran out: hand it to `toRiderId` (a fresh answer clock), or leave it unassigned when nobody else is free. */
  async passAssignment(id: string, fromRiderId: string, toRiderId: string | null): Promise<boolean> {
    const rows = await updateReturning<{ id: string }>(
      db(),
      `UPDATE orders SET rider_id = $3::uuid,
              rider_response = CASE WHEN $3::uuid IS NULL THEN NULL ELSE 'pending' END,
              rider_responded_at = NULL,
              rider_assigned_at = CASE WHEN $3::uuid IS NULL THEN NULL ELSE now() END,
              tried_rider_ids = array_append(tried_rider_ids, $2::uuid)
       WHERE id = $1 AND rider_id = $2 AND rider_response = 'pending' AND status = ANY($4::text[]) RETURNING id`,
      [id, fromRiderId, toRiderId, BEFORE_PICKUP]
    );
    return rows.length > 0;
  }

  /** Deliveries still waiting for an answer after `minutes`. */
  async unansweredAssignments(minutes: number): Promise<Array<{ id: string; organizationId: string }>> {
    return db().query(
      `SELECT id, organization_id AS "organizationId" FROM orders
       WHERE rider_id IS NOT NULL AND rider_response = 'pending' AND rider_assigned_at IS NOT NULL
         AND rider_assigned_at < now() - make_interval(mins => $1) AND status = ANY($2::text[])
       ORDER BY rider_assigned_at LIMIT 50`,
      [minutes, BEFORE_PICKUP]
    );
  }

  /** Counts one wrong guess. Returns the guesses used so far, or null when the order is already locked. */
  async bumpCodeAttempts(id: string): Promise<number | null> {
    const rows = await updateReturning<{ n: number }>(
      db(),
      `UPDATE orders SET delivery_code_attempts = delivery_code_attempts + 1 WHERE id = $1 AND delivery_code_attempts < $2 RETURNING delivery_code_attempts AS n`,
      [id, MAX_CODE_ATTEMPTS]
    );
    return rows[0]?.n ?? null;
  }

  async summary(organizationId: string, id: string): Promise<OrderSummaryDTO | null> {
    const rows: OrderSummaryDTO[] = await db().query(`${SELECT_SUMMARY} WHERE o.organization_id = $1 AND o.id = $2`, [organizationId, id]);
    return rows[0] ?? null;
  }

  /**
   * Delivery orders with the address, for riders: the ones assigned to `riderId`, or one order by id.
   * Nearest to being delivered first (on the way, then ready, then still being prepared), oldest first within that.
   */
  async riderDeliveries(organizationId: string, f: { riderId?: string; orderId?: string; branchIds: string[] | null; statuses: OrderStatus[]; deliveredInLastDay?: boolean }): Promise<RiderDeliveryDTO[]> {
    const p = new SqlParams();
    const where = [`o.organization_id = ${p.add(organizationId)}`, "o.fulfilment = 'delivery'", `o.status = ANY(${p.add(f.statuses)}::text[])`];
    if (f.riderId) where.push(`o.rider_id = ${p.add(f.riderId)}`);
    if (f.orderId) where.push(`o.id = ${p.add(f.orderId)}`);
    if (f.branchIds) where.push(`o.branch_id = ANY(${p.add(f.branchIds)}::uuid[])`);
    // The "Delivered" view: what was finished in the last 24 hours, latest first. Otherwise nearest-to-done first.
    if (f.deliveredInLastDay) where.push("o.completed_at >= now() - interval '24 hours'");
    const order = f.deliveredInLastDay
      ? "o.completed_at DESC"
      : `CASE o.status WHEN 'out_for_delivery' THEN 0 WHEN 'ready' THEN 1 WHEN 'preparing' THEN 2 WHEN 'accepted' THEN 3 ELSE 4 END, COALESCE(o.scheduled_for, o.paid_at, o.created_at)`;
    return db().query(
      `${SELECT_SUMMARY.replace("SELECT o.id,", `SELECT o.delivery_address AS "deliveryAddress", o.note AS "note", o.completed_at AS "completedAt", CASE WHEN ${p.add(env.riderAcceptMinutes)}::int > 0 AND o.rider_response = 'pending' AND o.rider_assigned_at IS NOT NULL THEN o.rider_assigned_at + make_interval(mins => ${env.riderAcceptMinutes}) END AS "answerBy", (o.delivery_code IS NOT NULL) AS "needsCode", GREATEST(${MAX_CODE_ATTEMPTS} - o.delivery_code_attempts, 0)::int AS "codeAttemptsLeft", o.id,`)}
       WHERE ${where.join(" AND ")}
       ORDER BY ${order} LIMIT 100`,
      p.values
    );
  }

  async lines(orderId: string): Promise<OrderLineDTO[]> {
    return db().query(
      `SELECT id, item_id AS "itemId", item_name AS "itemName", category_name AS "categoryName", image_url AS "imageUrl", quantity, unit_price AS "unitPrice", line_total AS "lineTotal", note, options
       FROM order_lines WHERE order_id = $1 ORDER BY id`,
      [orderId]
    );
  }

  async events(orderId: string): Promise<OrderEventDTO[]> {
    return db().query(
      `SELECT id, from_status AS "fromStatus", to_status AS "toStatus", actor_type AS "actorType", actor_name AS "actorName", note, created_at AS "createdAt"
       FROM order_status_events WHERE order_id = $1 ORDER BY created_at`,
      [orderId]
    );
  }

  async list(organizationId: string, f: OrderListFilter): Promise<PagedRows<OrderSummaryDTO>> {
    const p = new SqlParams();
    const where = [`o.organization_id = ${p.add(organizationId)}`];
    if (f.branchIds) where.push(`o.branch_id = ANY(${p.add(f.branchIds)}::uuid[])`);
    if (f.status && f.status.length > 0) where.push(`o.status = ANY(${p.add(f.status)}::text[])`);
    if (f.fulfilment) where.push(`o.fulfilment = ${p.add(f.fulfilment)}`);
    if (f.customerId) where.push(`o.customer_id = ${p.add(f.customerId)}`);
    if (f.riderId) where.push(`o.rider_id = ${p.add(f.riderId)}`);
    if (f.scheduledOnly) where.push("o.scheduled_for IS NOT NULL");
    // "Handled" = a staff member has changed its status at least once (confirmed the payment, accepted, rejected…).
    if (f.unhandled) where.push("NOT EXISTS (SELECT 1 FROM order_status_events se WHERE se.order_id = o.id AND se.actor_type = 'staff')");
    if (f.search) {
      const s = p.add(likePattern(f.search));
      where.push(`(o.number ILIKE ${s} OR o.customer_phone ILIKE ${s} OR o.customer_name ILIKE ${s})`);
    }
    if (f.from && f.to) where.push(tzDateBetween("o.created_at", p.add(f.from), p.add(f.to), p.add(f.timezone)));
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT_SUMMARY} WHERE ${where.join(" AND ")}) x
       ORDER BY x."createdAt" DESC LIMIT ${p.add(f.limit)} OFFSET ${p.add(getOffset(f.page, f.limit))}`,
      p.values
    );
    return fromWindowedRows<OrderSummaryDTO & Record<string, unknown>>(rows, f.page, f.limit);
  }

  /** Live board: every active order at the branch, oldest first. */
  async board(organizationId: string, branchIds: string[] | null, statuses: OrderStatus[]): Promise<OrderSummaryDTO[]> {
    return db().query(
      `${SELECT_SUMMARY} WHERE o.organization_id = $1 AND ($2::uuid[] IS NULL OR o.branch_id = ANY($2)) AND o.status = ANY($3::text[])
       ORDER BY COALESCE(o.scheduled_for, o.paid_at, o.created_at) LIMIT 500`,
      [organizationId, branchIds, statuses]
    );
  }

  async listForCustomer(organizationId: string, customerId: string, page: number, limit: number): Promise<PagedRows<OrderSummaryDTO>> {
    const rows = await db().query(
      `SELECT x.*, COUNT(*) OVER() AS "__total" FROM (${SELECT_SUMMARY} WHERE o.organization_id = $1 AND o.customer_id = $2) x
       ORDER BY x."createdAt" DESC LIMIT $3 OFFSET $4`,
      [organizationId, customerId, limit, getOffset(page, limit)]
    );
    return fromWindowedRows<OrderSummaryDTO & Record<string, unknown>>(rows, page, limit);
  }

  /** Unpaid orders past their expiry (ids only; the service cancels each one under a lock). */
  async expiredUnpaid(): Promise<Array<{ id: string; organizationId: string }>> {
    return db().query(
      `SELECT id, organization_id AS "organizationId" FROM orders WHERE status IN ('pending_payment') AND expires_at IS NOT NULL AND expires_at < now() LIMIT 200`
    );
  }

  async expiredAwaitingConfirmation(): Promise<Array<{ id: string; organizationId: string }>> {
    return db().query(
      `SELECT o.id, o.organization_id AS "organizationId" FROM orders o
       WHERE o.status = 'awaiting_confirmation' AND o.expires_at IS NOT NULL AND o.expires_at < now() - interval '24 hours' LIMIT 200`
    );
  }
}
