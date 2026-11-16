// The rider's sidebar: just the three things a rider needs. It sits in the same shell as the admin sidebar
// (AdminLayout with portal="rider"), so it looks and behaves the same way, but offers none of the admin screens.
import { Bike, CheckCircle2, User } from "lucide-react"
import { NavLink } from "react-router-dom"
import { OnDutySwitch } from "@/components/rider/OnDutySwitch"
import { useMyDeliveries } from "@/hooks/useAdminOrders"
import { plural } from "@/lib/utils"
import { CountBadge, linkClass } from "./AdminNav"

export function RiderNav({ onNavigate }: { onNavigate?: () => void }) {
  const { data: active } = useMyDeliveries()
  const waiting = active?.length ?? 0
  const items = [
    { to: "/rider", label: "Deliveries", icon: Bike, end: true, cy: "rider-nav-deliveries" },
    { to: "/rider/done", label: "Delivered", icon: CheckCircle2, end: false, cy: "rider-nav-done" },
    { to: "/rider/account", label: "My account", icon: User, end: false, cy: "rider-nav-account" },
  ]
  return (
    <nav className="flex flex-col gap-0.5 p-2" data-cy="rider-nav">
      <OnDutySwitch variant="compact" className="mx-0 mb-2" />
      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rider</p>
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate} className={linkClass} data-cy={i.cy}>
          <i.icon className="size-4" />
          {i.label}
          {i.to === "/rider" && waiting > 0 ? <CountBadge count={waiting} label={`${plural(waiting, "delivery", "deliveries")} assigned to you`} className="ml-auto" /> : null}
        </NavLink>
      ))}
    </nav>
  )
}
