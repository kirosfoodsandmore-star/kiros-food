// Finance helpers: labels, period presets, bucket labels, and the CSV import parser.
import { format, parseISO } from "date-fns"
import { toMinor } from "@/lib/money"
import type { FinanceCategory, FinanceEntryInput, FinanceKind, Granularity } from "@/types/finance.types"

export const KIND_LABELS: Record<FinanceKind, string> = { capital: "Capital in", expense: "Expense", income: "Other income", withdrawal: "Money out" }
export const KIND_HINTS: Record<FinanceKind, string> = {
  capital: "Money put into the business: savings, investors, loans, or the cash you started with.",
  expense: "Anything the business spends: stock, rent, salaries, fuel, equipment…",
  income: "Sales the app didn't take: walk-in customers, catering, events.",
  withdrawal: "Money taken out: owner's drawings, loan repayments, profit shares.",
}
/** Money in (+) or out (−) of the business's cash. */
export const KIND_SIGN: Record<FinanceKind, 1 | -1> = { capital: 1, income: 1, expense: -1, withdrawal: -1 }

export const PAYMENT_METHOD_LABELS: Record<string, string> = { cash: "Cash", transfer: "Bank transfer", pos: "POS", card: "Card", cheque: "Cheque", other: "Other" }

export const pct = (r: number | null | undefined, digits = 0) => (r === null || r === undefined ? "—" : `${(r * 100).toFixed(digits)}%`)

/** Signed change between two numbers as a ratio (null when there's nothing to compare against). */
export function change(now: number, before: number): number | null {
  if (before === 0) return null
  return (now - before) / Math.abs(before)
}

export function bucketLabel(bucket: string, g: Granularity, long = false): string {
  const d = parseISO(bucket)
  if (g === "month") return format(d, long ? "MMMM yyyy" : "MMM yy")
  if (g === "week") return long ? `Week of ${format(d, "d MMM yyyy")}` : format(d, "d MMM")
  return format(d, long ? "EEE d MMM yyyy" : "d MMM")
}

// ── Period presets ───────────────────────────────────────────────────────

export type Preset = "30d" | "90d" | "6m" | "12m" | "ytd" | "all" | "custom"
export const PRESETS: Array<[Preset, string]> = [["30d", "30 days"], ["90d", "90 days"], ["6m", "6 months"], ["12m", "12 months"], ["ytd", "This year"], ["all", "All time"], ["custom", "Custom"]]

const iso = (d: Date) => format(d, "yyyy-MM-dd")
export function presetRange(p: Preset, custom: { from: string; to: string }): { from?: string; to?: string; allTime?: boolean } {
  const today = new Date()
  const back = (days: number) => { const d = new Date(today); d.setDate(d.getDate() - days + 1); return iso(d) }
  const months = (m: number) => { const d = new Date(today); d.setMonth(d.getMonth() - m); d.setDate(d.getDate() + 1); return iso(d) }
  switch (p) {
    case "30d": return { from: back(30), to: iso(today) }
    case "90d": return { from: back(90), to: iso(today) }
    case "6m": return { from: months(6), to: iso(today) }
    case "12m": return { from: months(12), to: iso(today) }
    case "ytd": return { from: `${today.getFullYear()}-01-01`, to: iso(today) }
    case "all": return { allTime: true }
    default: return { from: custom.from || undefined, to: custom.to || undefined }
  }
}

// ── CSV import ───────────────────────────────────────────────────────────

/** RFC-4180-ish: quoted fields, doubled quotes, commas/newlines inside quotes. Also accepts ; or tab separated. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "")
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ""
  const sep = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? "\t" : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ","
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { row.push(cell); cell = "" }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      row.push(cell); cell = ""
      if (row.some((c) => c.trim() !== "")) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== "")) rows.push(row)
  return rows
}

export const IMPORT_COLUMNS = ["date", "kind", "category", "title", "amount", "vendor", "method", "reference", "notes", "branch"] as const

const HEADER_ALIASES: Record<string, (typeof IMPORT_COLUMNS)[number]> = {
  date: "date", day: "date", "entry date": "date", "transaction date": "date",
  kind: "kind", type: "kind",
  category: "category", "expense category": "category",
  title: "title", description: "title", item: "title", details: "title", narration: "title",
  amount: "amount", "amount (₦)": "amount", "amount (naira)": "amount", naira: "amount", value: "amount", cost: "amount",
  vendor: "vendor", party: "vendor", payee: "vendor", supplier: "vendor", "paid to": "vendor", "vendor / paid to": "vendor", "vendor/paid to": "vendor", from: "vendor",
  method: "method", "payment method": "method", "paid by": "method",
  reference: "reference", ref: "reference", receipt: "reference",
  notes: "notes", note: "notes", comment: "notes",
  branch: "branch", location: "branch",
}

const KIND_ALIASES: Record<string, FinanceKind> = {
  capital: "capital", "capital in": "capital", investment: "capital", funding: "capital",
  expense: "expense", expenses: "expense", cost: "expense", spend: "expense",
  income: "income", "other income": "income", sale: "income", sales: "income", revenue: "income",
  withdrawal: "withdrawal", "money out": "withdrawal", drawing: "withdrawal", drawings: "withdrawal",
}

/** Accepts 2025-02-01, 01/02/2025 (day first, as in Nigeria), 1 Feb 2025, and Excel's day numbers (45658). */
export function parseDateLoose(v: string): string | null {
  const s = v.trim()
  // A date cell Excel stored as a plain number (days since 30 Dec 1899): 20000 ≈ 1954, 80000 ≈ 2119.
  if (/^\d{5}(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 86_400_000)
    return valid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1])
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : iso(new Date(t))
}
function valid(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ")

export interface ImportRow {
  line: number
  entry: FinanceEntryInput | null
  error: string | null
  raw: string[]
}

/** Pasted or CSV text → rows to import. */
export function buildImport(text: string, categories: FinanceCategory[], branches: Array<{ id: string; name: string }>, today: string): { rows: ImportRow[]; missing: string[] } {
  return buildImportFromTable(parseCsv(text), categories, branches, today)
}

/** Rows of cells (header first, e.g. read from an Excel sheet) → rows to import, each valid or with the reason it isn't. */
/** `lines`: the source row number of each table row (Excel rows, when blank rows were skipped). */
export function buildImportFromTable(table: string[][], categories: FinanceCategory[], branches: Array<{ id: string; name: string }>, today: string, lines?: number[]): { rows: ImportRow[]; missing: string[] } {
  if (table.length === 0) return { rows: [], missing: ["date", "category", "amount"] }
  const header = table[0].map((h) => HEADER_ALIASES[norm(h)] ?? null)
  const col = (name: (typeof IMPORT_COLUMNS)[number]) => header.indexOf(name)
  const missing = (["date", "category", "amount"] as const).filter((c) => col(c) < 0)
  if (missing.length) return { rows: [], missing: [...missing] }
  const catBy = new Map<string, FinanceCategory>()
  for (const c of categories) { catBy.set(norm(c.key), c); catBy.set(norm(c.label), c); catBy.set(norm(c.key.replace(/_/g, " ")), c) }
  const branchBy = new Map(branches.map((b) => [norm(b.name), b.id]))
  const get = (r: string[], name: (typeof IMPORT_COLUMNS)[number]) => (col(name) >= 0 ? (r[col(name)] ?? "").trim() : "")

  const rows = table.slice(1).map((r, i): ImportRow => {
    const line = lines?.[i + 1] ?? i + 2
    const fail = (error: string): ImportRow => ({ line, entry: null, error, raw: r })
    const date = parseDateLoose(get(r, "date"))
    if (!date) return fail(`Date "${get(r, "date")}" isn't a date`)
    if (date > today) return fail("Date is in the future")
    const cat = catBy.get(norm(get(r, "category")))
    if (!cat) return fail(`Unknown category "${get(r, "category")}"`)
    const kindText = get(r, "kind")
    const kind = kindText ? KIND_ALIASES[norm(kindText)] : cat.kind
    if (!kind) return fail(`Unknown kind "${kindText}"`)
    if (kind !== cat.kind) {
      const its = KIND_LABELS[cat.kind].toLowerCase()
      return fail(`"${cat.label}" is ${/^[aeiou]/.test(its) ? "an" : "a"} ${its} category, not ${KIND_LABELS[kind].toLowerCase()}`)
    }
    const amount = toMinor(get(r, "amount").replace(/[₦,\s]/g, ""))
    if (!(amount > 0)) return fail(`Amount "${get(r, "amount")}" must be more than zero`)
    const branchText = get(r, "branch")
    const branchId = branchText ? branchBy.get(norm(branchText)) : null
    if (branchText && !branchId) return fail(`No branch called "${branchText}"`)
    const methodText = norm(get(r, "method"))
    const method = Object.entries(PAYMENT_METHOD_LABELS).find(([k, l]) => k === methodText || norm(l) === methodText)?.[0] ?? (methodText ? "other" : null)
    return {
      line,
      error: null,
      raw: r,
      entry: {
        kind,
        category: cat.key,
        title: (get(r, "title") || cat.label).slice(0, 160),
        amount,
        entryDate: date,
        branchId: branchId ?? null,
        paymentMethod: method,
        party: get(r, "vendor").slice(0, 160) || null,
        reference: get(r, "reference").slice(0, 80) || null,
        notes: get(r, "notes").slice(0, 2000) || null,
      },
    }
  })
  return { rows, missing: [] }
}

/**
 * The sales day (YYYY-MM-DD in the restaurant's time zone) a moment falls on. The day rolls over at `startsHour`
 * (6 = 6am), not midnight, so a 1am sale still belongs to the evening before. Mirrors the server's rule.
 */
export function salesDay(at: Date | string, timeZone: string, startsHour: number): string {
  const shifted = new Date(new Date(at).getTime() - startsHour * 3_600_000)
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(shifted)
}
