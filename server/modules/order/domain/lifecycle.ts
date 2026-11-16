// Order status state machine. Pure: no I/O.
import type { Fulfilment, OrderStatus } from "../../../config/constants";
import type { PermissionCode } from "../../access/catalog/permissions.catalog";

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "awaiting_confirmation", "cancelled"],
  awaiting_confirmation: ["paid", "cancelled"],
  paid: ["accepted", "cancelled", "refunded"],
  accepted: ["preparing", "cancelled", "refunded"],
  preparing: ["ready", "cancelled", "refunded"],
  ready: ["out_for_delivery", "completed", "refunded"],
  out_for_delivery: ["completed", "refunded"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus, fulfilment: Fulfilment): boolean {
  if (!NEXT[from].includes(to)) return false;
  if (to === "out_for_delivery" && fulfilment !== "delivery") return false;
  if (from === "ready" && to === "completed" && fulfilment === "delivery") return false;
  return true;
}

/** Staff-driven transitions on the live board (payment transitions are system/customer driven). */
export function staffNext(from: OrderStatus, fulfilment: Fulfilment): OrderStatus[] {
  return NEXT[from].filter((to) => to !== "paid" && to !== "awaiting_confirmation" && canTransition(from, to, fulfilment));
}

/** Which permission a staff transition needs. */
export function permissionFor(to: OrderStatus): PermissionCode {
  switch (to) {
    case "cancelled":
      return "orders.reject";
    case "refunded":
      return "orders.refund";
    default:
      return "orders.update_status";
  }
}

export const ACTIVE_STATUSES: OrderStatus[] = ["paid", "accepted", "preparing", "ready", "out_for_delivery"];
export const PAID_STATUSES: OrderStatus[] = ["paid", "accepted", "preparing", "ready", "out_for_delivery", "completed"];

export function isPaidStatus(status: OrderStatus): boolean {
  return PAID_STATUSES.includes(status);
}
