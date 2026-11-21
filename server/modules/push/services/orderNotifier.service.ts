// Turns "an order needs attention" moments into push notifications for the staff who act on them, for phones that
// aren't looking:
//  - an order is paid (card paid, or a transfer confirmed)  → staff who accept orders, reject them or confirm payments
//  - a customer says they've paid by bank transfer          → staff who can confirm the payment
// The in-app alerts (chime + toast) are sent separately by the socket server (order:new / payment:claimed). The service
// worker stays quiet while the app is open on screen, so each moment is announced once, never twice.
import { domainEvents } from "../../../shared/events/domainEvents";
import { OrderRepository } from "../../order/repositories/order.repository";
import { UserRepository } from "../../user/repositories/user.repository";
import { PushService } from "./push.service";

/** Same people the admin screen chimes for on a new order (see onNewOrder in client AdminLayout). */
const ORDER_HANDLER_PERMISSIONS = ["orders.update_status", "orders.reject", "payments.confirm"] as const;

export class OrderNotifierService {
  static Instance = new OrderNotifierService();
  private registered = false;
  private constructor(
    private readonly orders = OrderRepository.Instance,
    private readonly users = UserRepository.Instance,
    private readonly push = PushService.Instance
  ) {}

  /** Staff holding any of `permissions` who can see `branchId`, once each. */
  private async recipients(organizationId: string, permissions: readonly string[], branchId: string): Promise<string[]> {
    const groups = await Promise.all(permissions.map((p) => this.users.recipientsWithPermission(organizationId, p, branchId)));
    return [...new Set(groups.flat().map((u) => u.id))];
  }

  register(): void {
    if (this.registered) return;
    this.registered = true;

    domainEvents.on("order.paid", async ({ organizationId, orderId }) => {
      if (!this.push.enabled) return;
      const order = await this.orders.summary(organizationId, orderId);
      if (!order) return;
      const userIds = await this.recipients(organizationId, ORDER_HANDLER_PERMISSIONS, order.branchId);
      await this.push.sendToUsers(userIds, {
        title: `New order ${order.number}`,
        body: `${order.branchName} · ${order.itemCount} item${order.itemCount === 1 ? "" : "s"} · ${order.fulfilment === "delivery" ? "delivery" : "pickup"}`,
        url: `/admin/orders/${orderId}`,
        tag: `order-${orderId}`,
      });
    });

    domainEvents.on("payment.claimed", async ({ organizationId, orderId }) => {
      if (!this.push.enabled) return;
      const order = await this.orders.summary(organizationId, orderId);
      if (!order) return;
      const userIds = await this.recipients(organizationId, ["payments.confirm"], order.branchId);
      await this.push.sendToUsers(userIds, {
        title: `Payment to confirm · ${order.number}`,
        body: `${order.branchName}. The customer says they've paid by transfer.`,
        url: `/admin/orders/${orderId}`,
        tag: `payment-${orderId}`,
      });
    });
  }
}
