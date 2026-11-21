import { z } from "zod";
import { idParams, optionalText, pageQuery, queryBool, uuid } from "../../../shared/validation/common";

const slugParam = z.object({ slug: z.string() });

export const storeChatSchema = z.object({ params: slugParam.extend({ id: uuid }) });
// The text may be empty when a file is attached; the service refuses a message with neither.
export const storeChatMessageSchema = z.object({ params: slugParam.extend({ id: uuid }), body: z.object({ body: optionalText(2000) }) });

export const adminConversationsSchema = z.object({ query: z.object({ page: pageQuery.page, limit: pageQuery.limit, branchId: uuid.optional(), unreadOnly: queryBool.optional() }) });
export const adminChatSchema = z.object({ params: idParams });
export const adminChatMessageSchema = z.object({ params: idParams, body: z.object({ body: optionalText(2000) }) });
