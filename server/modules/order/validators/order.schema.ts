import { z } from "zod";
import { ORDER_STATUSES } from "../../../config/constants";
import { dateRangeQuery, email, fulfilment, idParams, optionalText, pageQuery, paymentMethod, queryBool, requiredText, uuid } from "../../../shared/validation/common";

const slugParam = z.object({ slug: z.string() });
const status = z.enum(ORDER_STATUSES);

// ── Storefront ───────────────────────────────────────────────────────────────
export const checkoutSchema = z.object({
  params: slugParam,
  body: z.object({
    cartId: uuid,
    paymentMethod,
    name: requiredText(120).optional(),
    email: email.optional().nullable(),
    note: optionalText(500),
  }),
});

export const storeOrderIdSchema = z.object({ params: slugParam.extend({ id: uuid }) });
export const storeOrdersSchema = z.object({ params: slugParam, query: z.object({ page: pageQuery.page, limit: pageQuery.limit }) });
export const transferClaimSchema = z.object({ params: slugParam.extend({ id: uuid }), body: z.object({ note: optionalText(255) }) });
export const storePaymentMethodsSchema = z.object({ params: slugParam.extend({ branchId: uuid }) });

// ── Admin ────────────────────────────────────────────────────────────────────
const statusList = z.union([status, z.string()]).transform((v) => (typeof v === "string" ? v.split(",") : v)).pipe(z.array(status).max(10));

export const listOrdersSchema = z.object({
  query: z.object({
    ...pageQuery,
    ...dateRangeQuery,
    branchId: uuid.optional(),
    status: statusList.optional(),
    fulfilment: fulfilment.optional(),
    customerId: uuid.optional(),
    riderId: uuid.optional(),
    scheduledOnly: queryBool.optional(),
    unhandled: queryBool.optional(),
  }),
});

export const boardSchema = z.object({ query: z.object({ branchId: uuid.optional() }) });
/** `done=true` asks for what the rider delivered in the last 24 hours instead of what's still to do. */
export const myDeliveriesSchema = z.object({ query: z.object({ done: queryBool.optional() }) });
export const respondDeliverySchema = z.object({ params: idParams, body: z.object({ action: z.enum(["accept", "decline"]), reason: optionalText(200) }) });
export const availabilitySchema = z.object({ body: z.object({ onDuty: z.boolean() }) });
export const orderIdSchema =z.object({ params: idParams });

export const changeStatusSchema = z.object({
  params: idParams,
  body: z.object({ status, note: optionalText(500), code: z.string().regex(/^[0-9]{4}$/, "The code is 4 digits").optional() }),
});

export const rejectOrderSchema = z.object({ params: idParams, body: z.object({ reason: requiredText(255) }) });

export const refundOrderSchema = z.object({
  params: idParams,
  body: z.object({ amount: z.number().int().min(1).optional(), note: requiredText(500) }),
});

export const assignRiderSchema = z.object({ params: idParams, body: z.object({ riderId: uuid.nullable() }) });

export type CheckoutInput = z.infer<typeof checkoutSchema>["body"];
export type ListOrdersQuery = z.infer<typeof listOrdersSchema>["query"];
