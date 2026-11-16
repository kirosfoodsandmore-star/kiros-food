// Checkout: revalidate + reprice the cart on the server, create the order (lines snapshot names and
// prices), redeem the promo, open a payment (Paystack redirect or bank-transfer details), then drop
// the cart. All inside one transaction; the Paystack call happens after commit.
import { DEFAULT_TRANSFER_WINDOW_MINUTES, PAYSTACK_PENDING_TTL_MINUTES } from "../../../config/constants";
import { env } from "../../../config/env";
import { paystackClient } from "../../../infrastructure/payments/paystackClient";
import { inTransaction } from "../../../infrastructure/database/transaction";
import { AppError } from "../../../shared/errors/AppError";
import { domainEvents } from "../../../shared/events/domainEvents";
import type { CustomerActor } from "../../../shared/types/actor";
import { formatOrderNumber, paymentReference } from "../../../shared/utils/referenceCode";
import { CartService } from "../../cart/services/cart.service";
import { CustomerRepository } from "../../customer/repositories/customer.repository";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { PaymentRepository } from "../../payment/repositories/payment.repository";
import { PaymentSettingsService } from "../../payment/services/paymentSettings.service";
import { PromoRepository } from "../../promo/repositories/promo.repository";
import type { CheckoutResultDTO } from "../dto/order.dto";
import { OrderRepository } from "../repositories/order.repository";
import type { CheckoutInput } from "../validators/order.schema";
import { OrderService } from "./order.service";

export class CheckoutService {
  static Instance = new CheckoutService();
  private constructor(
    private readonly carts = CartService.Instance,
    private readonly orders = OrderRepository.Instance,
    private readonly orderService = OrderService.Instance,
    private readonly payments = PaymentRepository.Instance,
    private readonly paymentSettings = PaymentSettingsService.Instance,
    private readonly promos = PromoRepository.Instance,
    private readonly customers = CustomerRepository.Instance,
    private readonly organizations = OrganizationRepository.Instance
  ) {}

  async paymentMethods(organizationId: string, branchId: string) {
    const { methods, paystackPublicKey } = await this.paymentSettings.methodsForBranch(organizationId, branchId);
    return { methods, paystackPublicKey, bankAccounts: methods.includes("transfer") ? await this.paymentSettings.bankAccountsForBranch(organizationId, branchId) : [] };
  }

  async checkout(customer: CustomerActor, cartToken: string, data: CheckoutInput): Promise<CheckoutResultDTO> {
    const org = await this.organizations.findById(customer.organizationId);
    if (!org) throw AppError.notFound("Restaurant not found");
    const cart = await this.carts.load(customer.organizationId, data.cartId, cartToken, customer);
    const view = await this.carts.view(cart, customer);
    if (view.blockers.length > 0) throw AppError.unprocessable("Your bag is not ready for checkout", view.blockers.map((b) => ({ field: "cart", message: b })), view);

    const { methods, transferWindowMinutes } = await this.paymentSettings.methodsForBranch(customer.organizationId, cart.branchId);
    if (!methods.includes(data.paymentMethod)) throw AppError.badRequest("That payment method is not available at this branch");

    const phone = view.phone ?? customer.phone;
    if (!phone) throw AppError.badRequest("Add your phone number");
    const customerRow = await this.customers.findById(customer.organizationId, customer.id);
    // The phone on this order may already belong to another customer record (a returning guest, a signed-in
    // account). A blocked holder blocks the order; otherwise we just don't copy the number onto this record,
    // because phone numbers are unique per restaurant.
    const phoneHolder = await this.customers.findByPhone(customer.organizationId, phone);
    if (phoneHolder && phoneHolder.id !== customer.id && phoneHolder.isBlocked) throw AppError.forbidden("This number has been blocked by the restaurant");
    const phoneIsFree = !phoneHolder || phoneHolder.id === customer.id;
    const email = data.email ?? customerRow?.email ?? null;
    const name = data.name ?? customerRow?.name ?? null;

    const window = data.paymentMethod === "transfer" ? (transferWindowMinutes || DEFAULT_TRANSFER_WINDOW_MINUTES) : PAYSTACK_PENDING_TTL_MINUTES;
    const expiresAt = new Date(Date.now() + window * 60_000);

    const { order, payment } = await inTransaction(async (tx) => {
      const sequence = await this.organizations.nextCounter(customer.organizationId, "order", tx);
      const number = formatOrderNumber(org.orderPrefix, sequence);
      if (cart.promoCode && view.promo.applied && !(await this.promos.findByCode(customer.organizationId, cart.promoCode, tx))) throw AppError.unprocessable("Promo code is no longer valid");
      if (cart.promoCode && view.promo.applied) {
        const promo = await this.promos.findByCode(customer.organizationId, cart.promoCode, tx);
        if (!promo || !(await this.promos.redeem(promo.id, tx))) throw AppError.unprocessable("This promo code has just been fully used");
      }
      const order = await this.orders.create(
        {
          organizationId: customer.organizationId,
          branchId: cart.branchId,
          menuId: cart.menuId,
          customerId: customer.id,
          number,
          fulfilment: cart.fulfilment,
          scheduledFor: cart.scheduledFor,
          deliveryAddress: cart.fulfilment === "delivery" ? cart.deliveryAddress : null,
          customerPhone: phone,
          customerName: name,
          customerEmail: email,
          subtotal: view.subtotal,
          deliveryFee: view.deliveryFee,
          discount: view.discount,
          promoCode: view.promo.applied ? cart.promoCode : null,
          total: view.total,
          status: "pending_payment",
          paymentMethod: data.paymentMethod,
          paidAt: null,
          acceptedAt: null,
          readyAt: null,
          completedAt: null,
          cancelledAt: null,
          cancelReason: null,
          refundedAt: null,
          refundNote: null,
          riderId: null,
          riderResponse: null,
          riderRespondedAt: null,
          riderAssignedAt: null,
          triedRiderIds: [],
          deliveryCode: null,
          deliveryCodeAttempts: 0,
          note: data.note ?? null,
          expiresAt,
        },
        tx
      );
      await this.orders.addLines(
        view.lines.map((l) => ({
          orderId: order.id,
          itemId: l.itemId,
          itemName: l.itemName,
          categoryName: l.categoryName,
          imageUrl: l.imageUrl,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          note: l.note,
          options: l.options,
        })),
        tx
      );
      await this.orders.addEvent({ orderId: order.id, organizationId: customer.organizationId, fromStatus: null, toStatus: "pending_payment", actorType: "customer", actorId: customer.id, actorName: name, note: null }, tx);
      const payment = await this.payments.create(
        {
          organizationId: customer.organizationId,
          orderId: order.id,
          method: data.paymentMethod,
          amount: view.total,
          currency: org.currencyCode,
          reference: paymentReference(number, 1),
          status: "pending",
          authorizationUrl: null,
          channel: null,
          proofUrl: null,
          proofPublicId: null,
          claimNote: null,
          claimedAt: null,
          expiresAt,
          paidAt: null,
          confirmedById: null,
          confirmedAt: null,
          rejectedById: null,
          rejectedAt: null,
          rejectReason: null,
          refundedAt: null,
          refundAmount: null,
          refundReference: null,
          providerPayload: null,
        },
        tx
      );
      await this.customers.update(customer.organizationId, customer.id, { ...(name && !customerRow?.name ? { name } : {}), ...(email && !customerRow?.email ? { email } : {}), ...(!customerRow?.phone && phoneIsFree ? { phone } : {}) }, tx);
      return { order, payment };
    });
    await this.carts.discard(cart.id);
    domainEvents.emit("order.created", { organizationId: customer.organizationId, orderId: order.id });

    if (data.paymentMethod === "paystack") {
      const secret = await this.paymentSettings.paystackSecret(customer.organizationId);
      const init = await paystackClient.initialize(secret, {
        email: email ?? `${phone.replace(/\D/g, "")}@customers.kiros.app`,
        amount: view.total,
        reference: payment.reference,
        currency: org.currencyCode,
        callbackUrl: `${env.paystack.callbackUrl}?order=${order.id}&ref=${encodeURIComponent(payment.reference)}`,
        metadata: { orderId: order.id, orderNumber: order.number, organizationId: org.id, branchId: order.branchId },
      });
      await this.payments.update(payment.id, { authorizationUrl: init.authorizationUrl });
      return {
        order: await this.orderService.detail(customer.organizationId, order.id, { customerId: customer.id }),
        payment: { method: "paystack", authorizationUrl: init.authorizationUrl, reference: payment.reference, publicKey: await this.paymentSettings.paystackPublicKey(org.id) },
      };
    }
    const terms = await this.paymentSettings.transferTerms(org.id);
    return {
      order: await this.orderService.detail(customer.organizationId, order.id, { customerId: customer.id }),
      payment: {
        method: "transfer",
        reference: order.number,
        amount: view.total,
        bankAccounts: await this.paymentSettings.bankAccountsForBranch(org.id, order.branchId),
        instructions: terms.instructions,
        deadline: expiresAt.toISOString(),
      },
    };
  }

  /** Reorder: a new cart from a past order's lines. */
  async reorder(customer: CustomerActor, orderId: string) {
    const detail = await this.orderService.detail(customer.organizationId, orderId, { customerId: customer.id });
    const lines = detail.lines
      .filter((l) => l.itemId)
      .map((l) => ({ id: l.id, itemId: l.itemId!, quantity: l.quantity, note: l.note, selectedOptionIds: l.options.map((o) => o.optionId) }));
    if (lines.length === 0) throw AppError.badRequest("None of these items are available any more");
    return this.carts.createFromLines(customer.organizationId, detail.branchId, detail.menuId, detail.fulfilment, lines, customer);
  }
}
