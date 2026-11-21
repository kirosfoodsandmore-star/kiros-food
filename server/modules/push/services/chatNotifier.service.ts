// A customer writes in an order's chat → push notification to the staff who can read that chat at the order's branch, for
// phones that aren't looking. The in-app alert (chime + toast) is sent separately: the socket server forwards the same
// event as chat:message and the admin layout reacts to it. The service worker stays quiet while the app is open on
// screen, so a message is announced once, never twice. Replies from staff are not announced this way (the customer's
// browser has no push registration; they see the reply live on their order page).
import { domainEvents } from "../../../shared/events/domainEvents";
import { UserRepository } from "../../user/repositories/user.repository";
import { PushService } from "./push.service";

export class ChatNotifierService {
  static Instance = new ChatNotifierService();
  private registered = false;
  private constructor(
    private readonly users = UserRepository.Instance,
    private readonly push = PushService.Instance
  ) {}

  register(): void {
    if (this.registered) return;
    this.registered = true;

    domainEvents.on("chat.message", async (e) => {
      if (e.authorType !== "customer" || !this.push.enabled) return;
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
    });
  }
}
