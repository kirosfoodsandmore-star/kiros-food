// Turns delivery moments into push notifications for the people who need them:
//  - a rider is given a delivery, or the food they're carrying becomes ready  → that rider
//  - a rider gives a delivery back                                            → the managers who can reassign it
// The in-app alerts (sockets) are sent separately by the socket server; this is for phones that aren't looking.
import { BOARD_STATUSES } from "../../../config/constants";
import { domainEvents } from "../../../shared/events/domainEvents";
import { OrderRepository } from "../../order/repositories/order.repository";
import { PushService } from "./push.service";

export class DeliveryNotifierService {
  static Instance = new DeliveryNotifierService();
  private registered = false;
  private constructor(
    private readonly orders = OrderRepository.Instance,
    private readonly push = PushService.Instance
  ) {}

  private async delivery(organizationId: string, orderId: string) {
    const [d] = await this.orders.riderDeliveries(organizationId, { orderId, branchIds: null, statuses: [...BOARD_STATUSES] });
    return d ?? null;
  }

  register(): void {
    if (this.registered) return;
    this.registered = true;

    domainEvents.on("order.riderAssigned", async ({ organizationId, orderId, riderId }) => {
      const d = await this.delivery(organizationId, orderId);
      if (!d) return;
      const where = d.deliveryAddress?.line ?? d.branchName;
      const ready = d.status === "ready" || d.status === "out_for_delivery";
      await this.push.sendToUsers([riderId], {
        title: `New delivery ${d.number}`,
        body: `${where}${ready ? " · ready to collect" : ""}. Open to accept or decline.`,
        url: "/rider",
        tag: `delivery-${orderId}`,
      });
    });

    domainEvents.on("order.statusChanged", async ({ organizationId, orderId, to, from }) => {
      if (to !== "ready" || from === "ready") return;
      const d = await this.delivery(organizationId, orderId);
      if (!d?.riderId) return;
      await this.push.sendToUsers([d.riderId], {
        title: `${d.number} is ready for pickup`,
        body: `${d.branchName} · ${d.deliveryAddress?.line ?? "delivery"}`,
        url: "/rider",
        tag: `delivery-${orderId}`,
      });
    });

    domainEvents.on("order.riderTimedOut", async (e) => {
      await this.push.sendToUsers(e.managerIds, {
        title: e.nextRiderName ? `${e.riderName} didn't answer ${e.number}` : `No rider for ${e.number}`,
        body: e.nextRiderName ? `Passed to ${e.nextRiderName}.` : `${e.riderName} didn't answer and nobody else is on duty. Assign a rider.`,
        url: `/admin/orders/${e.orderId}`,
        tag: `passed-${e.orderId}`,
      });
    });

    domainEvents.on("order.riderDeclined", async (e) => {
      await this.push.sendToUsers(e.managerIds, {
        title: `${e.riderName} can't take ${e.number}`,
        body: `${e.reason ? `“${e.reason}” · ` : ""}${e.branchName}. Choose another rider.`,
        url: `/admin/orders/${e.orderId}`,
        tag: `declined-${e.orderId}`,
      });
    });
  }
}
