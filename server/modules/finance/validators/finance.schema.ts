import { z } from "zod";
import { dateOnly, idParams, money, optionalText, pageQuery, positiveMoney, queryBool, requiredText, uuid } from "../../../shared/validation/common";
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
  /** One name (older clients and imports): saved as a single line for the whole amount. */
  party: optionalText(160),
  /**
   * Who it was paid to / received from, each with their share; the shares must add up to `amount`. A line names a
   * saved party by id, or by name (found case-insensitively, or created). [] clears them.
   */
  parties: z
    .array(
      z
        .object({ partyId: uuid.optional(), name: z.string().trim().min(1).max(160).optional(), amount: positiveMoney })
        .refine((l) => Boolean(l.partyId || l.name), "Choose or type a name")
    )
    .max(50, "At most 50 people per entry")
    .optional(),
  /**
   * What was sold (offline sales): menu items by id (or a typed name for something off the menu), how many, and the price
   * charged each. The amount must equal the sum of quantity × unit price. Only for other income. [] clears them.
   */
  items: z
    .array(
      z
        .object({ itemId: uuid.optional(), name: z.string().trim().min(1).max(160).optional(), quantity: z.number().int().min(1).max(9999), unitPrice: money })
        .refine((l) => Boolean(l.itemId || l.name), "Choose an item or type its name")
    )
    .max(100, "At most 100 items on one sale")
    .optional(),
  reference: optionalText(80),
  notes: optionalText(2000),
};

const itemsOnlyForIncome = (e: { kind?: string; items?: unknown[] }) => !e.items?.length || !e.kind || e.kind === "income";
const entryBody = z
  .object(entryFields)
  .refine(matchesKind, kindMismatch)
  .refine(itemsOnlyForIncome, { message: "Items can only be listed on a sale (other income)", path: ["items"] });

export const listEntriesSchema = z.object({
  query: z.object({
    ...pageQuery,
    limit: z.coerce.number().int().min(1).max(200).default(25),
    kind: z.enum(FINANCE_KINDS).optional(),
    category: z.enum(FINANCE_CATEGORY_KEYS).optional(),
    branchId: uuid.optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    /** json = a page of entries; xlsx = every matching entry as an Excel workbook (needs reports.export). */
    format: z.enum(["json", "xlsx"]).default("json"),
    /** date = by the day the money moved (the ledger); recorded = by when it was entered, newest first (the Record sales page). */
    sort: z.enum(["date", "recorded"]).default("date"),
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

// ── Saved vendors & customers ──────────────────────────────────────────────

const partyFields = { name: requiredText(160), phone: optionalText(40), notes: optionalText(500) };
export const createPartySchema = z.object({ body: z.object(partyFields) });
export const updatePartySchema = z.object({
  params: idParams,
  body: z.object(partyFields).partial().refine((b) => Object.keys(b).length > 0, "Nothing to update"),
});
export const partyIdSchema = z.object({ params: idParams });
export const mergePartySchema = z.object({ params: idParams, body: z.object({ intoId: uuid }) });

export type PartyLineBody = NonNullable<EntryBody["parties"]>[number];
export type PartyBody = z.infer<typeof createPartySchema>["body"];
export type UpdatePartyBody = z.infer<typeof updatePartySchema>["body"];

export type SaleItemLineBody = NonNullable<EntryBody["items"]>[number];
export const saleItemsQuerySchema = z.object({ query: z.object({ branchId: uuid.optional() }) });
