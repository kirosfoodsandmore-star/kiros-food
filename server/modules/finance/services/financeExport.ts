// The books as an Excel workbook: an "Entries" sheet laid out like the import template (so an export can be edited
// and imported again), and a "Summary" sheet with totals by type and category for the same filters. Pure: no I/O.
import ExcelJS from "exceljs";
import { categoryOf, EXPENSE_GROUP_LABELS, FINANCE_KIND_LABELS, type FinanceKind } from "../catalog/finance.catalog";
import type { FinanceEntry } from "../entities/financeEntry.entity";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const PAID_BY: Record<string, string> = { cash: "Cash", transfer: "Bank transfer", pos: "POS", card: "Card", cheque: "Cheque", other: "Other" };
const BRAND = "FF1F6F5C";
const MONEY = "#,##0.00";
const IN: FinanceKind[] = ["capital", "income"];

export interface ExportInput {
  entries: FinanceEntry[];
  /** Each entry's split between vendors / customers. An entry split between several gets one row per person. */
  lines: Array<{ entryId: string; name: string; amount: number }>;
  /** Items sold on offline sales; they get their own sheet. */
  items: Array<{ entryId: string; name: string; quantity: number; unitPrice: number }>;
  branchName: (id: string | null) => string;
  restaurant: string;
  /** Human-readable filters, e.g. [["Period", "1 Jan 2025 – 31 Jan 2025"], ["Type", "Expenses"]]. */
  filters: Array<[string, string]>;
  generatedAt: string;
}

const utcDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const naira = (kobo: number) => kobo / 100;

function header(ws: ExcelJS.Worksheet, row = 1) {
  const r = ws.getRow(row);
  r.height = 22;
  r.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    c.alignment = { vertical: "middle" };
  });
}

export async function buildEntriesWorkbook(input: ExportInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kiros";
  wb.created = new Date();

  // ── Entries: same first nine columns as the import template ────────────
  const ws = wb.addWorksheet("Entries", { properties: { tabColor: { argb: BRAND } }, views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Date", key: "date", width: 13, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Category", key: "category", width: 26 },
    { header: "Description", key: "title", width: 32 },
    { header: "Amount (₦)", key: "amount", width: 16, style: { numFmt: MONEY } },
    { header: "Vendor / paid to", key: "vendor", width: 24 },
    { header: "Paid by", key: "method", width: 14 },
    { header: "Reference", key: "reference", width: 16 },
    { header: "Notes", key: "notes", width: 30 },
    { header: "Branch", key: "branch", width: 18 },
    { header: "Type", key: "kind", width: 14 },
    { header: "Group", key: "group", width: 18 },
    { header: "Recorded by", key: "by", width: 18 },
  ];
  const linesOf = new Map<string, Array<{ name: string; amount: number }>>();
  for (const l of input.lines) linesOf.set(l.entryId, [...(linesOf.get(l.entryId) ?? []), l]);
  // One row per person paid (or paid by), so every row imports back as a correct entry of its own.
  const rows = input.entries.flatMap((e) => {
    const lines = linesOf.get(e.id) ?? [];
    return lines.length ? lines.map((l) => ({ e, vendor: l.name, amount: l.amount })) : [{ e, vendor: e.party ?? "", amount: e.amount }];
  });
  for (const { e, vendor, amount } of rows) {
    const cat = categoryOf(e.category);
    ws.addRow({
      date: utcDate(e.entryDate),
      category: cat?.label ?? e.category,
      title: e.title,
      amount: naira(amount),
      vendor,
      method: e.paymentMethod ? (PAID_BY[e.paymentMethod] ?? e.paymentMethod) : "",
      reference: e.reference ?? "",
      notes: e.notes ?? "",
      // Blank = whole business, exactly as the import expects.
      branch: e.branchId ? input.branchName(e.branchId) : "",
      kind: FINANCE_KIND_LABELS[e.kind],
      group: cat?.group ? EXPENSE_GROUP_LABELS[cat.group] : "",
      by: e.createdByName ?? "",
    });
  }
  header(ws);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 12 } };

  // ── Items sold: one row per item on an offline sale ────────────────────
  if (input.items.length) {
    const byId = new Map(input.entries.map((e) => [e.id, e]));
    const it = wb.addWorksheet("Items sold", { views: [{ state: "frozen", ySplit: 1 }] });
    it.columns = [
      { header: "Date", key: "date", width: 13, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Sale", key: "sale", width: 30 },
      { header: "Item", key: "item", width: 30 },
      { header: "Quantity", key: "qty", width: 10 },
      { header: "Unit price (₦)", key: "price", width: 16, style: { numFmt: MONEY } },
      { header: "Total (₦)", key: "total", width: 16, style: { numFmt: MONEY } },
      { header: "Branch", key: "branch", width: 18 },
    ];
    for (const l of input.items) {
      const e = byId.get(l.entryId);
      if (!e) continue;
      it.addRow({ date: utcDate(e.entryDate), sale: e.title, item: l.name, qty: l.quantity, price: naira(l.unitPrice), total: naira(l.quantity * l.unitPrice), branch: e.branchId ? input.branchName(e.branchId) : "" });
    }
    header(it);
  }

  // ── Summary ────────────────────────────────────────────────────────────
  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ width: 30 }, { width: 28 }, { width: 20 }, { width: 10 }, { width: 18 }];
  sum.getCell("A1").value = `${input.restaurant}: capital & expenses`;
  sum.getCell("A1").font = { bold: true, size: 14 };
  let r = 2;
  for (const [label, value] of [...input.filters, ["Downloaded", input.generatedAt] as [string, string]]) {
    sum.getCell(r, 1).value = label;
    sum.getCell(r, 1).font = { color: { argb: "FF5B6472" } };
    sum.getCell(r, 2).value = value;
    r++;
  }
  r++;

  const totals = new Map<string, { kind: FinanceKind; category: string; count: number; amount: number }>();
  for (const e of input.entries) {
    const t = totals.get(e.category) ?? { kind: e.kind, category: e.category, count: 0, amount: 0 };
    t.count++;
    t.amount += e.amount;
    totals.set(e.category, t);
  }
  const headRow = r;
  sum.getRow(r).values = ["Type", "Category", "Group", "Entries", "Total (₦)"];
  header(sum, r);
  r++;
  const kindTotal = new Map<FinanceKind, number>();
  for (const kind of ["capital", "income", "expense", "withdrawal"] as FinanceKind[]) {
    const rows = [...totals.values()].filter((t) => t.kind === kind).sort((a, b) => b.amount - a.amount);
    if (!rows.length) continue;
    for (const t of rows) {
      const cat = categoryOf(t.category);
      sum.getRow(r).values = [FINANCE_KIND_LABELS[kind], cat?.label ?? t.category, cat?.group ? EXPENSE_GROUP_LABELS[cat.group] : "", t.count, naira(t.amount)];
      r++;
    }
    const subtotal = rows.reduce((s, t) => s + t.amount, 0);
    kindTotal.set(kind, subtotal);
    sum.getRow(r).values = [`Total ${FINANCE_KIND_LABELS[kind].toLowerCase()}`, "", "", rows.reduce((s, t) => s + t.count, 0), naira(subtotal)];
    sum.getRow(r).font = { bold: true };
    r += 2;
  }
  if (headRow + 1 === r) {
    sum.getCell(r, 1).value = "No entries match these filters.";
    r += 2;
  }
  const moneyIn = IN.reduce((s, k) => s + (kindTotal.get(k) ?? 0), 0);
  const moneyOut = (kindTotal.get("expense") ?? 0) + (kindTotal.get("withdrawal") ?? 0);
  for (const [label, value] of [["Money in (capital + other income)", moneyIn], ["Money out (expenses + money taken out)", moneyOut], ["Net", moneyIn - moneyOut]] as Array<[string, number]>) {
    sum.getRow(r).values = [label, "", "", "", naira(value)];
    sum.getRow(r).font = { bold: label === "Net" };
    r++;
  }
  sum.getCell(r + 1, 1).value = "App orders aren't in this file: see Sales reports, or Analytics for everything together.";
  sum.getCell(r + 1, 1).font = { italic: true, color: { argb: "FF5B6472" } };
  sum.getColumn(5).numFmt = MONEY;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
