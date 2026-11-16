import { EntitySchema } from "typeorm";
import { boolColumn, createdAt, deletedAt, intColumn, jsonColumn, manyToOne, moneyColumn, primaryId, textColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

/** One stored photo. `id` is ours (stable for the API); `publicId` is the storage provider's handle for deleting it. */
export interface ItemPhoto {
  id: string;
  url: string;
  publicId: string;
}

export interface Item {
  id: string;
  organizationId: string;
  categoryId: string;
  name: string;
  description: string | null;
  basePrice: number;
  /** The cover photo (first of `photos`), kept in sync by the service. Null when there are no photos. */
  imageUrl: string | null;
  imagePublicId: string | null;
  /** Every photo, in display order. The first is the cover. */
  photos: ItemPhoto[];
  /** Shown in the home-page favourites carousel. */
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  category?: { id: string };
}

export const ItemEntity = new EntitySchema<Item>({
  name: "Item",
  tableName: "items",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    categoryId: uuidColumn("category_id"),
    name: varchar("name", 160),
    description: textColumn("description"),
    basePrice: moneyColumn("base_price"),
    imageUrl: varchar("image_url", 500, true),
    imagePublicId: varchar("image_public_id", 255, true),
    photos: { ...jsonColumn("photos", false), default: () => "'[]'::jsonb" },
    isFeatured: boolColumn("is_featured", false),
    isActive: boolColumn("is_active", true),
    sortOrder: intColumn("sort_order", 0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  relations: { category: manyToOne("Category", "category_id", "CASCADE") },
  indices: [
    { name: "IDX_items_category", columns: ["categoryId", "sortOrder"] },
    { name: "IDX_items_org_featured", columns: ["organizationId", "isFeatured"] },
  ],
});
