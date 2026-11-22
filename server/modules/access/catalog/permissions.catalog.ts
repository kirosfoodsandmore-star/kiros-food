// Single source of truth for permission codes (`resource.action`). Routes and services check these;
// roles are just named bundles of them. Never branch on a role name in application code.
// Branch scope is NOT a permission: it is the user's branch list (or "all branches") — see shared/access/scope.ts.

export interface PermissionDefinition {
  code: string;
  category: string;
  label: string;
  /** Only the Owner holds these by default; a non-owner can still be granted them by an Owner. */
  ownerOnlyDefault?: boolean;
}

export const PERMISSIONS = [
  // ── Orders ─────────────────────────────────────────────────────────────────
  { code: "orders.view", category: "Orders", label: "See orders in my branches" },
  { code: "orders.update_status", category: "Orders", label: "Accept orders and move them through preparing, ready, out for delivery and completed" },
  { code: "orders.reject", category: "Orders", label: "Reject (cancel) an order with a reason" },
  { code: "orders.assign_rider", category: "Orders", label: "Assign a rider to a delivery" },
  { code: "orders.deliver", category: "Orders", label: "See my assigned deliveries and mark them delivered" },
  { code: "orders.refund", category: "Refunds", label: "Refund an order (Paystack refund or manual note)" },

  // ── Payments ───────────────────────────────────────────────────────────────
  { code: "payments.view", category: "Payments to confirm", label: "See bank-transfer payments waiting for confirmation" },
  { code: "payments.confirm", category: "Payments to confirm", label: "Confirm or reject a bank-transfer payment" },

  // ── Menu ───────────────────────────────────────────────────────────────────
  { code: "menu.view", category: "Menu", label: "See menus, categories, items and option groups" },
  { code: "menu.edit", category: "Menu", label: "Create and edit menus, categories, items, photos and option groups" },
  { code: "menu.edit_prices", category: "Menu", label: "Change item prices and option price deltas" },

  // ── Availability ───────────────────────────────────────────────────────────
  { code: "availability.view", category: "Availability", label: "See what is sold out per branch" },
  { code: "availability.toggle", category: "Availability", label: "Mark items and options sold out or back in stock" },

  // ── Branches ───────────────────────────────────────────────────────────────
  { code: "branches.view", category: "Branches", label: "See branches, hours and delivery zones" },
  { code: "branches.edit", category: "Branches", label: "Edit branches, opening hours, closures, delivery zones and menus served" },
  { code: "branches.pause", category: "Branches", label: "Pause and resume ordering at a branch" },

  // ── Promo codes ────────────────────────────────────────────────────────────
  { code: "promos.view", category: "Promo codes", label: "See promo codes" },
  { code: "promos.manage", category: "Promo codes", label: "Create and edit promo codes" },

  // ── Customers ──────────────────────────────────────────────────────────────
  { code: "customers.view", category: "Customers", label: "See customers and their order history" },
  { code: "customers.view_contact", category: "Customers", label: "See full phone numbers and emails (otherwise masked)" },
  { code: "customers.block", category: "Customers", label: "Block and unblock customers" },

  // ── Chat ───────────────────────────────────────────────────────────────────
  { code: "chat.view", category: "Chat", label: "Read order conversations with customers" },
  { code: "chat.reply", category: "Chat", label: "Reply to customers in order conversations" },

  // ── Reports & dashboard ────────────────────────────────────────────────────
  { code: "dashboard.view", category: "Reports", label: "See the dashboard" },
  { code: "reports.view", category: "Reports", label: "See sales reports" },
  { code: "reports.export", category: "Reports", label: "Export reports to CSV" },

  // ── Finance (owner only by default) ────────────────────────────────────────
  { code: "finance.view", category: "Finance", label: "See capital, expenses, other income, budgets and business analytics", ownerOnlyDefault: true },
  { code: "finance.manage", category: "Finance", label: "Record, import and edit capital, expenses, income and budgets", ownerOnlyDefault: true },

  // ── Staff (owner only by default) ──────────────────────────────────────────
  { code: "staff.view", category: "Staff", label: "See staff and pending invites" },
  { code: "staff.manage", category: "Staff", label: "Invite staff, assign roles and branches, deactivate; create custom roles", ownerOnlyDefault: true },

  // ── Settings (owner only by default) ───────────────────────────────────────
  { code: "settings.view", category: "Settings", label: "See restaurant settings" },
  { code: "settings.manage", category: "Settings", label: "Change brand, logo, currency, social links and notifications", ownerOnlyDefault: true },
  { code: "settings.payments", category: "Settings", label: "Change payment methods, Paystack keys and bank accounts", ownerOnlyDefault: true },

  // ── Audit ──────────────────────────────────────────────────────────────────
  { code: "audit.view", category: "Audit log", label: "Read the audit log" },
] as const satisfies readonly PermissionDefinition[];

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

export const WILDCARD = "*";

export const PERMISSION_CODES: readonly PermissionCode[] = PERMISSIONS.map((p) => p.code);

export function isPermissionCode(value: string): value is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(value);
}
