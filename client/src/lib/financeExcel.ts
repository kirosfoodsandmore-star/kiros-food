// Excel (.xlsx) for the finance import: a ready-to-fill template with dropdowns, and a reader for filled-in files.
// ExcelJS is large, so it's loaded only when someone actually downloads a template or picks a file.
import type { Workbook, Worksheet } from "exceljs"
import { PAYMENT_METHOD_LABELS } from "@/lib/finance"
import type { FinanceCatalog } from "@/types/finance.types"

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
/** The sheet the import reads. Anything on other sheets (the example, the category list) is ignored. */
export const ENTRIES_SHEET = "Entries"
/** Rows prepared with dropdowns; also the most one import accepts. */
export const TEMPLATE_ROWS = 1000

async function excel() {
  const mod = await import("exceljs")
  return (mod as unknown as { default?: typeof mod }).default ?? mod
}

const COLUMNS: Array<{ header: string; key: string; width: number; note: string }> = [
  { header: "Date", key: "date", width: 13, note: "The day it happened, e.g. 31/01/2025. Past dates are fine; future dates are not." },
  { header: "Category", key: "category", width: 28, note: "Pick from the list. The category decides whether it's capital in, an expense, other income or money out." },
  { header: "Description", key: "title", width: 32, note: "What it was for. Optional: the category name is used when blank." },
  { header: "Amount (₦)", key: "amount", width: 15, note: "In naira, more than zero." },
  { header: "Vendor / paid to", key: "vendor", width: 24, note: "Optional: supplier, landlord, investor…" },
  { header: "Paid by", key: "method", width: 15, note: "Optional: pick from the list." },
  { header: "Reference", key: "reference", width: 16, note: "Optional: receipt or invoice number." },
  { header: "Notes", key: "notes", width: 30, note: "Optional." },
  { header: "Branch", key: "branch", width: 18, note: "Optional: leave blank for the whole business." },
]

const BRAND = "FF1F6F5C"
const KIND_NAMES: Record<string, string> = { capital: "Capital in", expense: "Expense", income: "Other income", withdrawal: "Money out" }

function styleHeader(ws: Worksheet) {
  const row = ws.getRow(1)
  row.height = 22
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } }
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } }
    c.alignment = { vertical: "middle" }
  })
  ws.views = [{ state: "frozen", ySplit: 1 }]
}

function addEntrySheet(wb: Workbook, name: string) {
  const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: BRAND } } })
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }))
  COLUMNS.forEach((c, i) => { ws.getCell(1, i + 1).note = c.note })
  ws.getColumn("date").numFmt = "dd/mm/yyyy"
  ws.getColumn("amount").numFmt = "#,##0.00"
  styleHeader(ws)
  return ws
}

/** The example rows (the worked example from the user stories guide). */
const EXAMPLE: Array<[string, string, string, number, string, string]> = [
  ["2025-01-02", "Owner's investment", "Savings to start", 5_000_000, "Founder", "Bank transfer"],
  ["2025-01-05", "Equipment & tools", "Fryer and freezer", 1_200_000, "Kitchen Pro Ltd", "Bank transfer"],
  ["2025-01-06", "Rent", "January rent", 250_000, "Landlord", "Bank transfer"],
  ["2025-01-10", "Ingredients & stock", "Market runs", 350_000, "Mile 12 market", "Cash"],
  ["2025-01-12", "Packaging", "Takeaway packs", 50_000, "PackRite", "POS"],
  ["2025-01-31", "Salaries & wages", "January pay", 300_000, "", "Bank transfer"],
  ["2025-01-31", "Walk-in / offline sales", "January counter sales", 1_200_000, "", "Cash"],
  ["2025-01-31", "Owner's drawings", "Owner's draw", 100_000, "Founder", "Bank transfer"],
]

/** A template workbook: Entries (to fill, with dropdowns), Example, Categories, How to fill. */
export async function buildTemplate(catalog: FinanceCatalog, branches: Array<{ name: string }>): Promise<Blob> {
  const ExcelJS = await excel()
  const wb = new ExcelJS.Workbook()
  wb.creator = "Kiros"
  wb.created = new Date()
  const groupLabel = new Map(catalog.groups.map((g) => [g.key, g.label]))
  const methods = catalog.paymentMethods.map((m) => PAYMENT_METHOD_LABELS[m] ?? m)

  const entries = addEntrySheet(wb, ENTRIES_SHEET)
  const example = addEntrySheet(wb, "Example")
  const cats = wb.addWorksheet("Categories")
  const help = wb.addWorksheet("How to fill")
  // Dropdown sources live on a hidden sheet so they can't be edited by accident.
  const lists = wb.addWorksheet("Lists", { state: "hidden" })

  lists.getColumn(1).values = ["Category", ...catalog.categories.map((c) => c.label)]
  lists.getColumn(2).values = ["Paid by", ...methods]
  lists.getColumn(3).values = ["Branch", ...branches.map((b) => b.name)]

  const lastCat = catalog.categories.length + 1
  const lastMethod = methods.length + 1
  const lastBranch = branches.length + 1
  for (let r = 2; r <= TEMPLATE_ROWS + 1; r++) {
    const row = entries.getRow(r)
    row.getCell("date").dataValidation = { type: "date", operator: "lessThanOrEqual", allowBlank: true, formulae: ["TODAY()"], showErrorMessage: true, errorTitle: "Date", error: "Enter a date like 31/01/2025 (not in the future)." }
    row.getCell("category").dataValidation = { type: "list", allowBlank: true, formulae: [`Lists!$A$2:$A$${lastCat}`], showErrorMessage: true, errorTitle: "Category", error: "Pick a category from the list (see the Categories sheet)." }
    row.getCell("amount").dataValidation = { type: "decimal", operator: "greaterThan", allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: "Amount", error: "Enter the amount in naira, more than zero." }
    row.getCell("method").dataValidation = { type: "list", allowBlank: true, formulae: [`Lists!$B$2:$B$${lastMethod}`], showErrorMessage: true, errorTitle: "Paid by", error: "Pick from the list, or leave blank." }
    if (branches.length) row.getCell("branch").dataValidation = { type: "list", allowBlank: true, formulae: [`Lists!$C$2:$C$${lastBranch}`], showErrorMessage: true, errorTitle: "Branch", error: "Pick a branch from the list, or leave blank for the whole business." }
  }

  for (const [date, category, title, amount, vendor, method] of EXAMPLE) {
    example.addRow({ date: new Date(`${date}T00:00:00Z`), category, title, amount, vendor, method })
  }
  example.addRow({})
  const note = example.addRow({ date: "This sheet is only an example and is never imported. Fill in the Entries sheet." })
  note.font = { italic: true, color: { argb: "FF5B6472" } }

  cats.columns = [{ header: "Category", key: "label", width: 30 }, { header: "Type", key: "kind", width: 16 }, { header: "Group", key: "group", width: 20 }]
  for (const c of catalog.categories) cats.addRow({ label: c.label, kind: KIND_NAMES[c.kind] ?? c.kind, group: c.group ? groupLabel.get(c.group) ?? c.group : "" })
  styleHeader(cats)

  help.getColumn(1).width = 110
  const lines = [
    "How to fill in this sheet",
    "",
    `1. Use the "${ENTRIES_SHEET}" sheet: one row per money movement. Delete nothing above row 1.`,
    "2. Date, Category and Amount are required. Everything else is optional.",
    "3. Category decides the type: Owner's investment is capital in, Rent is an expense, Walk-in / offline sales is other income, Owner's drawings is money out. The full list is on the Categories sheet.",
    "4. Amounts are in naira. Monthly totals are fine if you don't have every receipt.",
    "5. Leave Branch blank for costs that belong to the whole business (e.g. accountant, central marketing).",
    `6. Up to ${TEMPLATE_ROWS.toLocaleString()} rows per file. For a longer history, use one file per year.`,
    "7. Save the file (keep it as .xlsx), then in Kiros go to Capital & expenses → Import → Choose Excel file.",
    "8. Kiros shows a preview first. Rows with a problem are listed with the reason and skipped; nothing is saved until you click Import.",
    "",
    'The "Example" sheet shows a finished month. It is never imported.',
  ]
  lines.forEach((l, i) => { help.getCell(i + 1, 1).value = l })
  help.getCell(1, 1).font = { bold: true, size: 14 }

  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }]
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: XLSX_MIME })
}

/** Plain text for one cell, whatever Excel stored: dates as YYYY-MM-DD, formulas as their result. */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return ""
    // Excel dates have no time zone; ExcelJS gives them as UTC midnight.
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (typeof v === "string") return v
  if (typeof v === "object") {
    const o = v as { result?: unknown; richText?: Array<{ text: string }>; text?: unknown; error?: unknown }
    if ("result" in o) return cellText(o.result)
    if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join("")
    if ("text" in o) return cellText(o.text)
    if ("error" in o) return ""
  }
  return String(v)
}

/** Reads the Entries sheet (or the first visible sheet) of an .xlsx file into rows of text, header row first. */
export async function readWorkbook(data: ArrayBuffer): Promise<{ sheet: string; rows: string[][]; lines: number[] }> {
  const ExcelJS = await excel()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(data)
  const ws = wb.getWorksheet(ENTRIES_SHEET) ?? wb.worksheets.find((w) => w.state === "visible") ?? wb.worksheets[0]
  if (!ws) return { sheet: "", rows: [], lines: [] }
  const width = ws.actualColumnCount || ws.columnCount
  const rows: string[][] = []
  const lines: number[] = []
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells = Array.from({ length: width }, (_, i) => cellText(row.getCell(i + 1).value).trim())
    if (cells.some((c) => c !== "")) {
      rows.push(cells)
      lines.push(rowNumber)
    }
  })
  return { sheet: ws.name, rows, lines }
}
