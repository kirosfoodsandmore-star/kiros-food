// Customer session for the storefront: Firebase proves identity (phone or Google), the API issues tokens.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react"
import { StoreEndpoints } from "@/endpoints/store.endpoints"
import { firebaseSignOut } from "@/lib/firebase"
import { disconnectSocket } from "@/lib/socket"
import { tokenStorage } from "@/lib/storage"
import { useStoreSession } from "@/stores/storeSession"
import { unwrap } from "@/transport/http"
import type { CustomerLoginResult, CustomerSession } from "@/types/store.types"

interface CustomerValue {
  session: CustomerSession | null
  /** True while the stored token is being checked ("Checking your account…"). */
  checking: boolean
  isSignedIn: boolean
  signInWithIdToken: (idToken: string, extra?: { name?: string; phone?: string }) => Promise<CustomerLoginResult>
  /** Checkout without an account: starts an anonymous session so this browser can pay for, track and chat about the order. */
  startGuest: (name: string, email?: string) => Promise<CustomerLoginResult>
  /** Optional sign-up / sign-in: emails a 6-digit code. (`devCode` comes back only in development, when no email is delivered.) */
  requestEmailCode: (email: string) => Promise<{ sent: true; devCode?: string }>
  /** Completes it. Any guest orders from this browser move into the account. */
  verifyEmailCode: (email: string, code: string, name?: string) => Promise<CustomerLoginResult>
  signOut: () => Promise<void>
  refresh: () => void
}

const CustomerContext = createContext<CustomerValue | null>(null)
export const CUSTOMER_KEY = "customer-session"

export function CustomerProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const qc = useQueryClient()
  const hasToken = Boolean(tokenStorage.getAccess("customer"))
  const query = useQuery({
    queryKey: [CUSTOMER_KEY, slug],
    queryFn: async () => {
      const res = await StoreEndpoints.me(slug)
      if (!res.success) {
        if (res.statusCode === 401 || res.statusCode === 403) {
          tokenStorage.clear("customer")
          return null
        }
        throw new Error(res.message)
      }
      return res.data
    },
    enabled: hasToken,
    staleTime: 5 * 60_000,
    retry: false,
  })

  useEffect(() => {
    const onExpired = (e: Event) => {
      if ((e as CustomEvent<{ kind: string }>).detail?.kind === "customer") qc.setQueryData([CUSTOMER_KEY, slug], null)
    }
    window.addEventListener("kiros:session-expired", onExpired)
    return () => window.removeEventListener("kiros:session-expired", onExpired)
  }, [qc, slug])

  const signInWithIdToken = useCallback(
    async (idToken: string, extra: { name?: string; phone?: string } = {}) => {
      const result = unwrap(await StoreEndpoints.firebaseSignIn(slug, { idToken, ...extra }))
      tokenStorage.set("customer", result.tokens.accessToken, result.tokens.refreshToken)
      qc.setQueryData([CUSTOMER_KEY, slug], { customer: result.customer, addresses: result.addresses })
      // Attach any guest cart to the account on the next cart call.
      const { cartId, cartToken } = useStoreSession.getState()
      if (cartId && cartToken) void StoreEndpoints.updateCart(slug, cartId, cartToken, { phone: result.customer.phone ?? undefined }).then(() => qc.invalidateQueries({ queryKey: ["store", slug, "cart"] }))
      return result
    },
    [qc, slug]
  )

  const startGuest = useCallback(
    async (name: string, email?: string) => {
      const result = unwrap(await StoreEndpoints.guestSignIn(slug, { name, ...(email ? { email } : {}) }))
      tokenStorage.set("customer", result.tokens.accessToken, result.tokens.refreshToken)
      qc.setQueryData([CUSTOMER_KEY, slug], { customer: result.customer, addresses: result.addresses })
      return result
    },
    [qc, slug]
  )

  const requestEmailCode = useCallback(async (email: string) => unwrap(await StoreEndpoints.emailStart(slug, email)), [slug])

  const verifyEmailCode = useCallback(
    async (email: string, code: string, name?: string) => {
      const result = unwrap(await StoreEndpoints.emailVerify(slug, { email, code, ...(name ? { name } : {}) }))
      tokenStorage.set("customer", result.tokens.accessToken, result.tokens.refreshToken)
      qc.setQueryData([CUSTOMER_KEY, slug], { customer: result.customer, addresses: result.addresses })
      // The live socket still belongs to the old (guest) record; reconnect as the account, and refetch what changed hands.
      disconnectSocket("customer")
      void qc.invalidateQueries({ queryKey: ["store", slug] })
      return result
    },
    [qc, slug]
  )

  const signOut = useCallback(async () => {
    const refresh = tokenStorage.getRefresh("customer")
    if (refresh) void StoreEndpoints.logout(slug, refresh)
    tokenStorage.clear("customer")
    disconnectSocket("customer")
    await firebaseSignOut()
    qc.setQueryData([CUSTOMER_KEY, slug], null)
    void qc.removeQueries({ queryKey: ["store", slug, "orders"] })
  }, [qc, slug])

  const value = useMemo<CustomerValue>(
    () => ({
      session: query.data ?? null,
      checking: hasToken && query.isLoading,
      isSignedIn: Boolean(query.data),
      signInWithIdToken,
      startGuest,
      requestEmailCode,
      verifyEmailCode,
      signOut,
      refresh: () => void qc.invalidateQueries({ queryKey: [CUSTOMER_KEY, slug] }),
    }),
    [query.data, query.isLoading, hasToken, signInWithIdToken, startGuest, requestEmailCode, verifyEmailCode, signOut, qc, slug]
  )
  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>
}

export function useCustomer(): CustomerValue {
  const ctx = useContext(CustomerContext)
  if (!ctx) throw new Error("useCustomer must be used inside CustomerProvider")
  return ctx
}
