import { Router } from "express";
import { requireCustomer, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { customerAuthMiddleware } from "../../../shared/middleware/customerAuth.middleware";
import { uploadDocument } from "../../../shared/middleware/upload.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { ChatController as C } from "../controllers/chat.controller";
import { adminChatMessageSchema, adminChatSchema, adminConversationsSchema, storeChatMessageSchema, storeChatSchema } from "../validators/chat.schema";

/** /api/v1/store/:slug/orders/:id/chat (mergeParams) */
export const storeChatRouter = Router({ mergeParams: true });
storeChatRouter.get("/orders/:id/chat", customerAuthMiddleware, requireCustomer(), validate(storeChatSchema), C.customerOpen);
// A message is text, a photo/PDF, or both (multipart with an optional "file"; plain JSON still works for text).
storeChatRouter.post("/orders/:id/chat/messages", customerAuthMiddleware, requireCustomer(), uploadDocument("file", 10), validate(storeChatMessageSchema), C.customerSend);

/** /api/v1/admin/chat */
export const adminChatRouter = Router();
adminChatRouter.get("/conversations", authMiddleware, requirePermission("chat.view"), validate(adminConversationsSchema), C.list);
adminChatRouter.get("/orders/:id", authMiddleware, requirePermission("chat.view"), validate(adminChatSchema), C.staffOpen);
adminChatRouter.post("/orders/:id/messages", authMiddleware, requirePermission("chat.reply"), uploadDocument("file", 10), validate(adminChatMessageSchema), C.staffSend);
