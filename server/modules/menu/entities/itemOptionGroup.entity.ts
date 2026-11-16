// Attaches a reusable option group to an item, in display order.
import { EntitySchema } from "typeorm";
import { intColumn } from "../../../infrastructure/database/columns";

export interface ItemOptionGroup {
  itemId: string;
  groupId: string;
  sortOrder: number;
}

export const ItemOptionGroupEntity = new EntitySchema<ItemOptionGroup>({
  name: "ItemOptionGroup",
  tableName: "item_option_groups",
  columns: {
    itemId: { type: "uuid", name: "item_id", primary: true },
    groupId: { type: "uuid", name: "group_id", primary: true },
    sortOrder: intColumn("sort_order", 0),
  },
  indices: [{ name: "IDX_item_option_groups_group", columns: ["groupId"] }],
});
