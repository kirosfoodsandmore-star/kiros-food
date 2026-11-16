import { z } from "zod";
import { PROMO_TYPES } from "../../../config/constants";
import { idParams, isoDateTime, money, pageQuery, uuid } from "../../../shared/validation/common";

const promoBody = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, "3–40 letters, digits, dashes or underscores"),
    type: z.enum(PROMO_TYPES),
    value: z.number().int().min(1),
    startsAt: isoDateTime.optional().nullable(),
    endsAt: isoDateTime.optional().nullable(),
    maxUses: z.number().int().min(1).optional().nullable(),
    maxUsesPerCustomer: z.number().int().min(1).optional().nullable(),
    minSpend: money.default(0),
    branchId: uuid.optional().nullable(),
    menuId: uuid.optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine((p) => p.type !== "percent" || p.value <= 100, { message: "Percent must be 1–100", path: ["value"] });

export const listPromosSchema = z.object({ query: z.object({ ...pageQuery }) });
export const createPromoSchema = z.object({ body: promoBody });
export const updatePromoSchema = z.object({
  params: idParams,
  body: z
    .object({
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/),
      type: z.enum(PROMO_TYPES),
      value: z.number().int().min(1),
      startsAt: isoDateTime.nullable(),
      endsAt: isoDateTime.nullable(),
      maxUses: z.number().int().min(1).nullable(),
      maxUsesPerCustomer: z.number().int().min(1).nullable(),
      minSpend: money,
      branchId: uuid.nullable(),
      menuId: uuid.nullable(),
      isActive: z.boolean(),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});
export const promoIdSchema = z.object({ params: idParams });

export type PromoBody = z.infer<typeof promoBody>;
export type UpdatePromoBody = z.infer<typeof updatePromoSchema>["body"];
