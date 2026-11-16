import { z } from "zod";
import { fulfilment, isoDateTime, latitude, longitude, optionalText, phone, quantity, requiredText, uuid } from "../../../shared/validation/common";

const slugParam = z.object({ slug: z.string() });

export const createCartSchema = z.object({
  params: slugParam,
  body: z.object({ branchId: uuid, menuId: uuid.optional().nullable(), fulfilment: fulfilment.default("delivery") }),
});

export const cartParamsSchema = z.object({ params: slugParam.extend({ id: uuid }) });

export const addressInput = z.object({
  line: requiredText(300),
  lat: latitude.optional().nullable(),
  lng: longitude.optional().nullable(),
  instructions: optionalText(255),
});

export const updateCartSchema = z.object({
  params: slugParam.extend({ id: uuid }),
  body: z
    .object({
      fulfilment,
      /** ISO instant, or null for ASAP. */
      scheduledFor: isoDateTime.nullable(),
      deliveryAddress: addressInput.nullable(),
      phone: phone.nullable(),
      menuId: uuid.nullable(),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const addLineSchema = z.object({
  params: slugParam.extend({ id: uuid }),
  body: z.object({
    itemId: uuid,
    quantity: quantity.default(1),
    note: optionalText(255),
    selectedOptionIds: z.array(uuid).max(60).default([]),
  }),
});

export const updateLineSchema = z.object({
  params: slugParam.extend({ id: uuid, lineId: uuid }),
  body: z
    .object({ quantity, note: optionalText(255), selectedOptionIds: z.array(uuid).max(60) })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const lineParamsSchema = z.object({ params: slugParam.extend({ id: uuid, lineId: uuid }) });

export const promoSchema = z.object({
  params: slugParam.extend({ id: uuid }),
  body: z.object({ code: z.string().trim().min(1).max(40) }),
});

export const switchBranchSchema = z.object({
  params: slugParam.extend({ id: uuid }),
  body: z.object({ branchId: uuid, menuId: uuid.optional().nullable() }),
});

export type CreateCartInput = z.infer<typeof createCartSchema>["body"];
export type UpdateCartInput = z.infer<typeof updateCartSchema>["body"];
export type AddLineInput = z.infer<typeof addLineSchema>["body"];
export type UpdateLineInput = z.infer<typeof updateLineSchema>["body"];
