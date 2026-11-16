import { EntitySchema } from "typeorm";
import { createdAt, intColumn, manyToOne, primaryId, uuidArrayColumn, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface CartLine {
  id: string;
  cartId: string;
  itemId: string;
  quantity: number;
  note: string | null;
  selectedOptionIds: string[];
  createdAt: Date;
  cart?: { id: string };
}

export const CartLineEntity = new EntitySchema<CartLine>({
  name: "CartLine",
  tableName: "cart_lines",
  columns: {
    id: primaryId(),
    cartId: uuidColumn("cart_id"),
    itemId: uuidColumn("item_id"),
    quantity: intColumn("quantity", 1),
    note: varchar("note", 255, true),
    selectedOptionIds: uuidArrayColumn("selected_option_ids"),
    createdAt: createdAt(),
  },
  relations: { cart: manyToOne("Cart", "cart_id", "CASCADE") },
  indices: [{ name: "IDX_cart_lines_cart", columns: ["cartId"] }],
});
