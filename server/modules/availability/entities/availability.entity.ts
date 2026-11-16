// Per-branch sold-out state for an item OR an option. A row exists only while something is marked
// unavailable (absence = available). `restoreAt` lets the scheduler put it back automatically.
import { EntitySchema } from "typeorm";
import { manyToOne, primaryId, timestampColumn, updatedAt, uuidColumn } from "../../../infrastructure/database/columns";

export interface Availability {
  id: string;
  organizationId: string;
  branchId: string;
  itemId: string | null;
  optionId: string | null;
  restoreAt: Date | null;
  updatedById: string | null;
  updatedAt: Date;
  branch?: { id: string };
}

export const AvailabilityEntity = new EntitySchema<Availability>({
  name: "Availability",
  tableName: "availability",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    itemId: uuidColumn("item_id", true),
    optionId: uuidColumn("option_id", true),
    restoreAt: timestampColumn("restore_at"),
    updatedById: uuidColumn("updated_by_id", true),
    updatedAt: updatedAt(),
  },
  relations: { branch: manyToOne("Branch", "branch_id", "CASCADE") },
  indices: [
    { name: "UQ_availability_branch_item", columns: ["branchId", "itemId"], unique: true, where: "item_id IS NOT NULL" },
    { name: "UQ_availability_branch_option", columns: ["branchId", "optionId"], unique: true, where: "option_id IS NOT NULL" },
    { name: "IDX_availability_restore", columns: ["restoreAt"] },
  ],
});
