import { Router } from "express";
import { requireCustomer, requirePermission } from "../../../shared/access/can";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { customerAuthMiddleware } from "../../../shared/middleware/customerAuth.middleware";
import { validate } from "../../../shared/middleware/validate.middleware";
import { ChatController as C } from "../controllers/chat.controller";
import { adminChatMessageSchema, adminChatSchema, adminConversationsSchema, storeChatMessageSchema, storeChatSchema } from "../validators/chat.schema";

/** /api/v1/store/:slug/orders/:id/chat (mergeParams) */
export const storeChatRouter = Router({ mergeParams: true });
storeChatRouter.get("/orders/:id/chat", customerAuthMiddleware, requireCustomer(), validate(storeChatSchema), C.customerOpen);
storeChatRouter.post("/orders/:id/chat/messages", customerAuthMiddleware, requireCustomer(), validate(storeChatMessageSchema), C.customerSend);

/** /api/v1/admin/chat */
export const adminChatRouter = Router();
adminChatRouter.get("/conversations", authMiddleware, requirePermission("chat.view"), validate(adminConversationsSchema), C.list);
adminChatRouter.get("/orders/:id", authMiddleware, requirePermission("chat.view"), validate(adminChatSchema), C.staffOpen);
adminChatRouter.post("/orders/:id/messages", authMiddleware, requirePermission("chat.reply"), validate(adminChatMessageSchema), C.staffSend);
