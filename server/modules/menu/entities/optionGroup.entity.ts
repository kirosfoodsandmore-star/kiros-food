// Reusable option groups ("Size", "Sugar level", "Eat in or takeout"). Required when minSelect >= 1.
import { EntitySchema } from "typeorm";
import { createdAt, deletedAt, intColumn, manyToOne, primaryId, textColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface OptionGroup {
  id: string;
  organizationId: string;
  name: string;
  helpText: string | null;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const OptionGroupEntity = new EntitySchema<OptionGroup>({
  name: "OptionGroup",
  tableName: "option_groups",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    name: varchar("name", 120),
    helpText: textColumn("help_text"),
    minSelect: intColumn("min_select", 0),
    maxSelect: intColumn("max_select", 1),
    sortOrder: intColumn("sort_order", 0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [{ name: "IDX_option_groups_org", columns: ["organizationId"] }],
});
