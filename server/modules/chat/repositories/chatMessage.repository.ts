// Firestore-backed messages for order chats (collection `orderChatMessages`). The server is the only
// writer; clients subscribe with onSnapshot() after signing in to Firebase. Every call is wrapped so
// an outage becomes a 503, never a crash.
import { FIRESTORE_COLLECTIONS } from "../../../config/constants";
import { FieldValue, firestoreUnavailable, getFirestore, Timestamp } from "../../../infrastructure/firestore/firestoreClient";

export interface ChatMessageDTO {
  id: string;
  conversationId: string;
  orderId: string;
  authorType: "staff" | "customer";
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string | null;
}

interface MessageDoc {
  conversationId: string;
  orderId: string;
  organizationId: string;
  branchId: string;
  authorType: "staff" | "customer";
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Timestamp | null;
  deletedAt: Timestamp | null;
}

function toDTO(id: string, d: MessageDoc): ChatMessageDTO {
  return { id, conversationId: d.conversationId, orderId: d.orderId, authorType: d.authorType, authorId: d.authorId, authorName: d.authorName, body: d.body, createdAt: d.createdAt ? d.createdAt.toDate().toISOString() : null };
}

export class ChatMessageRepository {
  static Instance = new ChatMessageRepository();
  private constructor() {}

  private collection() {
    return getFirestore().collection(FIRESTORE_COLLECTIONS.orderChatMessages);
  }

  async create(data: Omit<MessageDoc, "createdAt" | "deletedAt">): Promise<ChatMessageDTO> {
    try {
      const ref = await this.collection().add({ ...data, createdAt: FieldValue.serverTimestamp(), deletedAt: null });
      const snap = await ref.get();
      return toDTO(ref.id, snap.data() as MessageDoc);
    } catch (err) {
      throw firestoreUnavailable("chat", err);
    }
  }

  /** Fallback/polling read (clients normally subscribe directly). Needs the composite index in firestore.indexes.json. */
  async list(conversationId: string, limit = 100): Promise<ChatMessageDTO[]> {
    try {
      const snap = await this.collection().where("conversationId", "==", conversationId).where("deletedAt", "==", null).orderBy("createdAt", "asc").limit(limit).get();
      return snap.docs.map((d) => toDTO(d.id, d.data() as MessageDoc));
    } catch (err) {
      throw firestoreUnavailable("chat", err);
    }
  }
}
