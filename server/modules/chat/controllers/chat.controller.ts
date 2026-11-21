import { actorOf, customerOf, handle, input, Paged } from "../../../shared/http/handler";
import { optionalFile } from "../../../shared/middleware/upload.middleware";
import { ChatService } from "../services/chat.service";
import { adminChatMessageSchema, adminChatSchema, adminConversationsSchema, storeChatMessageSchema, storeChatSchema } from "../validators/chat.schema";

export class ChatController {
  static customerOpen = handle("Conversation fetched", (req) => ChatService.Instance.customerOpen(customerOf(req), input(req, storeChatSchema).params.id));
  static customerSend = handle("Message sent", (req) => {
    const { params, body } = input(req, storeChatMessageSchema);
    return ChatService.Instance.customerSend(customerOf(req), params.id, body.body ?? "", optionalFile(req));
  }, 201);

  static list = handle("Conversations fetched", (req) => {
    const { query } = input(req, adminConversationsSchema);
    return ChatService.Instance.list(actorOf(req), query).then(Paged.of);
  });
  static staffOpen = handle("Conversation fetched", (req) => ChatService.Instance.staffOpen(actorOf(req), input(req, adminChatSchema).params.id));
  static staffSend = handle("Message sent", (req) => {
    const { params, body } = input(req, adminChatMessageSchema);
    return ChatService.Instance.staffSend(actorOf(req), params.id, body.body ?? "", optionalFile(req));
  }, 201);
}
