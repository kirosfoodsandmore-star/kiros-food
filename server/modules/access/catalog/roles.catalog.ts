// Preset roles seeded for every restaurant. The Owner role is locked (cannot be edited or deleted) and
// holds every permission. The other presets can be edited by an Owner or copied into custom roles.
import { WILDCARD, type PermissionCode } from "./permissions.catalog";

export interface PresetRole {
  key: string;
  name: string;
  description: string;
  locked: boolean;
  permissions: readonly string[];
}

export const OWNER_ROLE_KEY = "owner";

export const PRESET_ROLES: readonly PresetRole[] = [
  {
    key: OWNER_ROLE_KEY,
    name: "Owner",
    description: "Everything, across every branch, including staff, payouts and settings.",
    locked: true,
    permissions: [WILDCARD],
  },
  {
    key: "branch_manager",
    name: "Branch manager",
    description: "Runs assigned branches: orders, payments to confirm, availability, hours, promo codes and reports.",
    locked: false,
    permissions: [
      "orders.view",
      "orders.update_status",
      "orders.reject",
      "orders.assign_rider",
      "payments.view",
      "payments.confirm",
      "menu.view",
      "availability.view",
      "availability.toggle",
      "branches.view",
      "branches.edit",
      "branches.pause",
      "promos.view",
      "customers.view",
      "customers.view_contact",
      "chat.view",
      "chat.reply",
      "dashboard.view",
      "reports.view",
      "reports.export",
      "staff.view",
      "audit.view",
    ] satisfies PermissionCode[],
  },
  {
    key: "kitchen_staff",
    name: "Kitchen staff",
    description: "Works the live order board at one branch and toggles sold-out items.",
    locked: false,
    permissions: ["orders.view", "orders.update_status", "menu.view", "availability.view", "availability.toggle", "dashboard.view"] satisfies PermissionCode[],
  },
  {
    key: "rider",
    name: "Rider",
    description: "Sees only the deliveries assigned to them, and marks them picked up and delivered.",
    locked: false,
    permissions: ["orders.deliver"] satisfies PermissionCode[],
  },
];
