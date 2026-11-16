import type { OrderStatus } from "@/types/store.types"

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  awaiting_confirmation: "Awaiting confirmation",
  paid: "Paid",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
}

export const ORDER_STATUS_TONE: Record<OrderStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  pending_payment: "warning",
  awaiting_confirmation: "warning",
  paid: "info",
  accepted: "info",
  preparing: "info",
  ready: "success",
  out_for_delivery: "info",
  completed: "success",
  cancelled: "danger",
  refunded: "neutral",
}

export const BOARD_STATUSES: OrderStatus[] = ["paid", "accepted", "preparing", "ready", "out_for_delivery"]

/** Customer-facing progress steps. */
export const PROGRESS_STEPS: Array<{ status: OrderStatus; label: string }> = [
  { status: "paid", label: "Paid" },
  { status: "accepted", label: "Accepted" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "out_for_delivery", label: "On the way" },
  { status: "completed", label: "Done" },
]
