import { z } from "zod";
import { idParams, pageQuery, queryBool, uuid } from "../../../shared/validation/common";

export const listRestaurantsSchema = z.object({ query: z.object({ ...pageQuery, suspended: queryBool.optional() }) });
export const restaurantIdSchema = z.object({ params: idParams });

/** Only known settings are accepted; send just the ones being changed. */
export const updatePlatformSettingsSchema = z.object({ body: z.object({ skipEmailWhenPushDelivered: z.boolean().optional() }).strict() });

/** A moment as an ISO timestamp (the browser sends the exact start and end of the period in the admin's own time zone). */
const moment = z.string().datetime({ offset: true }).transform((s) => new Date(s));
const periodFields = { from: moment.optional(), to: moment.optional() };
const fromBeforeTo = (q: { from?: Date; to?: Date }) => !q.from || !q.to || q.from < q.to;
const fromBeforeToMessage = { message: "'from' must be earlier than 'to'", path: ["to"] };
const logFilterFields = {
  kind: z.string().trim().max(40).optional(),
  organizationId: uuid.optional(),
  search: z.string().trim().max(100).optional(),
  ...periodFields,
};

export const emailLogsSchema = z.object({
  query: z.object({ page: pageQuery.page, limit: pageQuery.limit, status: z.enum(["sent", "failed", "skipped"]).optional(), ...logFilterFields }).refine(fromBeforeTo, fromBeforeToMessage),
});

/** The tiles above the log count within the same filters as the list (without the status filter). */
export const emailLogSummarySchema = z.object({ query: z.object(logFilterFields).refine(fromBeforeTo, fromBeforeToMessage) });
