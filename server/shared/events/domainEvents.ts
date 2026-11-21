// In-process domain events. Services announce what happened after their transaction commits;
// listeners (emails, sockets) react without the services depending on them. Listener failures are
// logged and never reach the caller.
import type { OrderStatus } from "../../config/constants";

export interface DomainEvents {
  "restaurant.registered": { organizationId: string; ownerUserId: string; method: "form" | "google" };
  "auth.signedIn": { organizationId: string; userId: string; method: string; ip: string | null };
  "staff.invited": { organizationId: string; inviteId: string; token: string };
  "staff.deactivated": { organizationId: string; userId: string };
  "user.passwordChanged": { organizationId: string; userId: string };
  "auth.passwordResetRequested": { organizationId: string; userId: string; code: string };
  "order.created": { organizationId: string; orderId: string };
  "order.paid": { organizationId: string; orderId: string };
  /** A rider was given a delivery (not fired when one is removed). */
  "order.riderAssigned": { organizationId: string; orderId: string; riderId: string };
  /** A rider gave a delivery back. `managerIds` are the staff who can hand it to someone else. */
  "order.riderDeclined": { organizationId: string; orderId: string; number: string; branchName: string; riderId: string; riderName: string; reason: string | null; managerIds: string[] };
  /** A rider didn't answer in time. `nextRiderName` is who it was passed to, or null when nobody else was available. */
  "order.riderTimedOut": { organizationId: string; orderId: string; number: string; branchName: string; riderId: string; riderName: string; nextRiderName: string | null; managerIds: string[] };
  "order.statusChanged": { organizationId: string; orderId: string; from: OrderStatus; to: OrderStatus; note: string | null };
  "payment.claimed": { organizationId: string; orderId: string; paymentId: string };
  "payment.rejected": { organizationId: string; orderId: string; reason: string };
  "availability.changed": { organizationId: string; branchId: string; itemId: string | null; optionId: string | null; isAvailable: boolean };
  "menu.versionBumped": { organizationId: string; menuId: string; version: number };
  "chat.message": {
    organizationId: string;
    branchId: string;
    orderId: string;
    conversationId: string;
    authorType: "staff" | "customer";
    /** Who wrote it, as shown in the conversation. */
    authorName: string;
    customerId: string;
    orderNumber: string;
    /** The start of the text, or "Sent a photo" / "Sent a file" for an attachment on its own. */
    preview: string;
  };
}

type Listener<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => Promise<void> | void;

const listeners = new Map<keyof DomainEvents, Array<(payload: never) => Promise<void> | void>>();

export const domainEvents = {
  on<K extends keyof DomainEvents>(event: K, listener: Listener<K>): void {
    const list = listeners.get(event) ?? [];
    list.push(listener as (payload: never) => Promise<void> | void);
    listeners.set(event, list);
  },

  emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
    for (const listener of (listeners.get(event) ?? []) as Array<Listener<K>>) {
      Promise.resolve()
        .then(() => listener(payload))
        .catch((err) => console.error(`[events] "${event}" listener failed`, err));
    }
  },
};
