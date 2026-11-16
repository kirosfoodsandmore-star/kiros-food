// A menu (e.g. the café menu and the bubble-tea menu). `version` bumps on every edit to the menu tree
// so storefronts can poll cheaply and refetch only when something changed.
import { EntitySchema } from "typeorm";
import { boolColumn, createdAt, deletedAt, intColumn, manyToOne, primaryId, textColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface Menu {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  sortOrder: number;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  organization?: { id: string };
}

export const MenuEntity = new EntitySchema<Menu>({
  name: "Menu",
  tableName: "menus",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    name: varchar("name", 120),
    description: textColumn("description"),
    imageUrl: varchar("image_url", 500, true),
    imagePublicId: varchar("image_public_id", 255, true),
    sortOrder: intColumn("sort_order", 0),
    version: intColumn("version", 1),
    isActive: boolColumn("is_active", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { organization: manyToOne("Organization", "organization_id", "CASCADE") },
  indices: [{ name: "IDX_menus_org", columns: ["organizationId", "sortOrder"] }],
});
