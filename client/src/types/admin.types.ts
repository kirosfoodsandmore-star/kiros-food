// Admin DTOs — mirror server/modules/*/dto for the staff surface.
import type { DeliveryAddress, Fulfilment, OrderStatus, OrderSummary, PaymentMethod, SocialLinks } from "./store.types"

export interface RestaurantProfile {
  /** Branch shown to first-time storefront visitors; null = automatic (the first open branch). */
  defaultBranchId: string | null
  id: string
  name: string
  slug: string
  legalName: string | null
  phone: string | null
  email: string | null
  address: string | null
  logoUrl: string | null
  tagline: string | null
  socialLinks: SocialLinks | null
  currencyCode: string
  currencySymbol: string
  currencyDecimals: number
  timezone: string
  orderPrefix: string
  notifyStaffNewOrders: boolean
  notifyCustomersByEmail: boolean
  isSuspended: boolean
  createdAt: string
}

export interface SessionUser {
  id: string
  name: string
  email: string
  phone: string | null
  roleId: string
  roleKey: string
  roleName: string
  branchIds: string[]
  allBranches: boolean
  isPlatformAdmin: boolean
}

export interface Session {
  user: SessionUser
  permissions: string[]
  restaurant: RestaurantProfile
}

export interface LoginResult extends Session {
  tokens: { accessToken: string; refreshToken: string; expiresIn: number }
}

export interface PermissionDef {
  code: string
  category: string
  label: string
  ownerOnlyDefault: boolean
}

export interface Role {
  id: string
  key: string
  name: string
  description: string | null
  permissions: string[]
  isPreset: boolean
  isLocked: boolean
  memberCount: number
  createdAt: string
}

export interface Staff {
  id: string
  name: string
  email: string
  phone: string | null
  roleId: string
  roleKey: string
  roleName: string
  branchIds: string[]
  branchNames: string[]
  allBranches: boolean
  isActive: boolean
  lastLoginAt: string | null
  lastSeenAt: string | null
  createdAt: string
}

export interface StaffInvite {
  id: string
  email: string
  name: string
  roleId: string
  roleName: string
  branchIds: string[]
  allBranches: boolean
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  invitedByName: string | null
  createdAt: string
  status: "pending" | "accepted" | "revoked" | "expired"
}

export interface Branch {
  id: string
  name: string
  city: string
  address: string
  lat: number | null
  lng: number | null
  phone: string | null
  timezone: string
  isPaused: boolean
  pauseReason: string | null
  deliveryEnabled: boolean
  pickupEnabled: boolean
  prepTimeMinutes: number
  slotIntervalMinutes: number
  paymentMethodOverride: PaymentMethod | null
  isActive: boolean
  sortOrder: number
  menuIds: string[]
  createdAt: string
}

export interface OpeningHourRow {
  weekday: number
  opensAt: string
  closesAt: string
}

export interface HolidayClosure {
  id: string
  date: string
  reason: string | null
}

export interface DeliveryZone {
  id: string
  name: string
  maxDistanceKm: number
  fee: number
  minOrder: number
  freeAboveAmount: number | null
  extraMinutes: number
  isActive: boolean
}

export interface BranchDetail extends Branch {
  hours: OpeningHourRow[]
  closures: HolidayClosure[]
  zones: DeliveryZone[]
}

export interface Menu {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  sortOrder: number
  version: number
  isActive: boolean
  categoryCount: number
  itemCount: number
  branchIds: string[]
  createdAt: string
}

export interface Category {
  id: string
  menuId: string
  name: string
  description: string | null
  imageUrl: string | null
  sortOrder: number
  itemCount: number
}

export interface ItemImage {
  id: string
  url: string
}

export interface Item {
  id: string
  categoryId: string
  categoryName: string
  menuId: string
  name: string
  description: string | null
  basePrice: number
  /** The cover photo (the first of `images`). */
  imageUrl: string | null
  /** Every photo, cover first. */
  images: ItemImage[]
  isFeatured: boolean
  /** Categories this item's page recommends from ("Goes well with"). Empty = the default suggestions. */
  pairsWithCategoryIds: string[]
  isActive: boolean
  sortOrder: number
  optionGroupIds: string[]
  createdAt: string
}

export interface Option {
  id: string
  groupId: string
  name: string
  priceDelta: number
  isActive: boolean
  sortOrder: number
}

export interface OptionGroup {
  id: string
  name: string
  helpText: string | null
  minSelect: number
  maxSelect: number
  sortOrder: number
  options: Option[]
  itemCount?: number
}

export interface SoldOutRow {
  id: string
  branchId: string
  itemId: string | null
  optionId: string | null
  restoreAt: string | null
  updatedAt: string
  name: string
  kind: "item" | "option"
}

export interface PromoCode {
  id: string
  code: string
  type: "percent" | "fixed"
  value: number
  startsAt: string | null
  endsAt: string | null
  maxUses: number | null
  usedCount: number
  maxUsesPerCustomer: number | null
  minSpend: number
  branchId: string | null
  menuId: string | null
  isActive: boolean
  createdAt: string
}

export interface Customer {
  id: string
  phone: string | null
  name: string | null
  email: string | null
  isBlocked: boolean
  blockReason: string | null
  orderCount: number
  totalSpend: number
  lastOrderAt: string | null
  createdAt: string
}

export interface PaymentQueueRow {
  id: string
  orderId: string
  orderNumber: string
  branchId: string
  branchName: string
  customerPhone: string
  customerName: string | null
  amount: number
  reference: string
  status: string
  proofUrl: string | null
  claimNote: string | null
  claimedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export interface BankAccount {
  id: string
  branchId: string | null
  bankName: string
  accountName: string
  accountNumber: string
  isActive: boolean
  sortOrder: number
}

export interface PaymentSettings {
  paystackEnabled: boolean
  transferEnabled: boolean
  paystackPublicKey: string | null
  paystackSecretKeyLast4: string | null
  paystackMode: "test" | "live"
  transferWindowMinutes: number
  transferInstructions: string | null
  secretsStorageReady: boolean
  bankAccounts: BankAccount[]
}

export interface SalesRow {
  key: string
  label: string
  orders: number
  items: number
  subtotal: number
  deliveryFees: number
  discounts: number
  revenue: number
}

export interface SalesTotals {
  orders: number
  revenue: number
  averageOrderValue: number
  items: number
  deliveryOrders: number
  pickupOrders: number
}

export interface SalesReport {
  groupBy: "day" | "branch" | "menu" | "item" | "option"
  from: string
  to: string
  timezone: string
  totals: SalesTotals
  rows: SalesRow[]
}

/** Dashboard totals: revenue and average order are null for people without the sales-report permission. */
export interface DashboardTotals extends Omit<SalesTotals, "revenue" | "averageOrderValue"> {
  revenue: number | null
  averageOrderValue: number | null
}

export interface Dashboard {
  date: string
  timezone: string
  canSeeRevenue: boolean
  today: DashboardTotals
  last30Days: DashboardTotals
  topItemsToday: Array<{ label: string; items: number }>
  liveStatusCounts: Record<string, number>
  branches: Array<{ id: string; name: string; city: string; isActive: boolean; isPaused: boolean; pauseReason: string | null; isOpen: boolean; closesAt: string | null; nextOpenAt: string | null }>
}

export interface AuditLog {
  id: string
  branchId: string | null
  userId: string | null
  userName: string | null
  action: string
  entityType: string
  entityId: string | null
  summary: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

export interface ConversationRow {
  id: string
  orderId: string
  orderNumber: string
  orderStatus: OrderStatus
  branchId: string
  branchName: string
  customerId: string
  customerName: string | null
  customerPhone: string
  lastMessageAt: string | null
  lastMessagePreview: string | null
  lastSenderType: string | null
  staffUnread: number
  customerUnread: number
}

export interface Rider {
  id: string
  name: string
  phone: string | null
  /** Switched on by the rider; off-duty riders can't be given new deliveries. */
  onDuty: boolean
}

export interface PlatformRestaurant {
  id: string
  name: string
  slug: string
  email: string | null
  phone: string | null
  isSuspended: boolean
  branchCount: number
  staffCount: number
  orderCount: number
  paidRevenue: number
  ownerName: string | null
  ownerEmail: string | null
  lastOrderAt: string | null
  createdAt: string
}

export type EmailStatus = "sent" | "failed" | "skipped"

/** One recipient of one email, as the platform admins see it in the email log. Never includes the message text. */
export interface EmailLogRow {
  id: string
  createdAt: string
  organizationId: string | null
  restaurantName: string | null
  to: string
  subject: string
  kind: string | null
  status: EmailStatus
  /** How it went out: "gmail" or "apps_script"; null when nothing was sent. */
  provider: string | null
  /** The error for a failed email, or why it was skipped or went another way. */
  note: string | null
}

export type EmailLogSummary = Record<EmailStatus, number>

/** Switches the platform admins control (Platform → Notification settings). */
export interface PlatformSettings {
  /** New-order alerts reach staff by push and by email; when on, staff the push reached are not emailed the same alert. */
  skipEmailWhenPushDelivered: boolean
}

export interface PlatformOverview {
  restaurants: number
  newThisWeek: number
  staff: number
  customers: number
  ordersLast24h: number
  revenueLast24h: number
}

export interface OnlineUser {
  userId: string
  organizationId: string
  restaurantName: string
  name: string
  email: string
  roleName: string
  onlineSince: string
  lastActiveAt: string
  device: string
  connections: number
}

/** A rider's delivery card: the order summary plus where it's going and what the customer asked for. */
export interface RiderDelivery extends OrderSummary {
  deliveryAddress: DeliveryAddress | null
  note: string | null
  /** When it was marked delivered; set once it is. */
  completedAt: string | null
  /** While waiting for the rider's answer: when time runs out and it is passed to another rider. */
  answerBy: string | null
  /** The customer holds a code the rider must type in to finish this delivery. */
  needsCode: boolean
  /** Wrong guesses left before only the restaurant can complete it. */
  codeAttemptsLeft: number
}

export type OrderFilters = {
  page?: number
  limit?: number
  search?: string
  branchId?: string
  status?: string
  fulfilment?: Fulfilment
  from?: string
  to?: string
  /** Only orders nobody on the team has acted on yet. */
  unhandled?: boolean
}

export type { Fulfilment, OrderStatus, PaymentMethod }
