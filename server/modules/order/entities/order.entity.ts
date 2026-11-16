// An order. Money columns are snapshots computed on the server at checkout; lines snapshot names
// and prices so later menu edits never change what a customer paid.
import { EntitySchema } from "typeorm";
import type { Fulfilment, OrderStatus, PaymentMethod, RiderResponse } from "../../../config/constants";
import { createdAt, intColumn, jsonColumn, manyToOne, moneyColumn, primaryId, textColumn, timestampColumn, updatedAt, uuidArrayColumn, uuidColumn, varchar } from "../../../infrastructure/database/columns";
import type { DeliveryAddressSnapshot } from "../../cart/entities/cart.entity";

export interface Order {
  id: string;
  organizationId: string;
  branchId: string;
  menuId: string | null;
  customerId: string;
  number: string;
  fulfilment: Fulfilment;
  /** null = as soon as possible */
  scheduledFor: Date | null;
  deliveryAddress: DeliveryAddressSnapshot | null;
  customerPhone: string;
  customerName: string | null;
  customerEmail: string | null;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  promoCode: string | null;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paidAt: Date | null;
  acceptedAt: Date | null;
  readyAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  refundedAt: Date | null;
  refundNote: string | null;
  riderId: string | null;
  /** "pending" until the assigned rider answers, then "accepted". NULL on orders assigned before riders could respond (treated as accepted). */
  riderResponse: RiderResponse | null;
  riderRespondedAt: Date | null;
  /** When it was given to the current rider: the answer clock starts here. */
  riderAssignedAt: Date | null;
  /** Riders who already declined it or let the time run out; the automatic pass skips them. */
  triedRiderIds: string[];
  /** Proof of receipt: made when a delivery goes out, read out by the customer, typed in by the rider. Never sent to staff. */
  deliveryCode: string | null;
  deliveryCodeAttempts: number;
  /** Kitchen-visible note from the customer (whole order). */
  note: string | null;
  /** Unpaid orders are cancelled by the scheduler after this instant. */
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  branch?: { id: string };
  customer?: { id: string };
}

export const OrderEntity = new EntitySchema<Order>({
  name: "Order",
  tableName: "orders",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    menuId: uuidColumn("menu_id", true),
    customerId: uuidColumn("customer_id"),
    number: varchar("number", 24),
    fulfilment: varchar("fulfilment", 10),
    scheduledFor: timestampColumn("scheduled_for"),
    deliveryAddress: jsonColumn("delivery_address"),
    customerPhone: varchar("customer_phone", 20),
    customerName: varchar("customer_name", 120, true),
    customerEmail: varchar("customer_email", 160, true),
    subtotal: moneyColumn("subtotal"),
    deliveryFee: moneyColumn("delivery_fee"),
    discount: moneyColumn("discount"),
    promoCode: varchar("promo_code", 40, true),
    total: moneyColumn("total"),
    status: varchar("status", 24, false, "pending_payment"),
    paymentMethod: varchar("payment_method", 10),
    paidAt: timestampColumn("paid_at"),
    acceptedAt: timestampColumn("accepted_at"),
    readyAt: timestampColumn("ready_at"),
    completedAt: timestampColumn("completed_at"),
    cancelledAt: timestampColumn("cancelled_at"),
    cancelReason: varchar("cancel_reason", 255, true),
    refundedAt: timestampColumn("refunded_at"),
    refundNote: textColumn("refund_note"),
    riderId: uuidColumn("rider_id", true),
    riderResponse: varchar("rider_response", 10, true),
    riderRespondedAt: timestampColumn("rider_responded_at"),
    riderAssignedAt: timestampColumn("rider_assigned_at"),
    triedRiderIds: uuidArrayColumn("tried_rider_ids"),
    deliveryCode: varchar("delivery_code", 6, true),
    deliveryCodeAttempts: intColumn("delivery_code_attempts", 0),
    note: varchar("note", 500, true),
    expiresAt: timestampColumn("expires_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  relations: {
    branch: manyToOne("Branch", "branch_id"),
    customer: manyToOne("Customer", "customer_id"),
  },
  indices: [
    { name: "UQ_orders_org_number", columns: ["organizationId", "number"], unique: true },
    { name: "IDX_orders_branch_status_created", columns: ["organizationId", "branchId", "status", "createdAt"] },
    { name: "IDX_orders_customer_created", columns: ["customerId", "createdAt"] },
    { name: "IDX_orders_org_created", columns: ["organizationId", "createdAt"] },
    { name: "IDX_orders_expires", columns: ["expiresAt"] },
  ],
});
