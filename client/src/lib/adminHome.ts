// Where each kind of staff member lands after signing in. The dashboard is for people who can see it; a rider's
// home is their deliveries and the kitchen's is the live board, so nobody's first screen is one they can't use.
import { NAV_SECTIONS } from "@/components/layout/nav"
import { can as hasPermission } from "@/lib/can"

/**
 * A rider, as opposed to someone who manages orders and also rides: they can deliver but have no dashboard and can't
 * accept or assign orders. They get the simple rider portal instead of the admin screens.
 */
export function isRiderOnly(permissions: readonly string[]): boolean {
  const can = (code: string) => hasPermission(permissions, code)
  return !permissions.includes("*") && can("orders.deliver") && !can("dashboard.view") && !can("orders.update_status") && !can("orders.assign_rider")
}

/** Where someone who came in through the Staff login lands: the live order board, for anyone who works orders. */
export function staffHome(permissions: readonly string[]): string {
  return hasPermission(permissions, "orders.update_status") ? "/admin/live" : adminHome(permissions)
}

export function adminHome(permissions: readonly string[]): string {
  const can = (code: string) => hasPermission(permissions, code)
  if (isRiderOnly(permissions)) return "/rider"
  if (can("dashboard.view")) return "/admin"
  if (can("orders.update_status")) return "/admin/live"
  if (can("orders.deliver")) return "/admin/deliveries"
  if (can("orders.view")) return "/admin/orders"
  // Anything else: the first page in the sidebar they're allowed into, or their own account page.
  const first = NAV_SECTIONS.flatMap((s) => s.items).find((i) => !i.platform && i.anyOf?.some(can))
  return first?.to ?? "/admin/me"
}
