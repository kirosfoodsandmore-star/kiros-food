// Staff session for the admin portal: user, permissions, restaurant, can(code).
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react"
import { AuthEndpoints } from "@/endpoints/auth.endpoints"
import { can as canCheck, canAny as canAnyCheck } from "@/lib/can"
import { firebaseSignOut } from "@/lib/firebase"
import { disablePush } from "@/lib/push"
import { disconnectSocket } from "@/lib/socket"
import { tokenStorage } from "@/lib/storage"
import type { LoginResult, Session } from "@/types/admin.types"

interface AuthValue {
  session: Session | null
  loading: boolean
  isAuthenticated: boolean
  permissions: string[]
  can: (code: string) => boolean
  canAny: (...codes: string[]) => boolean
  acceptLogin: (result: LoginResult) => void
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)
export const SESSION_KEY = ["staff-session"]

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const hasToken = Boolean(tokenStorage.getAccess("staff"))
  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const res = await AuthEndpoints.me()
      if (!res.success) {
        if (res.statusCode === 401 || res.statusCode === 403) {
          tokenStorage.clear("staff")
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
      if ((e as CustomEvent<{ kind: string }>).detail?.kind === "staff") qc.setQueryData(SESSION_KEY, null)
    }
    window.addEventListener("kiros:session-expired", onExpired)
    return () => window.removeEventListener("kiros:session-expired", onExpired)
  }, [qc])

  const acceptLogin = useCallback(
    (result: LoginResult) => {
      tokenStorage.set("staff", result.tokens.accessToken, result.tokens.refreshToken)
      qc.setQueryData(SESSION_KEY, { user: result.user, permissions: result.permissions, restaurant: result.restaurant })
    },
    [qc]
  )

  const signOut = useCallback(async () => {
    const refresh = tokenStorage.getRefresh("staff")
    // The next person to sign in on this phone must not get this person's alerts. Needs the session, so it goes first.
    await Promise.race([disablePush(true), new Promise((r) => setTimeout(r, 3000))]).catch(() => undefined)
    if (refresh) void AuthEndpoints.logout(refresh)
    tokenStorage.clear("staff")
    disconnectSocket("staff")
    await firebaseSignOut()
    qc.setQueryData(SESSION_KEY, null)
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "store" })
  }, [qc])

  const permissions = query.data?.permissions ?? []
  const value = useMemo<AuthValue>(
    () => ({
      session: query.data ?? null,
      loading: hasToken && query.isLoading,
      isAuthenticated: Boolean(query.data),
      permissions,
      can: (code) => canCheck(permissions, code),
      canAny: (...codes) => canAnyCheck(permissions, ...codes),
      acceptLogin,
      signOut,
      refresh: async () => {
        await qc.invalidateQueries({ queryKey: SESSION_KEY })
      },
    }),
    [query.data, query.isLoading, hasToken, permissions, acceptLogin, signOut, qc]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
