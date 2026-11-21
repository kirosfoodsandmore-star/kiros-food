// Domain constants shared by validators, services, seeds and the lifecycle state machines.

export const FULFILMENTS = ["delivery", "pickup"] as const;
export type Fulfilment = (typeof FULFILMENTS)[number];
/** A rider's answer to a delivery they were given. */
export type RiderResponse = "pending" | "accepted";

export const PAYMENT_METHODS = ["paystack", "transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYSTACK_MODES = ["test", "live"] as const;
export type PaystackMode = (typeof PAYSTACK_MODES)[number];

export const ORDER_STATUSES = [
  "pending_payment",
  "awaiting_confirmation",
  "paid",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Orders the kitchen works on (the live board columns). */
export const BOARD_STATUSES = ["paid", "accepted", "preparing", "ready", "out_for_delivery"] as const satisfies readonly OrderStatus[];

export const PAYMENT_STATUSES = ["pending", "claimed", "paid", "failed", "rejected", "expired", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PROMO_TYPES = ["percent", "fixed"] as const;
export type PromoType = (typeof PROMO_TYPES)[number];

export const ACTOR_TYPES = ["staff", "customer", "system"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const CHAT_AUTHOR_TYPES = ["staff", "customer"] as const;
export type ChatAuthorType = (typeof CHAT_AUTHOR_TYPES)[number];

export const EXPORT_FORMATS = ["json", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const REPORT_GROUPINGS = ["day", "branch", "menu", "item", "option"] as const;
export type ReportGrouping = (typeof REPORT_GROUPINGS)[number];

/** How many photos a menu item can carry (the first is the cover). */
export const MAX_ITEM_PHOTOS = 8;

/** Storage folders, one per domain (Cloudinary). */
export const STORAGE_FOLDERS = {
  logo: "kiros/branding",
  item: "kiros/items",
  category: "kiros/categories",
  receipt: "kiros/transfer-receipts",
  chat: "kiros/chat-attachments",
} as const;

/** Firestore collections (server-mediated writes only — see ai_agent_flow_firebase.md). */
export const FIRESTORE_COLLECTIONS = {
  orderChatMessages: "orderChatMessages",
} as const;

/** Amounts are integers in the currency's minor unit (kobo for NGN). 10^13 = ₦100bn. */
export const MAX_MONEY = 10_000_000_000_000;

/** Carts that have not been touched for this long are purged. */
export const CART_TTL_DAYS = 7;

/** Default minutes a customer has to send a bank transfer before the order expires. */
export const DEFAULT_TRANSFER_WINDOW_MINUTES = 30;

/** Unpaid Paystack orders expire after this many minutes. */
export const PAYSTACK_PENDING_TTL_MINUTES = 60;

/** How many days ahead a customer may schedule an order. */
export const SCHEDULE_DAYS_AHEAD = 3;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
