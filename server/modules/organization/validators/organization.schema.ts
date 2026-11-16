import { z } from "zod";
import { isValidTimeZone } from "../../../shared/utils/dates";
import { email, optionalText, phone, requiredText, slug } from "../../../shared/validation/common";

const url = z.string().trim().url("Enter a full link, e.g. https://…").max(300);

export const socialLinksSchema = z
  .object({
    instagram: url.optional().nullable(),
    facebook: url.optional().nullable(),
    twitter: url.optional().nullable(),
    tiktok: url.optional().nullable(),
    whatsapp: z.string().trim().max(40).optional().nullable(),
  })
  .partial();

export const updateRestaurantSchema = z.object({
  body: z
    .object({
      name: requiredText(160),
      slug,
      legalName: optionalText(200),
      phone: phone.optional().nullable(),
      email: email.optional().nullable(),
      address: optionalText(500),
      tagline: optionalText(200),
      socialLinks: socialLinksSchema.optional().nullable(),
      currencyCode: z.string().trim().toUpperCase().length(3),
      currencySymbol: z.string().trim().min(1).max(8),
      currencyDecimals: z.number().int().min(0).max(2),
      timezone: z.string().trim().refine(isValidTimeZone, "Unknown timezone"),
      orderPrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/, "2–6 letters or digits"),
      notifyStaffNewOrders: z.boolean(),
      notifyCustomersByEmail: z.boolean(),
      defaultBranchId: z.string().uuid().nullable(),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const slugParams = z.object({ params: z.object({ slug }) });

export type UpdateRestaurantBody = z.infer<typeof updateRestaurantSchema>["body"];
