import { EntitySchema } from "typeorm";
import { boolColumn, createdAt, deletedAt, intColumn, manyToOne, moneyColumn, primaryId, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface Option {
  id: string;
  organizationId: string;
  groupId: string;
  name: string;
  /** Added to the item base price when chosen (may be negative). */
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  group?: { id: string };
}

export const OptionEntity = new EntitySchema<Option>({
  name: "Option",
  tableName: "options",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    groupId: uuidColumn("group_id"),
    name: varchar("name", 120),
    priceDelta: { type: "bigint", name: "price_delta", default: 0, transformer: moneyColumn("x").transformer },
    isActive: boolColumn("is_active", true),
    sortOrder: intColumn("sort_order", 0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { group: manyToOne("OptionGroup", "group_id", "CASCADE") },
  indices: [{ name: "IDX_options_group", columns: ["groupId", "sortOrder"] }],
});
