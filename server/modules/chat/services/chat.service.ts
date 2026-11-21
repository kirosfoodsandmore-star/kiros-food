// Order chat between a customer and the branch. Metadata (unread counts, previews) in Postgres,
// messages in Firestore. Writes go through here (server-mediated); reads are live listeners on the
// client, with these list endpoints as a fallback.
import { STORAGE_FOLDERS } from "../../../config/constants";
import { assertPermission } from "../../../shared/access/can";
import type { PagedRows } from "../../../shared/pagination/paginate";
import { assertBranchAccess, branchScope } from "../../../shared/access/scope";
import { AppError } from "../../../shared/errors/AppError";
import { domainEvents } from "../../../shared/events/domainEvents";
import { StorageService } from "../../../shared/services/storage.service";
import type { Actor, CustomerActor } from "../../../shared/types/actor";
import { OrderRepository } from "../../order/repositories/order.repository";
import { ChatConversationRepository, type ConversationRow } from "../repositories/chatConversation.repository";
import { ChatMessageRepository, type ChatAttachment, type ChatMessageDTO } from "../repositories/chatMessage.repository";

/** The part of an uploaded file the chat needs (multer's file object has these and more). */
export interface ChatFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

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
    private readonly orders = OrderRepository.Instance,
    private readonly storage = StorageService.Instance
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

  async customerSend(customer: CustomerActor, orderId: string, body: string, file: ChatFile | null = null): Promise<ChatMessageDTO> {
    const order = await this.orders.findById(customer.organizationId, orderId);
    if (!order || order.customerId !== customer.id) throw AppError.notFound("Order not found");
    return this.post(order, { type: "customer", id: customer.id, name: customer.name ?? "Customer" }, body, file);
  }

  /** Stores one message (text and/or one attachment), updates the conversation list and announces it live. */
  private async post(
    order: { id: string; number: string; organizationId: string; branchId: string; customerId: string },
    author: { type: "staff" | "customer"; id: string; name: string },
    body: string,
    file: ChatFile | null
  ): Promise<ChatMessageDTO> {
    const text = body.trim();
    if (!text && !file) throw AppError.badRequest("Write a message or attach a file");
    const conv = await this.conversations.ensure({ organizationId: order.organizationId, branchId: order.branchId, orderId: order.id, customerId: order.customerId });
    const attachment = file ? await this.attach(file) : null;
    const message = await this.messages.create({ conversationId: conv.id, orderId: order.id, organizationId: order.organizationId, branchId: order.branchId, authorType: author.type, authorId: author.id, authorName: author.name, body: text, attachment });
    const preview = text || (attachment?.mimeType.startsWith("image/") ? "Sent a photo" : "Sent a file");
    await this.conversations.recordMessage(conv.id, author.type, preview);
    domainEvents.emit("chat.message", { organizationId: order.organizationId, branchId: order.branchId, orderId: order.id, orderNumber: order.number, conversationId: conv.id, authorType: author.type, authorName: author.name, customerId: order.customerId, preview: preview.slice(0, 120) });
    return message;
  }

  /** Photos and PDFs only (enforced when the request is parsed). Images are shrunk; PDFs are kept as they are. */
  private async attach(file: ChatFile): Promise<ChatAttachment> {
    const uploaded = await this.storage.upload(file.buffer, { folder: STORAGE_FOLDERS.chat, kind: file.mimetype === "application/pdf" ? "document" : "image" });
    // Only the file's own name, never a path someone typed, and short enough to show.
    const name = (file.originalname.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120) || (file.mimetype === "application/pdf" ? "document.pdf" : "photo");
    return { url: uploaded.url, name, mimeType: file.mimetype, bytes: uploaded.bytes || file.size };
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

  async staffSend(actor: Actor, orderId: string, body: string, file: ChatFile | null = null): Promise<ChatMessageDTO> {
    assertPermission(actor, "chat.reply");
    const order = await this.orders.findById(actor.organizationId, orderId);
    if (!order) throw AppError.notFound("Order not found");
    assertBranchAccess(actor, order.branchId, "This order belongs to another branch");
    return this.post(order, { type: "staff", id: actor.id, name: actor.name }, body, file);
  }
}
