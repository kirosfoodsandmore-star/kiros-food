// Shared Zod building blocks for forms (client-side UX; the server validates again).
import { z } from "zod"

export const email = z.string().trim().toLowerCase().email("Enter a valid email address")
export const password = z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/, "8–72 characters with a letter and a number")
export const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^\+[1-9]\d{6,14}$/, "Use the international format, e.g. +2348012345678"))
export const requiredText = (max: number, label = "This field") => z.string().trim().min(1, `${label} is required`).max(max)
export const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""))
export const majorMoney = z.coerce.number().min(0, "Cannot be negative")
export const time24 = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
export const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/, "3–50 lowercase letters, numbers and dashes")
