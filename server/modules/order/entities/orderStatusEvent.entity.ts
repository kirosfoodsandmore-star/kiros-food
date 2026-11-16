// Status history: every transition with who made it. Written in the same transaction as the change.
import { EntitySchema } from "typeorm";
import type { ActorType, OrderStatus } from "../../../config/constants";
import { createdAt, manyToOne, primaryId, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface OrderStatusEvent {
  id: string;
  orderId: string;
  organizationId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: ActorType;
  actorId: string | null;
  actorName: string | null;
  note: string | null;
  createdAt: Date;
  order?: { id: string };
}

export const OrderStatusEventEntity = new EntitySchema<OrderStatusEvent>({
  name: "OrderStatusEvent",
  tableName: "order_status_events",
  columns: {
    id: primaryId(),
    orderId: uuidColumn("order_id"),
    organizationId: uuidColumn("organization_id"),
    fromStatus: varchar("from_status", 24, true),
    toStatus: varchar("to_status", 24),
    actorType: varchar("actor_type", 10),
    actorId: uuidColumn("actor_id", true),
    actorName: varchar("actor_name", 120, true),
    note: varchar("note", 500, true),
    createdAt: createdAt(),
  },
  relations: { order: manyToOne("Order", "order_id", "CASCADE") },
  indices: [{ name: "IDX_order_status_events_order", columns: ["orderId", "createdAt"] }],
});
