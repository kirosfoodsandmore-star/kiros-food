import { Navigate, Outlet, useLocation } from "react-router-dom"
import { PageLoader } from "@/components/shared/PageLoader"
import { useAuth } from "@/contexts/AuthContext"
import { isRiderOnly } from "@/lib/adminHome"

/**
 * Requires a staff session and (optionally) one of the given permissions. Signed-out visitors go to `loginPath`
 * (the admin sign-in by default; the rider portal sends its own people to the rider sign-in).
 */
export function ProtectedRoute({ anyOf, platform = false, loginPath = "/admin/login" }: { anyOf?: string[]; platform?: boolean; loginPath?: string }) {
  const { loading, isAuthenticated, canAny, session, permissions } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader label="Signing you in…" />
  if (!isAuthenticated) return <Navigate to={loginPath} replace state={{ from: location.pathname }} />
  // Riders live in their own portal; the admin shell (and everything in it) isn't for them.
  if (loginPath === "/admin/login" && isRiderOnly(permissions)) return <Navigate to="/rider" replace />
  if (platform && !session?.user.isPlatformAdmin) return <Navigate to="/admin" replace />
  if (anyOf && anyOf.length > 0 && !canAny(...anyOf)) return <Navigate to="/admin" replace />
  return <Outlet />
}
