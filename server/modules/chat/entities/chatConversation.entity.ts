// Order chat metadata in Postgres (who, unread counts, last message). The messages themselves live in
// Firestore (`orderChatMessages`) so both sides see them live — see ai_agent_flow_firebase.md.
import { EntitySchema } from "typeorm";
import { createdAt, intColumn, manyToOne, primaryId, timestampColumn, updatedAt, uuidColumn, varchar } from "../../../infrastructure/database/columns";

export interface ChatConversation {
  id: string;
  organizationId: string;
  branchId: string;
  orderId: string;
  customerId: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  lastSenderType: "staff" | "customer" | null;
  staffUnread: number;
  customerUnread: number;
  createdAt: Date;
  updatedAt: Date;
  order?: { id: string };
}

export const ChatConversationEntity = new EntitySchema<ChatConversation>({
  name: "ChatConversation",
  tableName: "chat_conversations",
  columns: {
    id: primaryId(),
    organizationId: uuidColumn("organization_id"),
    branchId: uuidColumn("branch_id"),
    orderId: uuidColumn("order_id"),
    customerId: uuidColumn("customer_id"),
    lastMessageAt: timestampColumn("last_message_at"),
    lastMessagePreview: varchar("last_message_preview", 160, true),
    lastSenderType: varchar("last_sender_type", 10, true),
    staffUnread: intColumn("staff_unread", 0),
    customerUnread: intColumn("customer_unread", 0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  relations: { order: manyToOne("Order", "order_id", "CASCADE") },
  indices: [
    { name: "UQ_chat_conversations_order", columns: ["orderId"], unique: true },
    { name: "IDX_chat_conversations_branch_last", columns: ["organizationId", "branchId", "lastMessageAt"] },
  ],
});
