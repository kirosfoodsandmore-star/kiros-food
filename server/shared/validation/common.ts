// Reusable Zod building blocks. All money is an integer in the minor unit (kobo).
import { z } from "zod";
import { EXPORT_FORMATS, FULFILMENTS, MAX_MONEY, PAYMENT_METHODS } from "../../config/constants";

export const uuid = z.string().uuid("Must be a valid id");

/** Integer minor units (kobo), 0 or more. */
export const money = z
  .number({ invalid_type_error: "Must be a number (in kobo)" })
  .int("Amounts are whole numbers in kobo")
  .min(0, "Cannot be negative")
  .max(MAX_MONEY, "Amount is too large");

export const positiveMoney = money.refine((v) => v > 0, "Must be greater than zero");

/** Signed money (option price deltas may be negative). */
export const signedMoney = z.number().int("Amounts are whole numbers in kobo").min(-MAX_MONEY).max(MAX_MONEY);

export const quantity = z.number().int("Quantities are whole numbers").min(1, "Must be at least 1").max(999);

export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");

export const time24 = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the format HH:MM");

export const isoDateTime = z.string().datetime({ offset: true, message: "Use an ISO 8601 date-time" });

export const fulfilment = z.enum(FULFILMENTS);
export const paymentMethod = z.enum(PAYMENT_METHODS);

/** E.164 phone with country code, e.g. +2348012345678. */
export const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^\+[1-9]\d{6,14}$/, "Enter a phone number with the country code, e.g. +234…"));

export const latitude = z.coerce.number().min(-90).max(90);
export const longitude = z.coerce.number().min(-180).max(180);

export const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
export const requiredText = (max: number, min = 1) => z.string().trim().min(min, "Required").max(max);

export const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(160);

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/, "Use 3–50 lowercase letters, numbers and dashes");

/** Query-string boolean ("true" / "false" / "1" / "0"). */
export const queryBool = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
};

export const dateRangeQuery = {
  from: dateOnly.optional(),
  to: dateOnly.optional(),
};

export const exportFormat = z.enum(EXPORT_FORMATS).default("json");

export const idParams = z.object({ id: uuid });

export const sortOrder = z.number().int().min(0).max(100_000);

export const emptyObject = z.object({}).passthrough();
