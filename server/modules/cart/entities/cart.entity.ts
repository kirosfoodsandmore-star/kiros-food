// Server-side cart, referenced by an anonymous token the browser keeps (X-Cart-Token). Tied to one
// branch; switching branch keeps the lines and revalidates them.
import { EntitySchema } from "typeorm";
import { createdAt, jsonColumn, manyToOne, primaryId, timestampColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface DeliveryAddressSnapshot {
  line: string;
  lat: number | null;
  lng: number | null;
  instructions?: string | null;
}

export interface Cart {
  id: string;
  organizationId: string;
  branchId: string;
  menuId: string | null;
  tokenHash: string;
  customerId: string | null;
  fulfilment: "delivery" | "pickup";
  /** null = as soon as possible */
  scheduledFor: Date | null;
  promoCode: string | null;
  deliveryAddress: DeliveryAddressSnapshot | null;
  phone: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  branch?: { id: string };
}

export const CartEntity = new EntitySchema<Cart>({
  name: "Cart",
  tableName: "carts",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    menuId: uuidColumn("menu_id", true),
    tokenHash: varchar("token_hash", 64),
    customerId: uuidColumn("customer_id", true),
    fulfilment: varchar("fulfilment", 10, false, "delivery"),
    scheduledFor: timestampColumn("scheduled_for"),
    promoCode: varchar("promo_code", 40, true),
    deliveryAddress: jsonColumn("delivery_address"),
    phone: varchar("phone", 20, true),
    expiresAt: timestampColumn("expires_at", false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  relations: { branch: manyToOne("Branch", "branch_id", "CASCADE") },
  indices: [
    { name: "UQ_carts_token", columns: ["tokenHash"], unique: true },
    { name: "IDX_carts_expires", columns: ["expiresAt"] },
  ],
});
