// Order chat → push notifications, for phones that aren't looking:
//  - a customer writes → the staff who can read that chat at the order's branch
//  - staff reply       → the customer, if they turned reply alerts on for a device (see the order page)
// The in-app alerts (chime + toast) are sent separately: the socket server forwards the same event as chat:message and
// the admin layout (staff) and storefront layout (customer) react to it. The service worker stays quiet while the app is
// open on screen, so a message is announced once, never twice.
import { domainEvents } from "../../../shared/events/domainEvents";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { UserRepository } from "../../user/repositories/user.repository";
import { PushService } from "./push.service";

export class ChatNotifierService {
  static Instance = new ChatNotifierService();
  private registered = false;
  private constructor(
    private readonly users = UserRepository.Instance,
    private readonly organizations = OrganizationRepository.Instance,
    private readonly push = PushService.Instance
  ) {}

  register(): void {
    if (this.registered) return;
    this.registered = true;

    domainEvents.on("chat.message", async (e) => {
      if (!this.push.enabled) return;

      if (e.authorType === "customer") {
        const staff = await this.users.recipientsWithPermission(e.organizationId, "chat.view", e.branchId);
        await this.push.sendToUsers(
          staff.map((u) => u.id),
          {
            title: `New message · ${e.orderNumber}`,
            body: `${e.authorName}: ${e.preview}`,
            url: `/admin/orders/${e.orderId}`,
            // One card per order: a second message replaces the first (and buzzes again) instead of piling up.
            tag: `chat-${e.orderId}`,
          }
        );
        return;
      }

      // A staff reply. The link is the customer's own order page, which needs the restaurant's address (slug).
      const org = await this.organizations.findById(e.organizationId);
      if (!org) return;
      await this.push.sendToCustomers([e.customerId], {
        title: `Reply on your order ${e.orderNumber}`,
        body: `${e.authorName}: ${e.preview}`,
        url: `/${org.slug}/orders/${e.orderId}`,
        tag: `chat-${e.orderId}`,
        icon: "/app-icon-192.png",
      });
    });
  }
}
