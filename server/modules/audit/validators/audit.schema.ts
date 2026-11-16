import { z } from "zod";
import { dateRangeQuery, pageQuery, uuid } from "../../../shared/validation/common";

export const listAuditSchema = z.object({
  query: z.object({
    ...pageQuery,
    ...dateRangeQuery,
    action: z.string().trim().max(40).optional(),
    entityType: z.string().trim().max(60).optional(),
    entityId: uuid.optional(),
    userId: uuid.optional(),
    branchId: uuid.optional(),
  }),
});

export type ListAuditQuery = z.infer<typeof listAuditSchema>["query"];
