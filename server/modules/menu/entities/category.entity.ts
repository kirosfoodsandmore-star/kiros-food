import { EntitySchema } from "typeorm";
import { createdAt, deletedAt, intColumn, manyToOne, primaryId, textColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface Category {
  id: string;
  organizationId: string;
  menuId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  menu?: { id: string };
}

export const CategoryEntity = new EntitySchema<Category>({
  name: "Category",
  tableName: "categories",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    menuId: uuidColumn("menu_id"),
    name: varchar("name", 120),
    description: textColumn("description"),
    imageUrl: varchar("image_url", 500, true),
    imagePublicId: varchar("image_public_id", 255, true),
    sortOrder: intColumn("sort_order", 0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { menu: manyToOne("Menu", "menu_id", "CASCADE") },
  indices: [{ name: "IDX_categories_menu", columns: ["menuId", "sortOrder"] }],
});
