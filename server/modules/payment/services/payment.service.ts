// Payment state: Paystack verification (webhook + return), bank-transfer claims with receipt upload,
// and the admin confirm / reject queue. Marking an order paid is idempotent on the reference.
import { STORAGE_FOLDERS } from "../../../config/constants";
import type { PagedRows } from "../../../shared/pagination/paginate";
import { paystackClient } from "../../../infrastructure/payments/paystackClient";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { assertPermission } from "../../../shared/access/can";
import { assertBranchAccess, branchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import { domainEvents } from "../../../shared/events/domainEvents";
import { StorageService } from "../../../shared/services/storage.service";
import type { Actor, CustomerActor } from "../../../shared/types/actor";
import { AuditService } from "../../audit/services/audit.service";
import { OrderRepository } from "../../order/repositories/order.repository";
import { OrderService } from "../../order/services/order.service";
import type { Payment } from "../entities/payment.entity";
import { PaymentRepository, type PaymentQueueRow } from "../repositories/payment.repository";
import { PaymentSettingsService } from "./paymentSettings.service";

export class PaymentService {
  static Instance = new PaymentService();
  private constructor(
    private readonly payments = PaymentRepository.Instance,
    private readonly orders = OrderRepository.Instance,
    private readonly orderService = OrderService.Instance,
    private readonly settings = PaymentSettingsService.Instance,
    private readonly storage = StorageService.Instance,
    private readonly audit = AuditService.Instance
  ) {}

  /** Settle a payment and move the order to Paid. Safe to call twice (webhook + return). */
  private async settle(reference: string, info: { channel?: string | null; paidAt?: Date | null; payload?: Record<string, unknown> | null; confirmedById?: string | null }): Promise<Payment> {
    const { payment, order } = await inTransaction(async (tx) => {
      const payment = await this.payments.findByReferenceForUpdate(reference, tx);
      if (!payment) throw AppError.notFound("Payment not found");
      if (payment.status === "paid") return { payment, order: null };
      const order = await this.orders.findForUpdate(payment.organizationId, payment.orderId, tx);
      if (!order) throw AppError.notFound("Order not found");
      if (order.status !== "pending_payment" && order.status !== "awaiting_confirmation") {
        // Paid after cancellation/expiry: record it so staff can refund, but do not resurrect the order.
        await this.payments.update(payment.id, { status: "paid", paidAt: info.paidAt ?? new Date(), channel: info.channel ?? null, providerPayload: info.payload ?? null, confirmedById: info.confirmedById ?? null, confirmedAt: info.confirmedById ? new Date() : null }, tx);
        await this.audit.record(null, payment.organizationId, { action: "payment.late", entityType: "order", entityId: order.id, branchId: order.branchId, summary: `${order.number}: payment ${reference} arrived after the order was ${order.status}` }, tx);
        return { payment: { ...payment, status: "paid" as const }, order: null };
      }
      await this.payments.update(payment.id, { status: "paid", paidAt: info.paidAt ?? new Date(), channel: info.channel ?? null, providerPayload: info.payload ?? null, confirmedById: info.confirmedById ?? null, confirmedAt: info.confirmedById ? new Date() : null }, tx);
      return { payment: { ...payment, status: "paid" as const }, order };
    });
    if (order) {
      await this.orderService.transition(payment.organizationId, order.id, "paid", info.confirmedById ? { type: "staff", id: info.confirmedById, name: null } : { type: "system", id: null, name: "Payment" }, null);
    }
    return payment;
  }

  // ── Paystack ───────────────────────────────────────────────────────────────

  /** Called when the customer returns from Paystack: verify server-side, never trust the redirect. */
  async verifyPaystack(customer: CustomerActor, orderId: string): Promise<{ status: string; orderStatus: string }> {
    const order = await this.orders.findById(customer.organizationId, orderId);
    if (!order || order.customerId !== customer.id) throw AppError.notFound("Order not found");
    const payment = await this.payments.latestForOrder(order.id);
    if (!payment || payment.method !== "paystack") throw AppError.badRequest("This order is not a Paystack order");
    if (payment.status === "paid") return { status: "paid", orderStatus: (await this.orders.findById(order.organizationId, order.id))!.status };
    const secret = await this.settings.paystackSecret(order.organizationId);
    const result = await paystackClient.verify(secret, payment.reference);
    if (result.status === "success") {
      if (result.amount !== payment.amount || result.currency.toUpperCase() !== payment.currency.toUpperCase()) {
        await this.payments.update(payment.id, { status: "failed", providerPayload: { reason: "amount_mismatch", ...result } });
        throw AppError.conflict("Payment amount does not match the order — contact the restaurant");
      }
      await this.settle(payment.reference, { channel: result.channel, paidAt: result.paidAt ? new Date(result.paidAt) : null, payload: { source: "verify", ...result } });
      return { status: "paid", orderStatus: "paid" };
    }
    if (result.status === "failed" || result.status === "abandoned") await this.payments.update(payment.id, { status: "failed", providerPayload: { source: "verify", ...result } });
    return { status: result.status, orderStatus: order.status };
  }

  /** Paystack webhook. The signature is checked with the restaurant's own secret (looked up by reference). */
  async handlePaystackWebhook(rawBody: Buffer, signature: string | undefined): Promise<{ handled: boolean }> {
    let event: { event?: string; data?: { reference?: string; amount?: number; currency?: string; channel?: string; paid_at?: string; status?: string } };
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw AppError.badRequest("Invalid webhook body");
    }
    const reference = event.data?.reference;
    if (!reference) return { handled: false };
    const payment = await this.payments.findByReference(reference);
    if (!payment) return { handled: false };
    const secret = await this.settings.paystackSecret(payment.organizationId).catch(() => null);
    if (!secret || !paystackClient.verifySignature(secret, rawBody, signature)) throw AppError.unauthorised("Bad webhook signature");
    if (event.event !== "charge.success") return { handled: true };
    const amount = Number(event.data?.amount ?? 0);
    const currency = String(event.data?.currency ?? "").toUpperCase();
    if (amount !== payment.amount || currency !== payment.currency.toUpperCase()) {
      await this.payments.update(payment.id, { status: "failed", providerPayload: { reason: "amount_mismatch", source: "webhook", ...event.data } });
      return { handled: true };
    }
    await this.settle(reference, { channel: event.data?.channel ?? null, paidAt: event.data?.paid_at ? new Date(event.data.paid_at) : null, payload: { source: "webhook", ...event.data } });
    return { handled: true };
  }

  // ── Bank transfer ──────────────────────────────────────────────────────────

  /**
   * Customer says "I have paid" and sends the transfer receipt. Order → Awaiting confirmation.
   * The first claim needs a receipt. While the order still awaits confirmation the customer can call this again to add
   * (or replace) the receipt, which keeps the original claim time and note.
   */
  async claimTransfer(customer: CustomerActor, orderId: string, receipt: { buffer: Buffer; mimetype: string } | null, note: string | null) {
    const order = await this.orders.findById(customer.organizationId, orderId);
    if (!order || order.customerId !== customer.id) throw AppError.notFound("Order not found");
    const payment = await this.payments.latestForOrder(order.id);
    if (!payment || payment.method !== "transfer") throw AppError.badRequest("This order is not a bank-transfer order");
    if (payment.status !== "pending" && payment.status !== "claimed") throw AppError.conflict("This payment can no longer be claimed");
    if (order.status !== "pending_payment" && order.status !== "awaiting_confirmation") throw AppError.conflict("This order is no longer awaiting payment");
    if (!receipt && !payment.proofUrl) throw AppError.badRequest("Please upload your transfer receipt, then tap I have paid");
    let proof: { url: string; publicId: string } | null = null;
    if (receipt) {
      const uploaded = await this.storage.replace(receipt.buffer, { folder: STORAGE_FOLDERS.receipt, kind: receipt.mimetype === "application/pdf" ? "document" : "image" }, payment.proofPublicId);
      proof = { url: uploaded.url, publicId: uploaded.publicId };
    }
    // A repeat call (adding the receipt afterwards) keeps when the customer first said they paid, and the note they left.
    await this.payments.update(payment.id, { status: "claimed", claimedAt: payment.claimedAt ?? new Date(), claimNote: note ?? payment.claimNote, ...(proof ? { proofUrl: proof.url, proofPublicId: proof.publicId } : {}) });
    if (order.status === "pending_payment") {
      // The transfer window still bounds how long the claim can sit unconfirmed (+24h grace, see scheduler).
      await this.orderService.transition(customer.organizationId, order.id, "awaiting_confirmation", { type: "customer", id: customer.id, name: customer.name }, note);
    }
    domainEvents.emit("payment.claimed", { organizationId: customer.organizationId, orderId: order.id, paymentId: payment.id });
    return this.orderService.detail(customer.organizationId, order.id, { customerId: customer.id });
  }

  queue(actor: Actor, f: { branchId?: string; status?: "claimed" | "pending" | "all"; page: number; limit: number }): Promise<PagedRows<PaymentQueueRow>> {
    const status = f.status ?? "claimed";
    const statuses = status === "all" ? ["pending", "claimed"] : [status];
    return this.payments.queue(actor.organizationId, branchScope(actor, f.branchId), statuses, f.page, f.limit);
  }

  async confirm(actor: Actor, paymentId: string) {
    assertPermission(actor, "payments.confirm");
    const payment = await this.payments.findById(actor.organizationId, paymentId);
    if (!payment || payment.method !== "transfer") throw AppError.notFound("Payment not found");
    const order = await this.orders.findById(actor.organizationId, payment.orderId);
    if (!order) throw AppError.notFound("Order not found");
    assertBranchAccess(actor, order.branchId, "This order belongs to another branch");
    if (payment.status !== "claimed" && payment.status !== "pending") throw AppError.conflict("This payment is not waiting for confirmation");
    await this.settle(payment.reference, { confirmedById: actor.id, channel: "bank_transfer" });
    await this.audit.log(actor, { action: "payment.confirm", entityType: "order", entityId: order.id, branchId: order.branchId, summary: `${order.number}: confirmed bank transfer of ${payment.amount}` });
    return this.orderService.get(actor, order.id);
  }

  async reject(actor: Actor, paymentId: string, reason: string) {
    assertPermission(actor, "payments.confirm");
    const payment = await this.payments.findById(actor.organizationId, paymentId);
    if (!payment || payment.method !== "transfer") throw AppError.notFound("Payment not found");
    const order = await this.orders.findById(actor.organizationId, payment.orderId);
    if (!order) throw AppError.notFound("Order not found");
    assertBranchAccess(actor, order.branchId, "This order belongs to another branch");
    if (payment.status !== "claimed" && payment.status !== "pending") throw AppError.conflict("This payment is not waiting for confirmation");
    await this.payments.update(payment.id, { status: "rejected", rejectedById: actor.id, rejectedAt: new Date(), rejectReason: reason });
    await this.orderService.transition(actor.organizationId, order.id, "cancelled", { type: "staff", id: actor.id, name: actor.name, staff: actor }, `Payment rejected: ${reason}`);
    domainEvents.emit("payment.rejected", { organizationId: actor.organizationId, orderId: order.id, reason });
    return this.orderService.get(actor, order.id);
  }

  /** Scheduler: pending payments whose window passed → expired (the order sweep cancels the order). */
  async expireStale(): Promise<number> {
    const stale = await this.payments.expiredPending();
    for (const p of stale) await this.payments.update(p.id, { status: "expired" });
    const lateClaims = await this.orders.expiredAwaitingConfirmation();
    for (const { id, organizationId } of lateClaims) {
      await this.orderService.transition(organizationId, id, "cancelled", { type: "system", id: null, name: "System" }, "Bank transfer was not confirmed in time").catch((err) => console.error("[payment] late-claim expiry failed", id, err));
    }
    return stale.length + lateClaims.length;
  }
}
