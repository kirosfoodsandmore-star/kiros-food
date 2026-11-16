// Orders: status changes under a row lock with a history row and audit entry in the same transaction,
// the live board, reject / refund / rider assignment, customer history, and the scheduler sweeps.
// Checkout lives in checkout.service.ts; payment state changes in payment.service.ts.
import { BOARD_STATUSES, type OrderStatus } from "../../../config/constants";
import { env } from "../../../config/env";
import { paystackClient } from "../../../infrastructure/payments/paystackClient";
import { inTransaction, type Tx } from "../../../infrastructure/database/transaction";
import { assertPermission, can } from "../../../shared/access/can";
import { assertBranchAccess, branchScope } from "../../../shared/access/scope";
import crypto from "crypto";
import { AppError } from "../../../shared/errors/AppError";
import { domainEvents } from "../../../shared/events/domainEvents";
import type { Actor, CustomerActor } from "../../../shared/types/actor";
import { resolveRange } from "../../../shared/utils/dates";
import { timingSafeEqualString } from "../../../shared/utils/jwt";
import { maskEmail, maskPhone } from "../../../shared/utils/mask";
import { AuditService } from "../../audit/services/audit.service";
import { BranchRepository } from "../../branch/repositories/branch.repository";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { PaymentRepository } from "../../payment/repositories/payment.repository";
import { PaymentSettingsService } from "../../payment/services/paymentSettings.service";
import { UserRepository } from "../../user/repositories/user.repository";
import { canTransition, isPaidStatus, permissionFor, staffNext } from "../domain/lifecycle";
import type { OrderDetailDTO, OrderSummaryDTO } from "../dto/order.dto";
import type { Order } from "../entities/order.entity";
import { MAX_CODE_ATTEMPTS, OrderRepository } from "../repositories/order.repository";
import type { ListOrdersQuery } from "../validators/order.schema";

export interface TransitionActor {
  type: "staff" | "customer" | "system";
  id: string | null;
  name: string | null;
  staff?: Actor;
}

/** Four digits: short enough to read out at a door, with a handful of guesses allowed. */
function newDeliveryCode(): string {
  return String(crypto.randomInt(0, 10_000)).padStart(4, "0");
}

export class OrderService {
  static Instance = new OrderService();
  private constructor(
    private readonly orders = OrderRepository.Instance,
    private readonly payments = PaymentRepository.Instance,
    private readonly branches = BranchRepository.Instance,
    private readonly users = UserRepository.Instance,
    private readonly organizations = OrganizationRepository.Instance,
    private readonly paymentSettings = PaymentSettingsService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  // ── Reads ──────────────────────────────────────────────────────────────────

  async detail(organizationId: string, id: string, opts: { staff?: Actor; customerId?: string } = {}): Promise<OrderDetailDTO> {
    const order = await this.orders.findById(organizationId, id);
    if (!order) throw AppError.notFound("Order not found");
    if (opts.customerId && order.customerId !== opts.customerId) throw AppError.notFound("Order not found");
    if (opts.staff) assertBranchAccess(opts.staff, order.branchId, "This order belongs to another branch");
    const [summary, lines, events, payment, branch] = await Promise.all([
      this.orders.summary(organizationId, id),
      this.orders.lines(id),
      this.orders.events(id),
      this.payments.latestForOrder(id),
      this.branches.findById(organizationId, order.branchId),
    ]);
    const maskContact = opts.staff && !can(opts.staff, "customers.view_contact");
    return {
      ...summary!,
      customerPhone: maskContact ? (maskPhone(order.customerPhone) ?? "") : order.customerPhone,
      menuId: order.menuId,
      deliveryAddress: order.deliveryAddress,
      customerEmail: maskContact ? maskEmail(order.customerEmail) : order.customerEmail,
      promoCode: order.promoCode,
      // Only the customer sees it, and only while the order is on its way. Riders can open order pages too, so staff never get it.
      deliveryCode: opts.customerId && order.status === "out_for_delivery" ? order.deliveryCode : null,
      note: order.note,
      cancelReason: order.cancelReason,
      refundNote: order.refundNote,
      acceptedAt: order.acceptedAt,
      readyAt: order.readyAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      refundedAt: order.refundedAt,
      expiresAt: order.expiresAt,
      lines,
      events,
      payment: payment
        ? {
            id: payment.id,
            method: payment.method,
            status: payment.status,
            amount: payment.amount,
            reference: payment.reference,
            authorizationUrl: opts.staff ? null : payment.authorizationUrl,
            proofUrl: payment.proofUrl,
            claimedAt: payment.claimedAt,
            expiresAt: payment.expiresAt,
            paidAt: payment.paidAt,
            rejectReason: payment.rejectReason,
            refundAmount: payment.refundAmount,
            refundedAt: payment.refundedAt,
          }
        : null,
      nextStatuses: opts.staff ? staffNext(order.status, order.fulfilment).filter((s) => can(opts.staff!, permissionFor(s))) : undefined,
      branch: { name: branch?.name ?? "", address: branch?.address ?? "", phone: branch?.phone ?? null, timezone: branch?.timezone ?? "Africa/Lagos" },
    };
  }

  async list(actor: Actor, query: ListOrdersQuery) {
    const org = await this.organizations.findById(actor.organizationId);
    const timezone = org?.timezone ?? "Africa/Lagos";
    const range = query.from || query.to ? resolveRange(timezone, query.from, query.to) : null;
    const result = await this.orders.list(actor.organizationId, { ...query, branchIds: branchScope(actor, query.branchId), from: range?.from, to: range?.to, timezone });
    if (can(actor, "customers.view_contact")) return result;
    return { ...result, data: result.data.map((o) => ({ ...o, customerPhone: maskPhone(o.customerPhone) ?? "" })) };
  }

  async board(actor: Actor, branchId?: string): Promise<Record<string, OrderSummaryDTO[]>> {
    const rows = await this.orders.board(actor.organizationId, branchScope(actor, branchId), [...BOARD_STATUSES]);
    const columns: Record<string, OrderSummaryDTO[]> = Object.fromEntries(BOARD_STATUSES.map((s) => [s, []]));
    for (const row of rows) columns[row.status].push(can(actor, "customers.view_contact") ? row : { ...row, customerPhone: maskPhone(row.customerPhone) ?? "" });
    return columns;
  }

  get(actor: Actor, id: string): Promise<OrderDetailDTO> {
    return this.detail(actor.organizationId, id, { staff: actor });
  }

  // ── Transitions ────────────────────────────────────────────────────────────

  /**
   * The one place an order's status changes. Locks the row, checks the state machine, writes the
   * status-history row (and audit entry) in the same transaction, then emits the domain event.
   */
  async transition(organizationId: string, orderId: string, to: OrderStatus, by: TransitionActor, note: string | null, patch: Partial<Order> = {}, tx?: Tx): Promise<Order> {
    const run = async (t: Tx): Promise<{ order: Order; from: OrderStatus }> => {
      const order = await this.orders.findForUpdate(organizationId, orderId, t);
      if (!order) throw AppError.notFound("Order not found");
      if (order.status === to) return { order, from: order.status };
      if (!canTransition(order.status, to, order.fulfilment)) throw AppError.conflict(`Cannot move this order from ${order.status} to ${to}`);
      const now = new Date();
      const stamps: Partial<Order> = {
        status: to,
        ...(to === "paid" ? { paidAt: now, expiresAt: null } : {}),
        ...(to === "accepted" ? { acceptedAt: now } : {}),
        ...(to === "ready" ? { readyAt: now } : {}),
        ...(to === "completed" ? { completedAt: now } : {}),
        // The customer's proof-of-receipt code is made the moment a delivery leaves.
        ...(to === "out_for_delivery" && order.fulfilment === "delivery" && !order.deliveryCode ? { deliveryCode: newDeliveryCode(), deliveryCodeAttempts: 0 } : {}),
        ...(to === "cancelled" ? { cancelledAt: now, cancelReason: note, expiresAt: null } : {}),
        ...(to === "refunded" ? { refundedAt: now, refundNote: note } : {}),
        ...patch,
      };
      await this.orders.update(order.id, stamps, t);
      await this.orders.addEvent({ orderId: order.id, organizationId, fromStatus: order.status, toStatus: to, actorType: by.type, actorId: by.id, actorName: by.name, note }, t);
      await this.audit.record(by.staff ?? null, organizationId, { action: `order.${to}`, entityType: "order", entityId: order.id, branchId: order.branchId, summary: `${order.number}: ${order.status} → ${to}${note ? ` — ${note}` : ""}` }, t);
      return { order: { ...order, ...stamps }, from: order.status };
    };
    const { order, from } = tx ? await run(tx) : await inTransaction(run);
    if (from !== to) {
      domainEvents.emit("order.statusChanged", { organizationId, orderId: order.id, from, to, note });
      if (to === "paid") domainEvents.emit("order.paid", { organizationId, orderId: order.id });
    }
    return order;
  }

  private staffActor(actor: Actor): TransitionActor {
    return { type: "staff", id: actor.id, name: actor.name, staff: actor };
  }

  async changeStatus(actor: Actor, id: string, to: OrderStatus, note: string | null, code: string | null = null): Promise<OrderDetailDTO> {
    const order = await this.orders.findById(actor.organizationId, id);
    if (!order) throw AppError.notFound("Order not found");
    assertBranchAccess(actor, order.branchId, "This order belongs to another branch");
    if (to === "paid" || to === "awaiting_confirmation") throw AppError.badRequest("Payment states are set by the payment flow");
    if (to === "refunded") throw AppError.badRequest("Use the refund action");
    // A rider (orders.deliver without orders.update_status) can carry their own delivery through "picked up" and "delivered", nothing else.
    const asRider = (to === "out_for_delivery" || to === "completed") && !can(actor, "orders.update_status") && can(actor, "orders.deliver");
    if (asRider) {
      if (order.fulfilment !== "delivery" || order.riderId !== actor.id) throw AppError.forbidden("This delivery isn't assigned to you");
    } else {
      assertPermission(actor, permissionFor(to));
    }
    if (to === "completed" && order.fulfilment === "delivery" && order.riderId && order.riderId !== actor.id && !can(actor, "orders.update_status")) {
      throw AppError.forbidden("Only the assigned rider can mark this delivery completed");
    }
    if (to === "out_for_delivery" && !order.riderId && !can(actor, "orders.assign_rider")) throw AppError.badRequest("Assign a rider first");
    // Picking it up (or a manager sending it out with them) settles the rider's answer: they have it.
    const handedOver = to === "out_for_delivery" && order.riderId ? { riderResponse: "accepted" as const, riderRespondedAt: new Date() } : {};
    const proof = to === "completed" ? await this.checkDeliveryCode(actor, order, code) : null;
    await this.transition(actor.organizationId, id, to, this.staffActor(actor), proof ?? note, handedOver);
    return this.get(actor, id);
  }

  /**
   * Proof of receipt. A delivery that carries a code can only be finished by someone who has it: the rider types in what
   * the customer reads out. A manager (who can change any status) may finish it without the code, and that is written
   * into the order's history. Returns the note to record, or null when no code was involved.
   */
  private async checkDeliveryCode(actor: Actor, order: Order, code: string | null): Promise<string | null> {
    if (order.fulfilment !== "delivery" || !order.deliveryCode) return null;
    if (!code) {
      if (!can(actor, "orders.update_status")) throw AppError.badRequest("Ask the customer for their delivery code to mark this delivered");
      return "Marked delivered by staff without the customer's code";
    }
    if (order.deliveryCodeAttempts >= MAX_CODE_ATTEMPTS) throw AppError.conflict("Too many wrong codes. Ask the customer to check their order page, or ask the restaurant to complete it.");
    if (!timingSafeEqualString(code, order.deliveryCode)) {
      const used = await this.orders.bumpCodeAttempts(order.id);
      const left = used === null ? 0 : MAX_CODE_ATTEMPTS - used;
      throw AppError.badRequest(left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "That code isn't right, and there are no tries left. Ask the restaurant to complete this delivery.");
    }
    return "Delivered. Customer's code confirmed";
  }

  /** The code a customer reads out, for the "on its way" email. */
  async deliveryCodeFor(organizationId: string, orderId: string): Promise<string | null> {
    return (await this.orders.findById(organizationId, orderId))?.deliveryCode ?? null;
  }

  async reject(actor: Actor, id: string, reason: string): Promise<OrderDetailDTO> {
    const order = await this.orders.findById(actor.organizationId, id);
    if (!order) throw AppError.notFound("Order not found");
    assertBranchAccess(actor, order.branchId, "This order belongs to another branch");
    assertPermission(actor, "orders.reject");
    const wasPaid = isPaidStatus(order.status);
    await this.transition(actor.organizationId, id, "cancelled", this.staffActor(actor), reason);
    if (wasPaid) {
      // Paid orders that are rejected are refunded in full where the provider allows it.
      await this.refundInternal(actor, order, undefined, `Rejected: ${reason}`).catch((err) => console.error("[order] automatic refund failed", err));
    }
    return this.get(actor, id);
  }

  async refund(actor: Actor, id: string, amount: number | undefined, note: string): Promise<OrderDetailDTO> {
    const order = await this.orders.findById(actor.organizationId, id);
    if (!order) throw AppError.notFound("Order not found");
    assertBranchAccess(actor, order.branchId, "This order belongs to another branch");
    assertPermission(actor, "orders.refund");
    if (!isPaidStatus(order.status)) throw AppError.conflict("Only paid orders can be refunded");
    await this.refundInternal(actor, order, amount, note);
    await this.transition(actor.organizationId, id, "refunded", this.staffActor(actor), note);
    return this.get(actor, id);
  }

  /** Paystack: provider refund; bank transfer: recorded manually. Idempotent per payment. */
  private async refundInternal(actor: Actor, order: Order, amount: number | undefined, note: string): Promise<void> {
    const payment = await this.payments.latestForOrder(order.id);
    if (!payment || payment.status !== "paid") throw AppError.conflict("No settled payment to refund");
    const refundAmount = amount ?? payment.amount;
    if (refundAmount > payment.amount) throw AppError.badRequest("Refund cannot exceed the amount paid");
    let refundReference: string | null = null;
    if (payment.method === "paystack") {
      const secret = await this.paymentSettings.paystackSecret(actor.organizationId);
      const result = await paystackClient.refund(secret, payment.reference, refundAmount === payment.amount ? undefined : refundAmount, note);
      refundReference = String(result.id);
    }
    await this.payments.update(payment.id, { status: "refunded", refundedAt: new Date(), refundAmount, refundReference });
    await this.audit.log(actor, { action: "refund", entityType: "order", entityId: order.id, branchId: order.branchId, summary: `${order.number}: refunded ${refundAmount} (${payment.method})${refundReference ? ` ref ${refundReference}` : ""} — ${note}` });
  }

  async assignRider(actor: Actor, id: string, riderId: string | null): Promise<OrderDetailDTO> {
    const order = await this.orders.findById(actor.organizationId, id);
    if (!order) throw AppError.notFound("Order not found");
    assertBranchAccess(actor, order.branchId, "This order belongs to another branch");
    assertPermission(actor, "orders.assign_rider");
    if (order.fulfilment !== "delivery") throw AppError.badRequest("Only delivery orders have riders");
    if (riderId) {
      const rider = (await this.users.ridersForBranch(actor.organizationId, order.branchId)).find((r) => r.id === riderId);
      if (!rider) throw AppError.badRequest("That rider cannot work this branch");
      // Keeping the rider an order already has is fine; handing a new one to someone who's switched off is not.
      if (!rider.onDuty && riderId !== order.riderId) throw AppError.conflict(`${rider.name} is off duty right now. Choose a rider who's available.`);
    }
    // A new rider has to answer; the same rider again changes nothing. Someone already carrying it has by definition accepted.
    const changed = riderId !== order.riderId;
    const response = riderId ? (changed ? (order.status === "out_for_delivery" ? "accepted" : "pending") : order.riderResponse) : null;
    await this.orders.update(id, { riderId, riderResponse: response, ...(changed ? { riderRespondedAt: response === "accepted" ? new Date() : null, riderAssignedAt: response === "pending" ? new Date() : null } : {}) });
    await this.audit.log(actor, { action: "assign_rider", entityType: "order", entityId: id, branchId: order.branchId, summary: `${order.number}: rider ${riderId ? "assigned" : "unassigned"}` });
    domainEvents.emit("order.statusChanged", { organizationId: actor.organizationId, orderId: id, from: order.status, to: order.status, note: "rider" });
    // The rider themselves gets told (a live alert in their own session), but only when it's someone new.
    if (riderId && riderId !== order.riderId) domainEvents.emit("order.riderAssigned", { organizationId: actor.organizationId, orderId: id, riderId });
    return this.get(actor, id);
  }

  /**
   * The assigned rider answers a delivery: accept it, or give it back (it returns to "unassigned" and the managers
   * who can reassign it are told). Possible until it is picked up.
   */
  async respondToDelivery(actor: Actor, id: string, action: "accept" | "decline", reason: string | null): Promise<{ response: "accepted" | "declined" }> {
    assertPermission(actor, "orders.deliver");
    const order = await this.orders.findById(actor.organizationId, id);
    if (!order || order.riderId !== actor.id) throw AppError.notFound("This delivery isn't assigned to you (it may have been passed to another rider)");
    if (!["paid", "accepted", "preparing", "ready"].includes(order.status)) throw AppError.conflict("This delivery is already on its way, so it can't be changed here");

    if (action === "accept") {
      if (order.riderResponse !== "pending") return { response: "accepted" };
      // One conditional UPDATE: if the time ran out and it was passed on a moment ago, this finds nothing to accept.
      if (!(await this.orders.acceptAssignment(id, actor.id))) throw AppError.conflict("This delivery was passed to another rider because it wasn't answered in time.");
      await this.audit.log(actor, { action: "accept_delivery", entityType: "order", entityId: id, branchId: order.branchId, summary: `${order.number}: ${actor.name} accepted the delivery` });
      domainEvents.emit("order.statusChanged", { organizationId: actor.organizationId, orderId: id, from: order.status, to: order.status, note: "rider" });
      return { response: "accepted" };
    }

    if (!(await this.orders.releaseAssignment(id, actor.id))) throw AppError.conflict("This delivery has just changed. Refresh to see where it stands.");
    await this.audit.log(actor, { action: "decline_delivery", entityType: "order", entityId: id, branchId: order.branchId, summary: `${order.number}: ${actor.name} declined the delivery${reason ? ` — ${reason}` : ""}` });
    const summary = await this.orders.summary(actor.organizationId, id);
    const managers = await this.users.recipientsWithPermission(actor.organizationId, "orders.assign_rider", order.branchId);
    domainEvents.emit("order.statusChanged", { organizationId: actor.organizationId, orderId: id, from: order.status, to: order.status, note: "rider" });
    domainEvents.emit("order.riderDeclined", {
      organizationId: actor.organizationId,
      orderId: id,
      number: order.number,
      branchName: summary?.branchName ?? "",
      riderId: actor.id,
      riderName: actor.name,
      reason,
      managerIds: managers.map((m) => m.id).filter((m) => m !== actor.id),
    });
    return { response: "declined" };
  }

  riders(actor: Actor, branchId: string) {
    assertBranchAccess(actor, branchId);
    return this.users.ridersForBranch(actor.organizationId, branchId);
  }

  /** Am I switched on to take deliveries? */
  async myAvailability(actor: Actor): Promise<{ onDuty: boolean }> {
    assertPermission(actor, "orders.deliver");
    return { onDuty: await this.users.onDuty(actor.id) };
  }

  /** A rider switches themselves on or off. Deliveries they already have stay theirs. */
  async setMyAvailability(actor: Actor, onDuty: boolean): Promise<{ onDuty: boolean }> {
    assertPermission(actor, "orders.deliver");
    await this.users.update(actor.organizationId, actor.id, { onDuty });
    await this.audit.log(actor, { action: "update", entityType: "staff", entityId: actor.id, summary: `${actor.name} is now ${onDuty ? "on" : "off"} duty` });
    return { onDuty };
  }

  /**
   * Rider view: every delivery assigned to me that isn't finished, with the address. Ones still being prepared are
   * included so a rider who was assigned early can see what's coming; the app only offers actions once it's ready.
   */
  async myDeliveries(actor: Actor, done = false) {
    assertPermission(actor, "orders.deliver");
    const common = { riderId: actor.id, branchIds: branchScope(actor) };
    // `done`: the ones I finished in the last day (the rider's "Delivered" view).
    return done
      ? this.orders.riderDeliveries(actor.organizationId, { ...common, statuses: ["completed"], deliveredInLastDay: true })
      : this.orders.riderDeliveries(actor.organizationId, { ...common, statuses: [...BOARD_STATUSES] });
  }

  // ── Customer ───────────────────────────────────────────────────────────────

  listMine(customer: CustomerActor, page: number, limit: number) {
    return this.orders.listForCustomer(customer.organizationId, customer.id, page, limit);
  }

  getMine(customer: CustomerActor, id: string): Promise<OrderDetailDTO> {
    return this.detail(customer.organizationId, id, { customerId: customer.id });
  }

  /** Customer cancels their own unpaid order. */
  async cancelMine(customer: CustomerActor, id: string): Promise<OrderDetailDTO> {
    const order = await this.orders.findById(customer.organizationId, id);
    if (!order || order.customerId !== customer.id) throw AppError.notFound("Order not found");
    if (order.status !== "pending_payment" && order.status !== "awaiting_confirmation") throw AppError.conflict("This order can no longer be cancelled here — chat with the branch");
    await this.transition(customer.organizationId, id, "cancelled", { type: "customer", id: customer.id, name: customer.name }, "Cancelled by customer");
    const payment = await this.payments.latestForOrder(id);
    if (payment && (payment.status === "pending" || payment.status === "claimed")) await this.payments.update(payment.id, { status: "failed" });
    return this.getMine(customer, id);
  }

  // ── Scheduler ──────────────────────────────────────────────────────────────

  /**
   * A delivery nobody answered within RIDER_ACCEPT_MINUTES goes to the next on-duty rider (fewest deliveries in hand,
   * never one who already declined or timed out on this order). With nobody left it becomes unassigned. Managers are
   * told either way. Safe to run often and from more than one process: the hand-over is one conditional UPDATE.
   */
  async passUnansweredAssignments(): Promise<number> {
    const minutes = env.riderAcceptMinutes;
    if (minutes <= 0) return 0;
    let n = 0;
    for (const { id, organizationId } of await this.orders.unansweredAssignments(minutes)) {
      try {
        if (await this.passOne(organizationId, id, minutes)) n++;
      } catch (err) {
        console.error("[order] passing an unanswered delivery failed", id, err);
      }
    }
    return n;
  }

  private async passOne(organizationId: string, id: string, minutes: number): Promise<boolean> {
    const order = await this.orders.findById(organizationId, id);
    if (!order?.riderId || order.riderResponse !== "pending") return false;
    const fromId = order.riderId;
    const next = await this.users.nextRider(organizationId, order.branchId, [...new Set([...(order.triedRiderIds ?? []), fromId])]);
    if (!(await this.orders.passAssignment(id, fromId, next?.id ?? null))) return false; // answered in the meantime

    const [from, summary, managers] = await Promise.all([
      this.users.findById(organizationId, fromId),
      this.orders.summary(organizationId, id),
      this.users.recipientsWithPermission(organizationId, "orders.assign_rider", order.branchId),
    ]);
    const fromName = from?.name ?? "A rider";
    await this.audit.record(null, organizationId, {
      action: "pass_delivery",
      entityType: "order",
      entityId: id,
      branchId: order.branchId,
      summary: `${order.number}: ${fromName} didn't answer in ${minutes} min; ${next ? `passed to ${next.name}` : "nobody else was on duty, so it is unassigned"}`,
    });
    domainEvents.emit("order.statusChanged", { organizationId, orderId: id, from: order.status, to: order.status, note: "rider" });
    if (next) domainEvents.emit("order.riderAssigned", { organizationId, orderId: id, riderId: next.id });
    domainEvents.emit("order.riderTimedOut", {
      organizationId,
      orderId: id,
      number: order.number,
      branchName: summary?.branchName ?? "",
      riderId: fromId,
      riderName: fromName,
      nextRiderName: next?.name ?? null,
      managerIds: managers.map((m) => m.id),
    });
    return true;
  }

  async expireUnpaid(): Promise<number> {
    let n = 0;
    for (const { id, organizationId } of await this.orders.expiredUnpaid()) {
      try {
        await this.transition(organizationId, id, "cancelled", { type: "system", id: null, name: "System" }, "Payment window expired");
        const payment = await this.payments.latestForOrder(id);
        if (payment && payment.status === "pending") await this.payments.update(payment.id, { status: "expired" });
        n++;
      } catch (err) {
        console.error("[order] expiry failed", id, err);
      }
    }
    return n;
  }
}
