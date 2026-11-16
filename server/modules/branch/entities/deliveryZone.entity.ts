// Radius-based delivery zones: the zone whose radius covers the customer's distance with the
// smallest radius wins. Fee is flat per zone, waived above `freeAboveAmount` when set.
import { EntitySchema } from "typeorm";
import { boolColumn, createdAt, deletedAt, floatColumn, intColumn, manyToOne, moneyColumn, primaryId, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface DeliveryZone {
  id: string;
  branchId: string;
  organizationId: string;
  name: string;
  maxDistanceKm: number;
  fee: number;
  minOrder: number;
  freeAboveAmount: number | null;
  /** Extra prep minutes for this zone (traffic). */
  extraMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  branch?: { id: string };
}

export const DeliveryZoneEntity = new EntitySchema<DeliveryZone>({
  name: "DeliveryZone",
  tableName: "delivery_zones",
  columns: {
    id: primaryId(),
    branchId: uuidColumn("branch_id"),
    organizationId: uuidColumn("organization_id"),
    name: varchar("name", 80),
    maxDistanceKm: { ...floatColumn("max_distance_km", false) },
    fee: moneyColumn("fee"),
    minOrder: moneyColumn("min_order"),
    freeAboveAmount: moneyColumn("free_above_amount", true),
    extraMinutes: intColumn("extra_minutes", 0),
    isActive: boolColumn("is_active", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { branch: manyToOne("Branch", "branch_id", "CASCADE") },
  indices: [{ name: "IDX_delivery_zones_branch", columns: ["branchId"] }],
});
