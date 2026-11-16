// Token persistence. Staff (admin portal) and customers (storefront) have separate token pairs so one
// browser can hold both sessions; the transport picks the pair by URL.
export type TokenKind = "staff" | "customer"

const KEYS: Record<TokenKind, { access: string; refresh: string }> = {
  staff: { access: "kiros.staff.access", refresh: "kiros.staff.refresh" },
  customer: { access: "kiros.customer.access", refresh: "kiros.customer.refresh" },
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* private mode / blocked storage: session simply won't persist */
  }
}

export const tokenStorage = {
  getAccess: (kind: TokenKind) => safeGet(KEYS[kind].access),
  getRefresh: (kind: TokenKind) => safeGet(KEYS[kind].refresh),
  set(kind: TokenKind, access: string, refresh: string) {
    safeSet(KEYS[kind].access, access)
    safeSet(KEYS[kind].refresh, refresh)
  },
  clear(kind: TokenKind) {
    safeSet(KEYS[kind].access, null)
    safeSet(KEYS[kind].refresh, null)
  },
}

/** Generic JSON persistence for non-sensitive UI state. */
export const jsonStorage = {
  get<T>(key: string, fallback: T): T {
    const raw = safeGet(key)
    if (raw === null) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  },
  set<T>(key: string, value: T) {
    safeSet(key, JSON.stringify(value))
  },
  remove(key: string) {
    safeSet(key, null)
  },
}
