import { z } from "zod";
import { email, idParams, latitude, longitude, optionalText, pageQuery, phone, queryBool, requiredText, uuid } from "../../../shared/validation/common";

const slugParam = z.object({ slug: z.string() });

export const customerFirebaseSignInSchema = z.object({
  params: slugParam,
  body: z.object({
    idToken: z.string().min(20),
    name: requiredText(120).optional(),
    /** Needed when the Firebase identity has no phone (Google sign-in). */
    phone: phone.optional(),
  }),
});

/** Guest checkout: no identity to verify, just who to address the order to. Contact phone travels with the cart. */
export const customerGuestSchema = z.object({
  params: slugParam,
  body: z.object({
    name: requiredText(120),
    email: email.optional().or(z.literal("")).nullable(),
  }),
});

export const customerEmailStartSchema = z.object({ params: slugParam, body: z.object({ email }) });

export const customerEmailVerifySchema = z.object({
  params: slugParam,
  body: z.object({
    email,
    code: z.string().trim().length(6, "Enter the 6-digit code").refine((c) => [...c].every((d) => d >= "0" && d <= "9"), "Enter the 6-digit code"),
    /** Only used when this creates a new account. */
    name: requiredText(120).optional(),
  }),
});

export const customerRefreshSchema = z.object({ params: slugParam, body: z.object({ refreshToken: z.string().min(20).max(200) }) });

export const updateCustomerSchema = z.object({
  params: slugParam,
  body: z
    .object({ name: requiredText(120), email: email.nullable(), phone })
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

const addressBody = z.object({
  label: optionalText(40),
  line: requiredText(300),
  lat: latitude.optional().nullable(),
  lng: longitude.optional().nullable(),
  instructions: optionalText(255),
  isDefault: z.boolean().default(false),
});
export const createAddressSchema = z.object({ params: slugParam, body: addressBody });
export const updateAddressSchema = z.object({
  params: slugParam.extend({ id: uuid }),
  body: addressBody.partial().refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});
export const addressIdSchema = z.object({ params: slugParam.extend({ id: uuid }) });
export const storeSlugOnlySchema = z.object({ params: slugParam });

// ── Admin ────────────────────────────────────────────────────────────────────
export const listCustomersSchema = z.object({ query: z.object({ ...pageQuery, blocked: queryBool.optional() }) });
export const customerIdSchema = z.object({ params: idParams });
export const blockCustomerSchema = z.object({ params: idParams, body: z.object({ reason: optionalText(200) }) });

export type CustomerEmailVerifyInput = z.infer<typeof customerEmailVerifySchema>["body"];
export type CustomerGuestInput = z.infer<typeof customerGuestSchema>["body"];
export type CustomerFirebaseSignInInput = z.infer<typeof customerFirebaseSignInSchema>["body"];
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>["body"];
export type AddressBody = z.infer<typeof addressBody>;
export type ListCustomersQuery = z.infer<typeof listCustomersSchema>["query"];
