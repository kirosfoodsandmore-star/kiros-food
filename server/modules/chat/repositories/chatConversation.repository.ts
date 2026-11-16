import { db } from "../../../infrastructure/database/transaction";
import { fromWindowedRows, getOffset, type PagedRows } from "../../../shared/pagination/paginate";
import { ChatConversationEntity, type ChatConversation } from "../entities/chatConversation.entity";

export interface ConversationRow {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  branchId: string;
  branchName: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  lastSenderType: string | null;
  staffUnread: number;
  customerUnread: number;
}

export class ChatConversationRepository {
  static Instance = new ChatConversationRepository();
  private constructor() {}

  async findByOrder(orderId: string): Promise<ChatConversation | null> {
    return db().getRepository(ChatConversationEntity).findOne({ where: { orderId } });
  }

  async ensure(data: { organizationId: string; branchId: string; orderId: string; customerId: string }): Promise<ChatConversation> {
    const existing = await this.findByOrder(data.orderId);
    if (existing) return existing;
    const repo = db().getRepository(ChatConversationEntity);
    return repo.save(repo.create({ ...data, lastMessageAt: null, lastMessagePreview: null, lastSenderType: null, staffUnread: 0, customerUnread: 0 }));
  }

  async recordMessage(id: string, senderType: "staff" | "customer", preview: string): Promise<void> {
    const unread = senderType === "staff" ? "customer_unread = customer_unread + 1" : "staff_unread = staff_unread + 1";
    await db().query(`UPDATE chat_conversations SET last_message_at = now(), last_message_preview = $2, last_sender_type = $3, ${unread}, updated_at = now() WHERE id = $1`, [id, preview.slice(0, 160), senderType]);
  }

  async markRead(id: string, side: "staff" | "customer"): Promise<void> {
    await db().query(`UPDATE chat_conversations SET ${side === "staff" ? "staff_unread" : "customer_unread"} = 0 WHERE id = $1`, [id]);
  }

  async list(organizationId: string, branchIds: string[] | null, unreadOnly: boolean, page: number, limit: number): Promise<PagedRows<ConversationRow>> {
    const rows = await db().query(
      `SELECT COUNT(*) OVER() AS "__total", c.id, c.order_id AS "orderId", o.number AS "orderNumber", o.status AS "orderStatus", c.branch_id AS "branchId", b.name AS "branchName",
              c.customer_id AS "customerId", o.customer_name AS "customerName", o.customer_phone AS "customerPhone", c.last_message_at AS "lastMessageAt",
              c.last_message_preview AS "lastMessagePreview", c.last_sender_type AS "lastSenderType", c.staff_unread AS "staffUnread", c.customer_unread AS "customerUnread"
       FROM chat_conversations c JOIN orders o ON o.id = c.order_id JOIN branches b ON b.id = c.branch_id
       WHERE c.organization_id = $1 AND ($2::uuid[] IS NULL OR c.branch_id = ANY($2)) AND c.last_message_at IS NOT NULL ${unreadOnly ? "AND c.staff_unread > 0" : ""}
       ORDER BY c.last_message_at DESC, c.id LIMIT $3 OFFSET $4`,
      [organizationId, branchIds, limit, getOffset(page, limit)]
    );
    return fromWindowedRows<ConversationRow & Record<string, unknown>>(rows, page, limit);
  }
}
