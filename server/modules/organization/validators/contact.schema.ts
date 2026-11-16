import { z } from "zod";
import { email, slug } from "../../../shared/validation/common";

/** POST /api/v1/store/:slug/contact — the storefront "Get in touch" form. */
export const contactMessageSchema = z.object({
  params: z.object({ slug }),
  body: z.object({
    name: z.string().trim().min(1, "Enter your name").max(120),
    email,
    // Free-form on purpose: visitors type local numbers like 0704 441 4000 as well as +234…
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[0-9+()\-\s]*$/, "Enter a valid phone number")
      .optional()
      .nullable(),
    message: z.string().trim().min(5, "Please write a little more").max(2000, "Please keep your message under 2000 characters"),
    /** Honeypot: hidden from people, filled in by bots. A non-empty value is silently discarded. */
    website: z.string().max(200).optional(),
  }),
});

export type ContactMessageBody = z.infer<typeof contactMessageSchema>["body"];
