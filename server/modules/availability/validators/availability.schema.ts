import { z } from "zod";
import { isoDateTime, uuid } from "../../../shared/validation/common";

export const listAvailabilitySchema = z.object({ query: z.object({ branchId: uuid.optional() }) });

export const setAvailabilitySchema = z.object({
  body: z
    .object({
      branchId: uuid,
      itemId: uuid.optional(),
      optionId: uuid.optional(),
      isAvailable: z.boolean(),
      /** Auto-restore time; ignored when isAvailable is true. */
      restoreAt: isoDateTime.optional().nullable(),
    })
    .refine((b) => Boolean(b.itemId) !== Boolean(b.optionId), { message: "Give exactly one of itemId or optionId", path: ["itemId"] }),
});

const targetSchema = z
  .object({ itemId: uuid.optional(), optionId: uuid.optional() })
  .refine((t) => Boolean(t.itemId) !== Boolean(t.optionId), { message: "Give exactly one of itemId or optionId", path: ["itemId"] });

/** Same change applied to many items/options at once (one branch, one availability, one restore time). */
export const bulkSetAvailabilitySchema = z.object({
  body: z.object({
    branchId: uuid,
    targets: z.array(targetSchema).min(1).max(200),
    isAvailable: z.boolean(),
    restoreAt: isoDateTime.optional().nullable(),
  }),
});

export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>["body"];
export type BulkSetAvailabilityInput = z.infer<typeof bulkSetAvailabilitySchema>["body"];
