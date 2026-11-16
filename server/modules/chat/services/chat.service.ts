// Order chat between a customer and the branch. Metadata (unread counts, previews) in Postgres,
// messages in Firestore. Writes go through here (server-mediated); reads are live listeners on the
// client, with these list endpoints as a fallback.
import { assertPermission } from "../../../shared/access/can";
import type { PagedRows } from "../../../shared/pagination/paginate";
import { assertBranchAccess, branchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import { domainEvents } from "../../../shared/events/domainEvents";
import type { Actor, CustomerActor } from "../../../shared/types/actor";
import { OrderRepository } from "../../order/repositories/order.repository";
import { ChatConversationRepository, type ConversationRow } from "../repositories/chatConversation.repository";
import { ChatMessageRepository, type ChatMessageDTO } from "../repositories/chatMessage.repository";

export interface ConversationView {
  conversationId: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  unread: number;
  /** Where the client subscribes: Firestore collection + field filter. */
  firestore: { collection: string; field: "conversationId" };
  messages: ChatMessageDTO[];
}

export class ChatService {
  static Instance = new ChatService();
  private constructor(
    private readonly conversations = ChatConversationRepository.Instance,
    private readonly messages = ChatMessageRepository.Instance,
    private readonly orders = OrderRepository.Instance
  ) {}

  private async view(conv: { id: string; orderId: string; branchId: string; staffUnread: number; customerUnread: number }, orderNumber: string, side: "staff" | "customer"): Promise<ConversationView> {
    const messages = await this.messages.list(conv.id).catch(() => [] as ChatMessageDTO[]);
    return { conversationId: conv.id, orderId: conv.orderId, orderNumber, branchId: conv.branchId, unread: side === "staff" ? conv.staffUnread : conv.customerUnread, firestore: { collection: "orderChatMessages", field: "conversationId" }, messages };
  }

  // ── Customer ───────────────────────────────────────────────────────────────

  async customerOpen(customer: CustomerActor, orderId: string): Promise<ConversationView> {
    const order = await this.orders.findById(customer.organizationId, orderId);
    if (!order || order.customerId !== customer.id) throw AppError.notFound("Order not found");
    const conv = await this.conversations.ensure({ organizationId: order.organizationId, branchId: order.branchId, orderId: order.id, customerId: customer.id });
    await this.conversations.markRead(conv.id, "customer");
    return this.view({ ...conv, customerUnread: 0 }, order.number, "customer");
  }

  async customerSend(customer: CustomerActor, orderId: string, body: string): Promise<ChatMessageDTO> {
    const order = await this.orders.findById(customer.organizationId, orderId);
    if (!order || order.customerId !== customer.id) throw AppError.notFound("Order not found");
    const conv = await this.conversations.ensure({ organizationId: order.organizationId, branchId: order.branchId, orderId: order.id, customerId: customer.id });
    const message = await this.messages.create({ conversationId: conv.id, orderId: order.id, organizationId: order.organizationId, branchId: order.branchId, authorType: "customer", authorId: customer.id, authorName: customer.name ?? "Customer", body: body.trim() });
    await this.conversations.recordMessage(conv.id, "customer", body);
    domainEvents.emit("chat.message", { organizationId: order.organizationId, branchId: order.branchId, orderId: order.id, conversationId: conv.id, authorType: "customer", customerId: customer.id, preview: body.slice(0, 120) });
    return message;
  }

  // ── Staff ──────────────────────────────────────────────────────────────────

  list(actor: Actor, f: { branchId?: string; unreadOnly?: boolean; page: number; limit: number }): Promise<PagedRows<ConversationRow>> {
    return this.conversations.list(actor.organizationId, branchScope(actor, f.branchId), f.unreadOnly ?? false, f.page, f.limit);
  }

  async staffOpen(actor: Actor, orderId: string): Promise<ConversationView> {
    const order = await this.orders.findById(actor.organizationId, orderId);
    if (!order) throw AppError.notFound("Order not found");
    assertBranchAccess(actor, order.branchId, "This order belongs to another branch");
    const conv = await this.conversations.ensure({ organizationId: order.organizationId, branchId: order.branchId, orderId: order.id, customerId: order.customerId });
    await this.conversations.markRead(conv.id, "staff");
    return this.view({ ...conv, staffUnread: 0 }, order.number, "staff");
  }

  async staffSend(actor: Actor, orderId: string, body: string): Promise<ChatMessageDTO> {
    assertPermission(actor, "chat.reply");
    const order = await this.orders.findById(actor.organizationId, orderId);
    if (!order) throw AppError.notFound("Order not found");
    assertBranchAccess(actor, order.branchId, "This order belongs to another branch");
    const conv = await this.conversations.ensure({ organizationId: order.organizationId, branchId: order.branchId, orderId: order.id, customerId: order.customerId });
    const message = await this.messages.create({ conversationId: conv.id, orderId: order.id, organizationId: order.organizationId, branchId: order.branchId, authorType: "staff", authorId: actor.id, authorName: actor.name, body: body.trim() });
    await this.conversations.recordMessage(conv.id, "staff", body);
    domainEvents.emit("chat.message", { organizationId: order.organizationId, branchId: order.branchId, orderId: order.id, conversationId: conv.id, authorType: "staff", customerId: order.customerId, preview: body.slice(0, 120) });
    return message;
  }
}
