import type { Request } from "express";
import { actorOf, cartTokenOf, customerOf, handle, input, Paged } from "../../../shared/http/handler";
import { optionalFile } from "../../../shared/middleware/upload.middleware";
import { OrganizationService } from "../../organization/services/organization.service";
import { PaymentService } from "../../payment/services/payment.service";
import { CheckoutService } from "../services/checkout.service";
import { OrderService } from "../services/order.service";
import {
  assignRiderSchema,
  boardSchema,
  changeStatusSchema,
  checkoutSchema,
  availabilitySchema,
  respondDeliverySchema,
  listOrdersSchema,
  myDeliveriesSchema,
  orderIdSchema,
  refundOrderSchema,
  rejectOrderSchema,
  storeOrderIdSchema,
  storeOrdersSchema,
  storePaymentMethodsSchema,
  transferClaimSchema,
} from "../validators/order.schema";

const svc = () => OrderService.Instance;
const org = async (req: Request) => (await OrganizationService.Instance.resolveStore((req.params as { slug: string }).slug)).id;

export class OrderController {
  // ── Storefront ─────────────────────────────────────────────────────────────
  static paymentMethods = handle("Payment methods", async (req) => {
    const { params } = input(req, storePaymentMethodsSchema);
    return CheckoutService.Instance.paymentMethods(await org(req), params.branchId);
  });
  static checkout = handle("Order placed", (req) => CheckoutService.Instance.checkout(customerOf(req), cartTokenOf(req), input(req, checkoutSchema).body), 201);
  static listMine = handle("Orders fetched", async (req) => {
    const { query } = input(req, storeOrdersSchema);
    return Paged.of(await svc().listMine(customerOf(req), query.page, query.limit));
  });
  static getMine = handle("Order fetched", (req) => svc().getMine(customerOf(req), input(req, storeOrderIdSchema).params.id));
  static cancelMine = handle("Order cancelled", (req) => svc().cancelMine(customerOf(req), input(req, storeOrderIdSchema).params.id));
  static reorder = handle("Bag ready", (req) => CheckoutService.Instance.reorder(customerOf(req), input(req, storeOrderIdSchema).params.id), 201);
  static verifyPayment = handle("Payment checked", (req) => PaymentService.Instance.verifyPaystack(customerOf(req), input(req, storeOrderIdSchema).params.id));
  static transferClaim = handle("Thanks — we will confirm your transfer shortly", (req) => {
    const { params, body } = input(req, transferClaimSchema);
    const file = optionalFile(req);
    return PaymentService.Instance.claimTransfer(customerOf(req), params.id, file ? { buffer: file.buffer, mimetype: file.mimetype } : null, body.note ?? null);
  });

  // ── Admin ──────────────────────────────────────────────────────────────────
  static list = handle("Orders fetched", async (req) => Paged.of(await svc().list(actorOf(req), input(req, listOrdersSchema).query)));
  static board = handle("Live board", (req) => svc().board(actorOf(req), input(req, boardSchema).query.branchId));
  static get = handle("Order fetched", (req) => svc().get(actorOf(req), input(req, orderIdSchema).params.id));
  static changeStatus = handle("Order updated", (req) => {
    const { params, body } = input(req, changeStatusSchema);
    return svc().changeStatus(actorOf(req), params.id, body.status, body.note ?? null, body.code ?? null);
  });
  static reject = handle("Order rejected", (req) => {
    const { params, body } = input(req, rejectOrderSchema);
    return svc().reject(actorOf(req), params.id, body.reason);
  });
  static refund = handle("Order refunded", (req) => {
    const { params, body } = input(req, refundOrderSchema);
    return svc().refund(actorOf(req), params.id, body.amount, body.note);
  });
  static assignRider = handle("Rider updated", (req) => {
    const { params, body } = input(req, assignRiderSchema);
    return svc().assignRider(actorOf(req), params.id, body.riderId);
  });
  static riders = handle("Riders fetched", async (req) => {
    const order = await svc().get(actorOf(req), input(req, orderIdSchema).params.id);
    return svc().riders(actorOf(req), order.branchId);
  });
  static respondToDelivery = handle("Answer recorded", (req) => {
    const { params, body } = input(req, respondDeliverySchema);
    return svc().respondToDelivery(actorOf(req), params.id, body.action, body.reason ?? null);
  });
  static myAvailability = handle("Availability fetched", (req) => svc().myAvailability(actorOf(req)));
  static setMyAvailability = handle("Availability updated", (req) => svc().setMyAvailability(actorOf(req), input(req, availabilitySchema).body.onDuty));
  static myDeliveries =handle("My deliveries", (req) => svc().myDeliveries(actorOf(req), input(req, myDeliveriesSchema).query.done ?? false));
}
