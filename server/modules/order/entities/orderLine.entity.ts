import { EntitySchema } from "typeorm";
import { intColumn, jsonColumn, manyToOne, moneyColumn, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface OrderLineOption {
  optionId: string;
  groupId: string;
  groupName: string;
  name: string;
  priceDelta: number;
}

export interface OrderLine {
  id: string;
  orderId: string;
  itemId: string | null;
  itemName: string;
  categoryName: string | null;
  imageUrl: string | null;
  quantity: number;
  /** Base price + option deltas, per unit, at purchase time. */
  unitPrice: number;
  lineTotal: number;
  note: string | null;
  options: OrderLineOption[];
  order?: { id: string };
}

export const OrderLineEntity = new EntitySchema<OrderLine>({
  name: "OrderLine",
  tableName: "order_lines",
  columns: {
    id: primaryId(),
    orderId: uuidColumn("order_id"),
    itemId: uuidColumn("item_id", true),
    itemName: varchar("item_name", 160),
    categoryName: varchar("category_name", 120, true),
    imageUrl: varchar("image_url", 500, true),
    quantity: intColumn("quantity", 1),
    unitPrice: moneyColumn("unit_price"),
    lineTotal: moneyColumn("line_total"),
    note: varchar("note", 255, true),
    options: { ...jsonColumn("options", false), default: () => "'[]'" },
  },
  relations: { order: manyToOne("Order", "order_id", "CASCADE") },
  indices: [
    { name: "IDX_order_lines_order", columns: ["orderId"] },
    { name: "IDX_order_lines_item", columns: ["itemId"] },
  ],
});
