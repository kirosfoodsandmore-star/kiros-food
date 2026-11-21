import { Activity, BarChart3, Bike, Building2, ClipboardList, CreditCard, Globe, LayoutDashboard, ListChecks, Mail, MessageSquare, PackageX, Settings, ShieldCheck, Tag, UserCog, Users, UtensilsCrossed } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Any of these permissions shows the item. */
  anyOf?: string[]
  platform?: boolean
  /** Shown instead of `label` to anyone who lacks this permission. */
  labelUnless?: { permission: string; label: string }
  cy: string
}

export interface NavSection {
  /** Stable key, used to remember whether the section is collapsed. */
  id: string
  /** Heading shown above the links. Without one the links sit loose at the top and can't be collapsed. */
  label?: string
  items: NavItem[]
}

/** The admin sidebar, grouped by what people are doing: serving orders, managing the menu, running the business, administering. */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "home",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, anyOf: ["dashboard.view"], cy: "nav-dashboard" }],
  },
  {
    id: "orders",
    label: "Orders",
    items: [
      { to: "/admin/live", label: "Live orders", icon: Activity, anyOf: ["orders.view"], cy: "nav-live" },
      { to: "/admin/orders", label: "Orders", icon: ClipboardList, anyOf: ["orders.view"], cy: "nav-orders" },
      { to: "/admin/deliveries", label: "My deliveries", icon: Bike, anyOf: ["orders.deliver"], cy: "nav-deliveries" },
      { to: "/admin/payments", label: "Payments to confirm", icon: CreditCard, anyOf: ["payments.view"], cy: "nav-payments" },
      { to: "/admin/chat", label: "Chat", icon: MessageSquare, anyOf: ["chat.view"], cy: "nav-chat" },
    ],
  },
  {
    id: "menu",
    label: "Menu",
    items: [
      { to: "/admin/menus", label: "Menus", icon: UtensilsCrossed, anyOf: ["menu.view"], cy: "nav-menus" },
      { to: "/admin/option-groups", label: "Option groups", icon: ListChecks, anyOf: ["menu.view"], cy: "nav-option-groups" },
      { to: "/admin/availability", label: "Availability", icon: PackageX, anyOf: ["availability.view"], cy: "nav-availability" },
      { to: "/admin/promos", label: "Promo codes", icon: Tag, anyOf: ["promos.view"], cy: "nav-promos" },
    ],
  },
  {
    id: "business",
    label: "Business",
    items: [
      { to: "/admin/branches", label: "Branches", icon: Building2, anyOf: ["branches.view"], cy: "nav-branches" },
      { to: "/admin/customers", label: "Customers", icon: Users, anyOf: ["customers.view"], cy: "nav-customers" },
      { to: "/admin/reports", label: "Reports", icon: BarChart3, anyOf: ["reports.view"], cy: "nav-reports" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { to: "/admin/staff", label: "Staff & roles", labelUnless: { permission: "staff.manage", label: "Staff" }, icon: UserCog, anyOf: ["staff.view"], cy: "nav-staff" },
      { to: "/admin/settings", label: "Settings", icon: Settings, anyOf: ["settings.view"], cy: "nav-settings" },
      { to: "/admin/audit", label: "Audit log", icon: ShieldCheck, anyOf: ["audit.view"], cy: "nav-audit" },
    ],
  },
  // Everything only platform admins can open lives here, together. The whole section stays out of sight for everyone else
  // (a section with no visible links isn't drawn), and a new platform page is added by listing it below.
  {
    id: "platform",
    label: "Platform",
    items: [
      { to: "/admin/platform", label: "Overview", icon: Globe, platform: true, cy: "nav-platform" },
      { to: "/admin/email-log", label: "Email log", icon: Mail, platform: true, cy: "nav-email-log" },
    ],
  },
]
