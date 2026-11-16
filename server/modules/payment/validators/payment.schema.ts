import { z } from "zod";
import { PAYSTACK_MODES } from "../../../config/constants";
import { idParams, optionalText, pageQuery, requiredText, sortOrder, uuid } from "../../../shared/validation/common";

export const updatePaymentSettingsSchema = z.object({
  body: z
    .object({
      paystackEnabled: z.boolean(),
      transferEnabled: z.boolean(),
      paystackPublicKey: z.string().trim().max(120).nullable(),
      /** Write-only: never returned. Omit to keep the stored key. */
      paystackSecretKey: z.string().trim().min(10).max(120).nullable(),
      paystackMode: z.enum(PAYSTACK_MODES),
      transferWindowMinutes: z.number().int().min(5).max(24 * 60),
      transferInstructions: optionalText(1000),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

const bankBody = z.object({
  branchId: uuid.optional().nullable(),
  bankName: requiredText(120),
  accountName: requiredText(160),
  accountNumber: z.string().trim().regex(/^[0-9A-Za-z-]{6,34}$/, "Enter a valid account number"),
  isActive: z.boolean().default(true),
  sortOrder: sortOrder.default(0),
});
export const createBankAccountSchema = z.object({ body: bankBody });
export const updateBankAccountSchema = z.object({ params: idParams, body: bankBody.partial().refine((b) => Object.keys(b).length > 0, "Nothing to update") });
export const bankAccountIdSchema = z.object({ params: idParams });

export const paymentQueueSchema = z.object({ query: z.object({ page: pageQuery.page, limit: pageQuery.limit, branchId: uuid.optional(), status: z.enum(["claimed", "pending", "all"]).default("claimed") }) });
export const paymentIdSchema = z.object({ params: idParams });
export const rejectPaymentSchema = z.object({ params: idParams, body: z.object({ reason: requiredText(255) }) });

export type UpdatePaymentSettingsInput = z.infer<typeof updatePaymentSettingsSchema>["body"];
export type BankAccountBody = z.infer<typeof bankBody>;
