// Admin portal API: /api/v1/admin/* and /api/v1/platform/*.
import { downloadFile, uploadFiles, uploadWithFields, wrapCall } from "@/transport/http"
import type {
  AuditLog,
  BankAccount,
  Branch,
  BranchDetail,
  Category,
  ConversationRow,
  Customer,
  Dashboard,
  DeliveryZone,
  RiderDelivery,
  HolidayClosure,
  Item,
  Menu,
  OnlineUser,
  OpeningHourRow,
  OptionGroup,
  OrderFilters,
  PaymentQueueRow,
  PaymentSettings,
  PermissionDef,
  PlatformOverview,
  PlatformRestaurant,
  PromoCode,
  RestaurantProfile,
  Rider,
  Role,
  SalesReport,
  SoldOutRow,
  Staff,
  StaffInvite,
} from "@/types/admin.types"
import type { ConversationView, ChatMessage, OrderDetail, OrderStatus, OrderSummary } from "@/types/store.types"

const A = "/api/v1/admin"
type Body = Record<string, unknown>

export const AccessEndpoints = {
  permissions: () => wrapCall<PermissionDef[]>("GET", `${A}/permissions`),
  roles: () => wrapCall<Role[]>("GET", `${A}/roles`),
  createRole: (body: Body) => wrapCall<Role>("POST", `${A}/roles`, body),
  updateRole: (id: string, body: Body) => wrapCall<Role>("PUT", `${A}/roles/${id}`, body),
  deleteRole: (id: string) => wrapCall<null>("DELETE", `${A}/roles/${id}`),
}

export const StaffEndpoints = {
  list: (params: Body) => wrapCall<Staff[]>("GET", `${A}/staff`, params),
  invites: () => wrapCall<StaffInvite[]>("GET", `${A}/staff/invites`),
  invite: (body: Body) => wrapCall<StaffInvite>("POST", `${A}/staff/invite`, body),
  resendInvite: (id: string) => wrapCall<null>("POST", `${A}/staff/invites/${id}/resend`),
  revokeInvite: (id: string) => wrapCall<null>("DELETE", `${A}/staff/invites/${id}`),
  update: (id: string, body: Body) => wrapCall<Staff>("PUT", `${A}/staff/${id}`, body),
  deactivate: (id: string) => wrapCall<Staff>("POST", `${A}/staff/${id}/deactivate`),
  activate: (id: string) => wrapCall<Staff>("POST", `${A}/staff/${id}/activate`),
  transferOwnership: (body: { userId: string; password: string }) => wrapCall<null>("POST", `${A}/staff/transfer-ownership`, body),
}

export const SettingsEndpoints = {
  get: () => wrapCall<RestaurantProfile>("GET", `${A}/settings`),
  update: (body: Body) => wrapCall<RestaurantProfile>("PUT", `${A}/settings`, body),
  payments: () => wrapCall<PaymentSettings>("GET", `${A}/settings/payments`),
  updatePayments: (body: Body) => wrapCall<PaymentSettings>("PUT", `${A}/settings/payments`, body),
  testPaystack: () => wrapCall<{ ok: true; integration: string | null; mode: string }>("POST", `${A}/settings/payments/test`, undefined, { timeoutMs: 30_000 }),
  addBankAccount: (body: Body) => wrapCall<BankAccount[]>("POST", `${A}/settings/payments/bank-accounts`, body),
  updateBankAccount: (id: string, body: Body) => wrapCall<BankAccount[]>("PUT", `${A}/settings/payments/bank-accounts/${id}`, body),
  deleteBankAccount: (id: string) => wrapCall<BankAccount[]>("DELETE", `${A}/settings/payments/bank-accounts/${id}`),
}

export const BranchEndpoints = {
  list: () => wrapCall<Branch[]>("GET", `${A}/branches`),
  get: (id: string) => wrapCall<BranchDetail>("GET", `${A}/branches/${id}`),
  create: (body: Body) => wrapCall<Branch>("POST", `${A}/branches`, body),
  update: (id: string, body: Body) => wrapCall<Branch>("PUT", `${A}/branches/${id}`, body),
  remove: (id: string) => wrapCall<null>("DELETE", `${A}/branches/${id}`),
  removeMany: (ids: string[]) => wrapCall<{ deleted: number }>("POST", `${A}/branches/bulk-delete`, { ids }),
  pause: (id: string, paused: boolean, reason?: string | null) => wrapCall<Branch>("POST", `${A}/branches/${id}/pause`, { paused, reason }),
  setHours: (id: string, hours: OpeningHourRow[]) => wrapCall<OpeningHourRow[]>("PUT", `${A}/branches/${id}/hours`, { hours }),
  addClosure: (id: string, body: { date: string; reason?: string | null }) => wrapCall<HolidayClosure>("POST", `${A}/branches/${id}/closures`, body),
  removeClosure: (id: string, closureId: string) => wrapCall<null>("DELETE", `${A}/branches/${id}/closures/${closureId}`),
  createZone: (id: string, body: Body) => wrapCall<DeliveryZone[]>("POST", `${A}/branches/${id}/zones`, body),
  updateZone: (id: string, zoneId: string, body: Body) => wrapCall<DeliveryZone[]>("PUT", `${A}/branches/${id}/zones/${zoneId}`, body),
  deleteZone: (id: string, zoneId: string) => wrapCall<null>("DELETE", `${A}/branches/${id}/zones/${zoneId}`),
}

export const MenuEndpoints = {
  menus: () => wrapCall<Menu[]>("GET", `${A}/menus`),
  createMenu: (body: Body) => wrapCall<Menu>("POST", `${A}/menus`, body),
  updateMenu: (id: string, body: Body) => wrapCall<Menu>("PUT", `${A}/menus/${id}`, body),
  deleteMenu: (id: string) => wrapCall<null>("DELETE", `${A}/menus/${id}`),
  uploadMenuImage: (id: string, file: File) => uploadWithFields<Menu>(`${A}/menus/${id}/image`, file, {}, "image"),
  reorderMenus: (ids: string[]) => wrapCall<Menu[]>("POST", `${A}/menus/reorder`, { ids }),
  categories: (menuId?: string) => wrapCall<Category[]>("GET", `${A}/categories`, menuId ? { menuId } : undefined),
  createCategory: (body: Body) => wrapCall<Category>("POST", `${A}/categories`, body),
  updateCategory: (id: string, body: Body) => wrapCall<Category>("PUT", `${A}/categories/${id}`, body),
  deleteCategory: (id: string) => wrapCall<null>("DELETE", `${A}/categories/${id}`),
  reorderCategories: (ids: string[]) => wrapCall<null>("POST", `${A}/categories/reorder`, { ids }),
  items: (params: Body = {}) => wrapCall<Item[]>("GET", `${A}/items`, params),
  createItem: (body: Body) => wrapCall<Item>("POST", `${A}/items`, body),
  updateItem: (id: string, body: Body) => wrapCall<Item>("PUT", `${A}/items/${id}`, body),
  deleteItem: (id: string) => wrapCall<null>("DELETE", `${A}/items/${id}`),
  addItemPhotos: (id: string, files: File[]) => uploadFiles<Item>(`${A}/items/${id}/photos`, files, "photos"),
  removeItemPhoto: (id: string, photoId: string) => wrapCall<Item>("DELETE", `${A}/items/${id}/photos/${photoId}`),
  /** `ids` is every photo of the item in the wanted order; the first becomes the cover. */
  reorderItemPhotos: (id: string, ids: string[]) => wrapCall<Item>("PUT", `${A}/items/${id}/photos/order`, { ids }),
  reorderItems: (ids: string[]) => wrapCall<null>("POST", `${A}/items/reorder`, { ids }),
  groups: () => wrapCall<OptionGroup[]>("GET", `${A}/option-groups`),
  createGroup: (body: Body) => wrapCall<OptionGroup>("POST", `${A}/option-groups`, body),
  updateGroup: (id: string, body: Body) => wrapCall<OptionGroup>("PUT", `${A}/option-groups/${id}`, body),
  deleteGroup: (id: string) => wrapCall<null>("DELETE", `${A}/option-groups/${id}`),
  duplicateGroup: (id: string) => wrapCall<OptionGroup>("POST", `${A}/option-groups/${id}/duplicate`),
  createOption: (groupId: string, body: Body) => wrapCall<OptionGroup>("POST", `${A}/option-groups/${groupId}/options`, body),
  updateOption: (groupId: string, optionId: string, body: Body) => wrapCall<OptionGroup>("PUT", `${A}/option-groups/${groupId}/options/${optionId}`, body),
  deleteOption: (groupId: string, optionId: string) => wrapCall<OptionGroup>("DELETE", `${A}/option-groups/${groupId}/options/${optionId}`),
}

export const AvailabilityEndpoints = {
  list: (branchId?: string) => wrapCall<SoldOutRow[]>("GET", `${A}/availability`, branchId ? { branchId } : undefined),
  set: (body: { branchId: string; itemId?: string; optionId?: string; isAvailable: boolean; restoreAt?: string | null }) => wrapCall<SoldOutRow[]>("PUT", `${A}/availability`, body),
  setMany: (body: { branchId: string; targets: Array<{ itemId?: string; optionId?: string }>; isAvailable: boolean; restoreAt?: string | null }) => wrapCall<SoldOutRow[]>("PUT", `${A}/availability/bulk`, body),
}

export const PromoEndpoints = {
  list: (params: { page?: number; limit?: number; search?: string } = {}) => wrapCall<PromoCode[]>("GET", `${A}/promos`, params),
  create: (body: Body) => wrapCall<PromoCode>("POST", `${A}/promos`, body),
  update: (id: string, body: Body) => wrapCall<PromoCode>("PUT", `${A}/promos/${id}`, body),
  remove: (id: string) => wrapCall<null>("DELETE", `${A}/promos/${id}`),
}

export const CustomerEndpoints = {
  list: (params: Body) => wrapCall<Customer[]>("GET", `${A}/customers`, params),
  get: (id: string) => wrapCall<Customer>("GET", `${A}/customers/${id}`),
  block: (id: string, reason?: string) => wrapCall<Customer>("POST", `${A}/customers/${id}/block`, { reason }),
  unblock: (id: string) => wrapCall<Customer>("POST", `${A}/customers/${id}/unblock`),
}

/** Push notifications (FCM): this device's token, so the server can reach it. */
export const PushEndpoints = {
  status: () => wrapCall<{ enabled: boolean; devices: number }>("GET", `${A}/push/status`),
  register: (token: string) => wrapCall<null>("PUT", `${A}/push/token`, { token }),
  unregister: (token: string) => wrapCall<null>("DELETE", `${A}/push/token`, { token }),
}

export const OrderEndpoints = {
  list: (params: OrderFilters) => wrapCall<OrderSummary[]>("GET", `${A}/orders`, params as Body),
  board: (branchId?: string) => wrapCall<Record<string, OrderSummary[]>>("GET", `${A}/orders/board`, branchId ? { branchId } : undefined),
  /** What's still to deliver, or (with `done`) what I delivered in the last 24 hours. */
  myDeliveries: (done = false) => wrapCall<RiderDelivery[]>("GET", `${A}/orders/my-deliveries`, done ? { done: true } : undefined),
  /** The rider's own on/off-duty switch. */
  myAvailability: () => wrapCall<{ onDuty: boolean }>("GET", `${A}/orders/my-availability`),
  setMyAvailability: (onDuty: boolean) => wrapCall<{ onDuty: boolean }>("PUT", `${A}/orders/my-availability`, { onDuty }),
  get: (id: string) => wrapCall<OrderDetail>("GET", `${A}/orders/${id}`),
  riders: (id: string) => wrapCall<Rider[]>("GET", `${A}/orders/${id}/riders`),
  changeStatus: (id: string, status: OrderStatus, note?: string | null, code?: string) => wrapCall<OrderDetail>("POST", `${A}/orders/${id}/status`, { status, note, code }),
  /** The assigned rider accepts a delivery, or gives it back (with an optional reason for the manager). */
  respond: (id: string, action: "accept" | "decline", reason?: string) => wrapCall<{ response: "accepted" | "declined" }>("POST", `${A}/orders/${id}/respond`, { action, reason }),
  reject: (id: string, reason: string) => wrapCall<OrderDetail>("POST", `${A}/orders/${id}/reject`, { reason }),
  refund: (id: string, body: { amount?: number; note: string }) => wrapCall<OrderDetail>("POST", `${A}/orders/${id}/refund`, body, { timeoutMs: 30_000 }),
  assignRider: (id: string, riderId: string | null) => wrapCall<OrderDetail>("POST", `${A}/orders/${id}/assign-rider`, { riderId }),
}

export const PaymentEndpoints = {
  queue: (params: { branchId?: string; status?: "claimed" | "pending" | "all"; page?: number; limit?: number } = {}) => wrapCall<PaymentQueueRow[]>("GET", `${A}/payments`, params),
  confirm: (id: string) => wrapCall<OrderDetail>("POST", `${A}/payments/${id}/confirm`),
  reject: (id: string, reason: string) => wrapCall<OrderDetail>("POST", `${A}/payments/${id}/reject`, { reason }),
}

export const ChatEndpoints = {
  conversations: (params: { branchId?: string; unreadOnly?: boolean; page?: number; limit?: number } = {}) => wrapCall<ConversationRow[]>("GET", `${A}/chat/conversations`, params),
  open: (orderId: string) => wrapCall<ConversationView>("GET", `${A}/chat/orders/${orderId}`),
  send: (orderId: string, body: string, file?: File | null) =>
    file ? uploadWithFields<ChatMessage>(`${A}/chat/orders/${orderId}/messages`, file, { body }, "file") : wrapCall<ChatMessage>("POST", `${A}/chat/orders/${orderId}/messages`, { body }),
}

export const ReportEndpoints = {
  sales: (params: Body) => wrapCall<SalesReport>("GET", `${A}/reports/sales`, params),
  exportSales: (params: Body, filename: string) => downloadFile(`${A}/reports/sales`, filename, { ...params, format: "csv" }),
  dashboard: (branchId?: string) => wrapCall<Dashboard>("GET", `${A}/dashboard`, branchId ? { branchId } : undefined),
  audit: (params: Body) => wrapCall<AuditLog[]>("GET", `${A}/audit-logs`, params),
}

export const PlatformEndpoints = {
  overview: () => wrapCall<PlatformOverview>("GET", "/api/v1/platform/overview"),
  restaurants: (params: Body) => wrapCall<PlatformRestaurant[]>("GET", "/api/v1/platform/restaurants", params),
  online: () => wrapCall<OnlineUser[]>("GET", "/api/v1/platform/online"),
  suspend: (id: string) => wrapCall<null>("POST", `/api/v1/platform/restaurants/${id}/suspend`),
  unsuspend: (id: string) => wrapCall<null>("POST", `/api/v1/platform/restaurants/${id}/unsuspend`),
}
