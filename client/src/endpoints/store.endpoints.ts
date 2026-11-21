// Storefront API: everything under /api/v1/store/:slug.
import { uploadWithFields, wrapCall } from "@/transport/http"
import type {
  Address,
  Cart,
  CheckoutResult,
  ConversationView,
  CustomerLoginResult,
  CustomerSession,
  DeliveryQuote,
  Fulfilment,
  OrderDetail,
  OrderSummary,
  PaymentMethod,
  PaymentMethods,
  Slots,
  StoreBranch,
  StoreItem,
  StoreItemCard,
  StoreMenu,
  StoreMenuSummary,
  StoreProfile,
  TokenPair,
  ChatMessage,
} from "@/types/store.types"

const base = (slug: string) => `/api/v1/store/${encodeURIComponent(slug)}`
const cartHeaders = (token: string) => ({ headers: { "X-Cart-Token": token } })

export const StoreEndpoints = {
  profile: (slug: string) => wrapCall<StoreProfile>("GET", base(slug)),
  branches: (slug: string, params: { lat?: number; lng?: number; q?: string } = {}) => wrapCall<StoreBranch[]>("GET", `${base(slug)}/branches`, params),
  branch: (slug: string, id: string) => wrapCall<StoreBranch>("GET", `${base(slug)}/branches/${id}`),
  slots: (slug: string, branchId: string, params: { fulfilment: Fulfilment; lat?: number; lng?: number }) => wrapCall<Slots>("GET", `${base(slug)}/branches/${branchId}/slots`, params),
  deliveryQuote: (slug: string, branchId: string, params: { lat: number; lng: number; subtotal?: number }) => wrapCall<DeliveryQuote>("GET", `${base(slug)}/branches/${branchId}/delivery-quote`, params),
  menus: (slug: string, branchId: string) => wrapCall<StoreMenuSummary[]>("GET", `${base(slug)}/branches/${branchId}/menus`),
  menu: (slug: string, menuId: string, branchId: string) => wrapCall<StoreMenu>("GET", `${base(slug)}/menus/${menuId}`, { branchId }),
  menuVersion: (slug: string, menuId: string, branchId: string) => wrapCall<{ menuId: string; version: number }>("GET", `${base(slug)}/menus/${menuId}/version`, { branchId }),
  item: (slug: string, itemId: string, branchId: string) => wrapCall<StoreItem>("GET", `${base(slug)}/items/${itemId}`, { branchId }),
  search: (slug: string, params: { branchId: string; q: string; menuId?: string }) => wrapCall<StoreItemCard[]>("GET", `${base(slug)}/search`, params),
  featured: (slug: string, branchId: string) => wrapCall<StoreItemCard[]>("GET", `${base(slug)}/featured`, { branchId }),
  paymentMethods: (slug: string, branchId: string) => wrapCall<PaymentMethods>("GET", `${base(slug)}/branches/${branchId}/payment-methods`),

  // Carts (X-Cart-Token)
  createCart: (slug: string, body: { branchId: string; menuId?: string | null; fulfilment?: Fulfilment }) => wrapCall<Cart>("POST", `${base(slug)}/carts`, body),
  cart: (slug: string, id: string, token: string) => wrapCall<Cart>("GET", `${base(slug)}/carts/${id}`, undefined, cartHeaders(token)),
  updateCart: (slug: string, id: string, token: string, body: Record<string, unknown>) => wrapCall<Cart>("PATCH", `${base(slug)}/carts/${id}`, body, cartHeaders(token)),
  addLine: (slug: string, id: string, token: string, body: { itemId: string; quantity: number; note?: string | null; selectedOptionIds: string[] }) => wrapCall<Cart>("POST", `${base(slug)}/carts/${id}/lines`, body, cartHeaders(token)),
  updateLine: (slug: string, id: string, token: string, lineId: string, body: Record<string, unknown>) => wrapCall<Cart>("PATCH", `${base(slug)}/carts/${id}/lines/${lineId}`, body, cartHeaders(token)),
  removeLine: (slug: string, id: string, token: string, lineId: string) => wrapCall<Cart>("DELETE", `${base(slug)}/carts/${id}/lines/${lineId}`, undefined, cartHeaders(token)),
  clearCart: (slug: string, id: string, token: string) => wrapCall<Cart>("DELETE", `${base(slug)}/carts/${id}/lines`, undefined, cartHeaders(token)),
  applyPromo: (slug: string, id: string, token: string, code: string) => wrapCall<Cart>("POST", `${base(slug)}/carts/${id}/promo`, { code }, cartHeaders(token)),
  removePromo: (slug: string, id: string, token: string) => wrapCall<Cart>("DELETE", `${base(slug)}/carts/${id}/promo`, undefined, cartHeaders(token)),
  switchBranch: (slug: string, id: string, token: string, body: { branchId: string; menuId?: string | null }) => wrapCall<Cart>("POST", `${base(slug)}/carts/${id}/branch`, body, cartHeaders(token)),

  // Customer auth & account
  firebaseSignIn: (slug: string, body: { idToken: string; name?: string; phone?: string }) => wrapCall<CustomerLoginResult>("POST", `${base(slug)}/auth/firebase`, body),
  /** Guest checkout: a fresh anonymous customer session (no phone verification, no lookup of existing accounts). */
  guestSignIn: (slug: string, body: { name: string; email?: string }) => wrapCall<CustomerLoginResult>("POST", `${base(slug)}/auth/guest`, body),
  /** Optional accounts: email a 6-digit code (the same call signs people in and signs them up). */
  emailStart: (slug: string, email: string) => wrapCall<{ sent: true; devCode?: string }>("POST", `${base(slug)}/auth/email/start`, { email }),
  /** Enter the code. If this browser has a guest session, its orders are merged into the account. */
  emailVerify: (slug: string, body: { email: string; code: string; name?: string }) => wrapCall<CustomerLoginResult>("POST", `${base(slug)}/auth/email/verify`, body),
  refresh: (slug: string, refreshToken: string) => wrapCall<TokenPair>("POST", `${base(slug)}/auth/refresh`, { refreshToken }),
  logout: (slug: string, refreshToken: string) => wrapCall<null>("POST", `${base(slug)}/auth/logout`, { refreshToken }),
  me: (slug: string) => wrapCall<CustomerSession>("GET", `${base(slug)}/auth/me`),
  updateMe: (slug: string, body: { name?: string; email?: string | null; phone?: string }) => wrapCall<CustomerSession>("PATCH", `${base(slug)}/auth/me`, body),
  addresses: (slug: string) => wrapCall<Address[]>("GET", `${base(slug)}/addresses`),
  addAddress: (slug: string, body: Record<string, unknown>) => wrapCall<Address[]>("POST", `${base(slug)}/addresses`, body),
  updateAddress: (slug: string, id: string, body: Record<string, unknown>) => wrapCall<Address[]>("PUT", `${base(slug)}/addresses/${id}`, body),
  deleteAddress: (slug: string, id: string) => wrapCall<Address[]>("DELETE", `${base(slug)}/addresses/${id}`),

  // Checkout & orders
  checkout: (slug: string, token: string, body: { cartId: string; paymentMethod: PaymentMethod; name?: string; email?: string | null; note?: string }) =>
    wrapCall<CheckoutResult>("POST", `${base(slug)}/checkout`, body, { ...cartHeaders(token), timeoutMs: 40_000 }),
  orders: (slug: string, params: { page?: number; limit?: number }) => wrapCall<OrderSummary[]>("GET", `${base(slug)}/orders`, params),
  order: (slug: string, id: string) => wrapCall<OrderDetail>("GET", `${base(slug)}/orders/${id}`),
  cancelOrder: (slug: string, id: string) => wrapCall<OrderDetail>("POST", `${base(slug)}/orders/${id}/cancel`),
  reorder: (slug: string, id: string) => wrapCall<Cart>("POST", `${base(slug)}/orders/${id}/reorder`),
  verifyPayment: (slug: string, id: string) => wrapCall<{ status: string; orderStatus: string }>("POST", `${base(slug)}/orders/${id}/payment/verify`, undefined, { timeoutMs: 30_000 }),
  transferClaim: (slug: string, id: string, receipt: File | null, note?: string) => uploadWithFields<OrderDetail>(`${base(slug)}/orders/${id}/transfer-claim`, receipt, { note }, "receipt"),

  // Contact form
  contact: (slug: string, body: { name: string; email: string; phone?: string | null; message: string; website?: string }) => wrapCall<{ sent: true }>("POST", `${base(slug)}/contact`, body),

  // Chat
  chat: (slug: string, orderId: string) => wrapCall<ConversationView>("GET", `${base(slug)}/orders/${orderId}/chat`),
  sendChat: (slug: string, orderId: string, body: string, file?: File | null) =>
    file ? uploadWithFields<ChatMessage>(`${base(slug)}/orders/${orderId}/chat/messages`, file, { body }, "file") : wrapCall<ChatMessage>("POST", `${base(slug)}/orders/${orderId}/chat/messages`, { body }),
}
