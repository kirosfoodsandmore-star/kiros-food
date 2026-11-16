// The admin sidebar links, grouped into collapsible sections. Which sections are collapsed is remembered, and
// the section holding the current page is opened whenever you land on it, so the page you're on is never hidden.
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react"
import { useEffect } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useAttentionOrderCount } from "@/hooks/useAdminOrders"
import { usePersistedState } from "@/hooks/usePersistedState"
import { cn, plural } from "@/lib/utils"
import { NAV_SECTIONS, type NavItem } from "./nav"

export const linkClass = ({ isActive }: { isActive: boolean }) => cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted", isActive && "bg-primary/10 font-medium text-primary")

/** A small count pill. Past 99 it just says 99+. */
export function CountBadge({ count, label, className }: { count: number; label: string; className?: string }) {
  return (
    <span className={cn("min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-primary-foreground", className)} title={label} data-cy="nav-badge">
      <span aria-hidden>{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const { session, canAny } = useAuth()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = usePersistedState<Record<string, boolean>>("kiros.admin.nav.collapsed", {})

  // Counts shown beside links, keyed by the link's path. Only people who can see orders ask for the number.
  // The count is for the branch picked on the admin pages (the same choice the Orders page filters by), so the badge
  // matches the list it leads to; "All branches" counts every one.
  const [branchId] = usePersistedState<string>("kiros.admin.branch", "")
  // (Riders can view orders but have nothing to accept or confirm, so the count isn't for them.)
  const attention = useAttentionOrderCount(canAny("orders.update_status", "orders.reject", "payments.confirm"), branchId).data ?? 0
  const counts: Record<string, { n: number; label: string }> = { "/admin/orders": { n: attention, label: `${plural(attention, "order")} need${attention === 1 ? "s" : ""} attention` } }
  const sectionCount = (items: NavItem[]) => items.reduce((sum, i) => sum + (counts[i.to]?.n ?? 0), 0)

  const visible = (i: NavItem) => (i.platform ? Boolean(session?.user.isPlatformAdmin) : !i.anyOf || canAny(...i.anyOf))
  const sections = NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter(visible) })).filter((s) => s.items.length > 0)

  // Same matching NavLink uses: the dashboard only on its own path, everything else by prefix.
  const isCurrent = (i: NavItem) => (i.to === "/admin" ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`))
  const currentId = sections.find((s) => s.items.some(isCurrent))?.id

  useEffect(() => {
    if (currentId) setCollapsed((c) => (c[currentId] ? { ...c, [currentId]: false } : c))
  }, [currentId, setCollapsed])

  // One control for the whole sidebar: collapse everything, or (once everything is collapsed) open everything again.
  const collapsible = sections.filter((s) => s.label)
  const anyOpen = collapsible.some((s) => !collapsed[s.id])
  const toggleAll = () => setCollapsed((c) => ({ ...c, ...Object.fromEntries(collapsible.map((s) => [s.id, anyOpen])) }))

  return (
    <nav className="flex flex-col gap-1 p-2" data-cy="admin-nav">
      {collapsible.length > 1 ? (
        <button
          type="button"
          onClick={toggleAll}
          className="mb-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-cy="nav-toggle-all"
        >
          {anyOpen ? <ChevronsDownUp className="size-4" aria-hidden /> : <ChevronsUpDown className="size-4" aria-hidden />}
          {anyOpen ? "Collapse all" : "Expand all"}
        </button>
      ) : null}
      {sections.map((s) => {
        if (!s.label) {
          return (
            <div key={s.id} className="flex flex-col gap-0.5">
              {s.items.map((i) => <NavItemLink key={i.to} item={i} count={counts[i.to]} onNavigate={onNavigate} />)}
            </div>
          )
        }
        const open = !collapsed[s.id]
        const waiting = sectionCount(s.items)
        return (
          <div key={s.id} data-cy={`nav-section-${s.id}`}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [s.id]: open }))}
              aria-expanded={open}
              aria-controls={`nav-${s.id}`}
              className="group flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              data-cy={`nav-toggle-${s.id}`}
            >
              <span className="flex items-center gap-2">
                {s.label}
                {/* A collapsed section would otherwise hide that something needs attention inside it. */}
                {!open && waiting > 0 ? <CountBadge count={waiting} label={`${plural(waiting, "order")} need${waiting === 1 ? "s" : ""} attention`} className="normal-case tracking-normal" /> : null}
              </span>
              <ChevronDown className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", !open && "-rotate-90")} aria-hidden />
            </button>
            {/* grid-rows 0fr -> 1fr animates the height; `inert` keeps hidden links out of the tab order. */}
            <div id={`nav-${s.id}`} inert={!open} className={cn("grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              {/* The clip is the outer box (so a collapsed section shows nothing at all); the padding sits inside it, giving focus rings room. */}
              <div className="-mx-1 min-h-0 overflow-hidden">
                <ul className="flex flex-col gap-0.5 p-1">
                  {s.items.map((i) => (
                    <li key={i.to}><NavItemLink item={i} count={counts[i.to]} onNavigate={onNavigate} /></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function NavItemLink({ item, count, onNavigate }: { item: NavItem; count?: { n: number; label: string }; onNavigate?: () => void }) {
  const { can } = useAuth()
  const label = item.labelUnless && !can(item.labelUnless.permission) ? item.labelUnless.label : item.label
  return (
    <NavLink to={item.to} end={item.to === "/admin"} onClick={onNavigate} className={linkClass} data-cy={item.cy}>
      <item.icon className="size-4" />
      {label}
      {count && count.n > 0 ? <CountBadge count={count.n} label={count.label} className="ml-auto" /> : null}
    </NavLink>
  )
}
