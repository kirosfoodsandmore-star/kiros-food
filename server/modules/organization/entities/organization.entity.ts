// A restaurant (tenant). Everything else is scoped by organization_id. Settings that are not
// sensitive live here; payment settings have their own table.
import { EntitySchema } from "typeorm";
import { boolColumn, createdAt, jsonColumn, primaryId, textColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface SocialLinks {
  instagram?: string | null;
  facebook?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
  whatsapp?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  /** Storefront path: /store/{slug}. Unique, lower-case. */
  slug: string;
  legalName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logoUrl: string | null;
  logoPublicId: string | null;
  currencyCode: string;
  currencySymbol: string;
  currencyDecimals: number;
  timezone: string;
  tagline: string | null;
  socialLinks: SocialLinks | null;
  /** Order-number prefix, e.g. "KIR". */
  orderPrefix: string;
  /** Email branch staff with `orders.view` when a paid order arrives. */
  notifyStaffNewOrders: boolean;
  /** Email customers (when they gave an email) on order updates. */
  notifyCustomersByEmail: boolean;
  /** Branch shown to first-time storefront visitors. NULL = automatic (the first open branch). */
  defaultBranchId: string | null;
  /** Platform admins can suspend a restaurant: storefront and admin sign-in are refused. */
  isSuspended: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const OrganizationEntity = new EntitySchema<Organization>({
  name: "Organization",
  tableName: "organizations",
  columns: {
    id: primaryId(),
    name: varchar("name", 160),
    slug: varchar("slug", 60),
    legalName: varchar("legal_name", 200, true),
    phone: varchar("phone", 30, true),
    email: varchar("email", 160, true),
    address: textColumn("address"),
    logoUrl: varchar("logo_url", 500, true),
    logoPublicId: varchar("logo_public_id", 255, true),
    currencyCode: varchar("currency_code", 3, false, "NGN"),
    currencySymbol: varchar("currency_symbol", 8, false, "₦"),
    currencyDecimals: { type: "int", name: "currency_decimals", default: 0 },
    timezone: varchar("timezone", 60, false, "Africa/Lagos"),
    tagline: varchar("tagline", 200, true),
    socialLinks: jsonColumn("social_links"),
    orderPrefix: varchar("order_prefix", 6, false, "ORD"),
    notifyStaffNewOrders: boolColumn("notify_staff_new_orders", true),
    notifyCustomersByEmail: boolColumn("notify_customers_by_email", true),
    defaultBranchId: uuidColumn("default_branch_id", true),
    isSuspended: boolColumn("is_suspended", false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  indices: [{ name: "UQ_organizations_slug", columns: ["slug"], unique: true }],
});
