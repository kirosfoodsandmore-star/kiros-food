import { EntitySchema } from "typeorm";
import {
  boolColumn,
  createdAt,
  deletedAt,
  floatColumn,
  intColumn,
  manyToOne,
  primaryId,
  textColumn,
  updatedAt,
  uuidColumn,
  varchar,
} from "../../../infrastructure/database/columns";

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  timezone: string;
  /** Ordering paused by staff (holiday, kitchen problem). Open/closed from hours is computed separately. */
  isPaused: boolean;
  pauseReason: string | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  /** Minutes from acceptance to ready; shifts the first available slot. */
  prepTimeMinutes: number;
  slotIntervalMinutes: number;
  /** When set, this branch only offers one payment method regardless of the restaurant default. */
  paymentMethodOverride: "paystack" | "transfer" | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const BranchEntity = new EntitySchema<Branch>({
  name: "Branch",
  tableName: "branches",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    name: varchar("name", 120),
    city: varchar("city", 80),
    address: textColumn("address", false),
    lat: floatColumn("lat"),
    lng: floatColumn("lng"),
    phone: varchar("phone", 30, true),
    timezone: varchar("timezone", 60, false, "Africa/Lagos"),
    isPaused: boolColumn("is_paused", false),
    pauseReason: varchar("pause_reason", 200, true),
    deliveryEnabled: boolColumn("delivery_enabled", true),
    pickupEnabled: boolColumn("pickup_enabled", true),
    prepTimeMinutes: intColumn("prep_time_minutes", 20),
    slotIntervalMinutes: intColumn("slot_interval_minutes", 15),
    paymentMethodOverride: varchar("payment_method_override", 10, true),
    isActive: boolColumn("is_active", true),
    sortOrder: intColumn("sort_order", 0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [{ name: "IDX_branches_org", columns: ["organizationId", "sortOrder"] }],
});
