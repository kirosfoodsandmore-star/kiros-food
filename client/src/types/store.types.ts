// Storefront DTOs — mirror server/modules/*/dto for the public + customer surface.
export type Fulfilment = "delivery" | "pickup"
export type PaymentMethod = "paystack" | "transfer"
export type OrderStatus =
  | "pending_payment"
  | "awaiting_confirmation"
  | "paid"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "refunded"

export interface SocialLinks {
  instagram?: string | null
  facebook?: string | null
  twitter?: string | null
  tiktok?: string | null
  whatsapp?: string | null
}

export interface StoreProfile {
  /** Branch shown to first-time visitors; null lets the storefront pick an open one. */
  defaultBranchId: string | null
  id: string
  name: string
  slug: string
  logoUrl: string | null
  tagline: string | null
  phone: string | null
  email: string | null
  address: string | null
  socialLinks: SocialLinks | null
  currencyCode: string
  currencySymbol: string
  currencyDecimals: number
  timezone: string
}

export interface OpeningHour {
  weekday: number
  opensAt: string
  closesAt: string
}

export interface StoreMenuSummary {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  version?: number
}

export interface StoreBranch {
  id: string
  name: string
  city: string
  address: string
  lat: number | null
  lng: number | null
  phone: string | null
  timezone: string
  deliveryEnabled: boolean
  pickupEnabled: boolean
  isOpen: boolean
  isPaused: boolean
  closesAt: string | null
  nextOpenAt: string | null
  distanceKm: number | null
  hours: OpeningHour[]
  menus: StoreMenuSummary[]
}

export interface StoreOption {
  id: string
  name: string
  priceDelta: number
  isAvailable: boolean
}

export interface StoreOptionGroup {
  id: string
  name: string
  helpText: string | null
  minSelect: number
  maxSelect: number
  required: boolean
  options: StoreOption[]
}

export interface StoreItemCard {
  id: string
  categoryId: string
  name: string
  description: string | null
  basePrice: number
  fromPrice: number
  hasPricedVariants: boolean
  imageUrl: string | null
  isFeatured: boolean
  isAvailable: boolean
  optionGroupCount: number
}

export interface StoreItem extends StoreItemCard {
  /** Photo URLs for the gallery, cover first. Empty when the item has none. */
  images: string[]
  categoryName: string
  menuId: string
  menuName: string
  optionGroups: StoreOptionGroup[]
  recommendations: StoreItemCard[]
}

export interface StoreCategory {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  items: StoreItemCard[]
}

export interface StoreMenu {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  version: number
  branchId: string
  categories: StoreCategory[]
}

export interface SlotDay {
  date: string
  slots: Array<{ at: string; label: string }>
}

export interface Slots {
  asapAvailable: boolean
  days: SlotDay[]
}

export interface DeliveryQuote {
  deliverable: boolean
  zoneId: string | null
  zoneName: string | null
  distanceKm: number
  fee: number
  minOrder: number
  freeAboveAmount: number | null
  extraMinutes: number
  reason: string | null
}

export interface LineWarning {
  lineId: string
  code: "item_unavailable" | "item_sold_out" | "option_sold_out" | "option_invalid" | "group_rule"
  message: string
  canChangeOption: boolean
}

export interface LineOption {
  optionId: string
  groupId: string
  groupName: string
  name: string
  priceDelta: number
}

export interface CartLine {
  id: string
  itemId: string
  itemName: string
  categoryName: string | null
  imageUrl: string | null
  quantity: number
  note: string | null
  unitPrice: number
  lineTotal: number
  options: LineOption[]
  optionSummary: string
  warnings: LineWarning[]
}

export interface DeliveryAddress {
  line: string
  lat: number | null
  lng: number | null
  instructions?: string | null
}

export interface Cart {
  id: string
  token?: string
  branchId: string
  branchName: string
  menuId: string | null
  fulfilment: Fulfilment
  scheduledFor: string | null
  promoCode: string | null
  deliveryAddress: DeliveryAddress | null
  phone: string | null
  lines: CartLine[]
  itemCount: number
  warnings: LineWarning[]
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  promo: { applied: boolean; reason: string | null }
  delivery: DeliveryQuote | null
  branch: { isOpen: boolean; isPaused: boolean; nextOpenAt: string | null; deliveryEnabled: boolean; pickupEnabled: boolean }
  blockers: string[]
  expiresAt: string
}

export interface Address {
  id: string
  label: string | null
  line: string
  lat: number | null
  lng: number | null
  instructions: string | null
  isDefault: boolean
}

export interface CustomerSession {
  /** `guest`: placed an order without signing in; this browser's session is the way back to those orders. */
  customer: { id: string; phone: string | null; name: string | null; email: string | null; guest?: boolean }
  addresses: Address[]
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface CustomerLoginResult extends CustomerSession {
  tokens: TokenPair
}

export interface PaymentMethods {
  methods: PaymentMethod[]
  paystackPublicKey: string | null
  bankAccounts: BankAccountPublic[]
}

export interface BankAccountPublic {
  id: string
  bankName: string
  accountName: string
  accountNumber: string
}

export interface OrderLine {
  id: string
  itemId: string | null
  itemName: string
  categoryName: string | null
  imageUrl: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  note: string | null
  options: LineOption[]
}

export interface OrderEvent {
  id: string
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  actorType: "staff" | "customer" | "system"
  actorName: string | null
  note: string | null
  createdAt: string
}

export interface OrderPayment {
  id: string
  method: PaymentMethod
  status: "pending" | "claimed" | "paid" | "failed" | "rejected" | "expired" | "refunded"
  amount: number
  reference: string
  authorizationUrl: string | null
  proofUrl: string | null
  claimedAt: string | null
  expiresAt: string | null
  paidAt: string | null
  rejectReason: string | null
  refundAmount: number | null
  refundedAt: string | null
}

export interface OrderSummary {
  id: string
  number: string
  branchId: string
  branchName: string
  customerId: string
  customerPhone: string
  customerName: string | null
  fulfilment: Fulfilment
  scheduledFor: string | null
  status: OrderStatus
  paymentMethod: PaymentMethod
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  itemCount: number
  riderId: string | null
  riderName: string | null
  /** "pending" until the rider answers, "accepted" after; null on older assignments (treat as accepted). */
  riderResponse: "pending" | "accepted" | null
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

export interface OrderDetail extends OrderSummary {
  menuId: string | null
  deliveryAddress: DeliveryAddress | null
  customerEmail: string | null
  promoCode: string | null
  note: string | null
  cancelReason: string | null
  refundNote: string | null
  acceptedAt: string | null
  readyAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  refundedAt: string | null
  expiresAt: string | null
  lines: OrderLine[]
  events: OrderEvent[]
  payment: OrderPayment | null
  /** Only while the order is on its way: the code to read out to the rider as proof you received it. */
  deliveryCode?: string | null
  nextStatuses?: OrderStatus[]
  branch: { name: string; address: string; phone: string | null; timezone: string }
}

export type CheckoutResult =
  | { order: OrderDetail; payment: { method: "paystack"; authorizationUrl: string; reference: string; publicKey: string | null } }
  | {
      order: OrderDetail
      payment: { method: "transfer"; reference: string; amount: number; bankAccounts: BankAccountPublic[]; instructions: string | null; deadline: string }
    }

/** A photo or PDF sent in the conversation. */
export interface ChatAttachment {
  url: string
  name: string
  mimeType: string
  bytes: number
}

export interface ChatMessage {
  id: string
  conversationId: string
  orderId: string
  authorType: "staff" | "customer"
  authorId: string
  authorName: string
  /** Empty when the message is only an attachment. */
  body: string
  /** Absent on messages from before attachments existed. */
  attachment?: ChatAttachment | null
  createdAt: string | null
}

export interface ConversationView {
  conversationId: string
  orderId: string
  orderNumber: string
  branchId: string
  unread: number
  firestore: { collection: string; field: "conversationId" }
  messages: ChatMessage[]
}
