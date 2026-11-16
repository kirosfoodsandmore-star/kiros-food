import { z } from "zod";
import { isValidTimeZone } from "../../../shared/utils/dates";
import { dateOnly, fulfilment, idParams, latitude, longitude, money, optionalText, paymentMethod, phone, requiredText, sortOrder, time24, uuid } from "../../../shared/validation/common";

const branchBody = z.object({
  name: requiredText(120),
  city: requiredText(80),
  address: requiredText(500),
  lat: latitude.optional().nullable(),
  lng: longitude.optional().nullable(),
  phone: phone.optional().nullable(),
  timezone: z.string().trim().refine(isValidTimeZone, "Unknown timezone").default("Africa/Lagos"),
  deliveryEnabled: z.boolean().default(true),
  pickupEnabled: z.boolean().default(true),
  prepTimeMinutes: z.number().int().min(0).max(240).default(20),
  slotIntervalMinutes: z.number().int().min(5).max(120).default(15),
  paymentMethodOverride: paymentMethod.optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: sortOrder.default(0),
  menuIds: z.array(uuid).max(20).default([]),
});

export const createBranchSchema = z.object({ body: branchBody });
export const updateBranchSchema = z.object({
  params: idParams,
  body: branchBody.partial().refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});
export const branchIdSchema = z.object({ params: idParams });

export const pauseBranchSchema = z.object({
  params: idParams,
  body: z.object({ paused: z.boolean(), reason: optionalText(200) }),
});

const hourRow = z.object({ weekday: z.number().int().min(0).max(6), opensAt: time24, closesAt: z.union([time24, z.literal("24:00")]) });
export const setHoursSchema = z.object({
  params: idParams,
  body: z.object({ hours: z.array(hourRow).max(21) }),
});

export const addClosureSchema = z.object({
  params: idParams,
  body: z.object({ date: dateOnly, reason: optionalText(160) }),
});
export const closureIdSchema = z.object({ params: z.object({ id: uuid, closureId: uuid }) });

const zoneBody = z.object({
  name: requiredText(80),
  maxDistanceKm: z.number().min(0.1).max(200),
  fee: money,
  minOrder: money.default(0),
  freeAboveAmount: money.optional().nullable(),
  extraMinutes: z.number().int().min(0).max(180).default(0),
  isActive: z.boolean().default(true),
});
export const createZoneSchema = z.object({ params: idParams, body: zoneBody });
export const updateZoneSchema = z.object({
  params: z.object({ id: uuid, zoneId: uuid }),
  body: zoneBody.partial().refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});
export const zoneIdSchema = z.object({ params: z.object({ id: uuid, zoneId: uuid }) });

export const listBranchesQuerySchema = z.object({
  query: z.object({ activeOnly: z.coerce.boolean().optional() }),
});

// ── Storefront ────────────────────────────────────────────────────────────────
export const storeBranchesSchema = z.object({
  params: z.object({ slug: z.string() }),
  query: z.object({ lat: latitude.optional(), lng: longitude.optional(), q: z.string().trim().max(80).optional() }),
});
export const storeBranchIdSchema = z.object({ params: z.object({ slug: z.string(), id: uuid }) });
export const storeSlotsSchema = z.object({
  params: z.object({ slug: z.string(), id: uuid }),
  query: z.object({ fulfilment: fulfilment.default("pickup"), lat: latitude.optional(), lng: longitude.optional() }),
});
export const storeDeliveryQuoteSchema = z.object({
  params: z.object({ slug: z.string(), id: uuid }),
  query: z.object({ lat: latitude, lng: longitude, subtotal: z.coerce.number().int().min(0).optional() }),
});

export type BranchBody = z.infer<typeof branchBody>;
export type UpdateBranchBody = z.infer<typeof updateBranchSchema>["body"];
export type HourRow = z.infer<typeof hourRow>;
export type ZoneBody = z.infer<typeof zoneBody>;
