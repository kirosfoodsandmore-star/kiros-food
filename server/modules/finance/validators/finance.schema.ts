import { z } from "zod";
import { dateOnly, exportFormat, idParams, optionalText, pageQuery, positiveMoney, queryBool, requiredText, uuid } from "../../../shared/validation/common";
import { categoryOf, FINANCE_CATEGORY_KEYS, FINANCE_KINDS, FINANCE_PAYMENT_METHODS } from "../catalog/finance.catalog";

/** Biggest import in one go (a year of daily entries fits). */
export const MAX_IMPORT_ROWS = 1000;

const matchesKind = (e: { kind?: string; category?: string }) => !e.kind || !e.category || categoryOf(e.category)?.kind === e.kind;
const kindMismatch = { message: "That category does not belong to this kind of entry", path: ["category"] };

const entryFields = {
  kind: z.enum(FINANCE_KINDS),
  category: z.enum(FINANCE_CATEGORY_KEYS),
  title: requiredText(160),
  amount: positiveMoney,
  entryDate: dateOnly,
  branchId: uuid.optional().nullable(),
  paymentMethod: z.enum(FINANCE_PAYMENT_METHODS).optional().nullable(),
  party: optionalText(160),
  reference: optionalText(80),
  notes: optionalText(2000),
};

const entryBody = z.object(entryFields).refine(matchesKind, kindMismatch);

export const listEntriesSchema = z.object({
  query: z.object({
    ...pageQuery,
    limit: z.coerce.number().int().min(1).max(200).default(25),
    kind: z.enum(FINANCE_KINDS).optional(),
    category: z.enum(FINANCE_CATEGORY_KEYS).optional(),
    branchId: uuid.optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    format: exportFormat,
  }),
});

export const createEntrySchema = z.object({ body: entryBody });

export const updateEntrySchema = z.object({
  params: idParams,
  body: z
    .object(entryFields)
    .partial()
    .refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});

export const entryIdSchema = z.object({ params: idParams });

export const importEntriesSchema = z.object({
  body: z.object({
    entries: z
      .array(entryBody)
      .min(1, "Nothing to import")
      .max(MAX_IMPORT_ROWS, `Import at most ${MAX_IMPORT_ROWS} rows at a time`),
  }),
});

export const GRANULARITIES = ["day", "week", "month"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const analyticsSchema = z.object({
  query: z.object({
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    /** Ignore from: start at the business's first recorded entry or order. */
    allTime: queryBool.optional(),
    granularity: z.enum(GRANULARITIES).optional(),
    branchId: uuid.optional(),
  }),
});

export const setBudgetsSchema = z.object({
  body: z.object({
    budgets: z
      .array(z.object({ category: z.enum(FINANCE_CATEGORY_KEYS), monthlyAmount: z.number().int().min(0) }))
      .max(FINANCE_CATEGORY_KEYS.length)
      .refine((rows) => rows.every((r) => categoryOf(r.category)?.kind === "expense"), "Budgets are for expense categories only")
      .refine((rows) => new Set(rows.map((r) => r.category)).size === rows.length, "Each category once"),
  }),
});

export type EntryBody = z.infer<typeof entryBody>;
export type UpdateEntryBody = z.infer<typeof updateEntrySchema>["body"];
export type ListEntriesQuery = z.infer<typeof listEntriesSchema>["query"];
export type AnalyticsQuery = z.infer<typeof analyticsSchema>["query"];
export type BudgetRow = z.infer<typeof setBudgetsSchema>["body"]["budgets"][number];
