import { EntitySchema } from "typeorm";
import { intColumn, moneyColumn, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

/** One menu item on an offline sale: what, how many, and the price charged each. */
export interface FinanceEntryItem {
  id: string;
  entryId: string;
  /** null when the item was typed in by hand, or was later removed from the menu. */
  itemId: string | null;
  itemName: string;
  categoryName: string | null;
  quantity: number;
  /** Kobo per unit as charged (the menu price unless the seller changed it). */
  unitPrice: number;
  sortOrder: number;
}

export const FinanceEntryItemEntity = new EntitySchema<FinanceEntryItem>({
  name: "FinanceEntryItem",
  tableName: "finance_entry_items",
  columns: {
    id: primaryId(),
    entryId: uuidColumn("entry_id"),
    itemId: uuidColumn("item_id", true),
    itemName: varchar("item_name", 160),
    categoryName: varchar("category_name", 120, true),
    quantity: intColumn("quantity", 1),
    unitPrice: moneyColumn("unit_price"),
    sortOrder: intColumn("sort_order", 0),
  },
});
