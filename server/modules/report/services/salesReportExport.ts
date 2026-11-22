// The sales report as an Excel workbook: a Summary sheet (this period against the one before) and one sheet with the
// rows for the chosen grouping. Pure: no I/O. Money in the file is naira, not kobo.
import ExcelJS from "exceljs";
import type { SalesReportRow, SalesReportTotals } from "./report.service";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const BRAND = "FF1F6F5C";
const MONEY = "#,##0.00";
const GROUP_NAMES: Record<string, string> = { day: "By day", branch: "By branch", menu: "By menu", item: "By item", option: "By option" };
const naira = (kobo: number) => kobo / 100;

export interface SalesWorkbookInput {
  restaurant: string;
  groupBy: string;
  branch: string;
  from: string;
  to: string;
  generatedAt: string;
  totals: SalesReportTotals;
  previous: { from: string; to: string; totals: SalesReportTotals };
  rows: SalesReportRow[];
}

function headerRow(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    c.alignment = { vertical: "middle", wrapText: true };
  });
}

export async function salesReportWorkbook(input: SalesWorkbookInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kiros";
  wb.created = new Date();
  const { totals: t, previous: p } = input;

  // ── Summary ────────────────────────────────────────────────────────────
  const sum = wb.addWorksheet("Summary", { properties: { tabColor: { argb: BRAND } } });
  sum.columns = [{ width: 32 }, { width: 20 }, { width: 20 }, { width: 14 }];
  sum.getCell("A1").value = `${input.restaurant}: sales report`;
  sum.getCell("A1").font = { bold: true, size: 14 };
  const meta: Array<[string, string]> = [
    ["Period", `${input.from} to ${input.to}`],
    ["Compared with", `${p.from} to ${p.to}`],
    ["Branch", input.branch],
    ["Downloaded", input.generatedAt],
  ];
  meta.forEach(([k, v], i) => {
    sum.getCell(i + 2, 1).value = k;
    sum.getCell(i + 2, 1).font = { color: { argb: "FF5B6472" } };
    sum.getCell(i + 2, 2).value = v;
  });
  const start = meta.length + 3;
  sum.getRow(start).values = ["Measure", "This period", "Previous period", "Change"];
  headerRow(sum.getRow(start));
  const lines: Array<[string, number, number, "money" | "count"]> = [
    ["Total sales (₦)", naira(t.revenue), naira(p.totals.revenue), "money"],
    ["Online orders (₦)", naira(t.onlineRevenue), naira(p.totals.onlineRevenue), "money"],
    ["Counter sales (₦)", naira(t.counterRevenue), naira(p.totals.counterRevenue), "money"],
    ["Online orders (number)", t.orders, p.totals.orders, "count"],
    ["Counter sales (number)", t.counterSales, p.totals.counterSales, "count"],
    ["Average sale (₦)", naira(t.averageSaleValue), naira(p.totals.averageSaleValue), "money"],
    ["Units sold: online", t.items, p.totals.items, "count"],
    ["Units sold: counter (where items were listed)", t.counterItems, p.totals.counterItems, "count"],
  ];
  lines.forEach(([label, now, before, kind], i) => {
    const r = sum.getRow(start + 1 + i);
    r.values = [label, now, before, before > 0 ? (now - before) / before : null];
    r.getCell(2).numFmt = kind === "money" ? MONEY : "#,##0";
    r.getCell(3).numFmt = kind === "money" ? MONEY : "#,##0";
    r.getCell(4).numFmt = "0.0%";
  });
  const note = sum.getCell(start + lines.length + 2, 1);
  note.value = "Online orders are paid orders (cancelled and refunded left out). Counter sales are walk-in and catering sales recorded in the app, counted on the date of the sale.";
  note.font = { italic: true, color: { argb: "FF5B6472" } };

  // ── Rows ───────────────────────────────────────────────────────────────
  const name = GROUP_NAMES[input.groupBy] ?? "Rows";
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: name.replace("By ", "").replace(/^./, (c) => c.toUpperCase()), key: "label", width: 30 },
    { header: "Online orders", key: "orders", width: 12 },
    { header: "Online revenue (₦)", key: "online", width: 18, style: { numFmt: MONEY } },
    { header: "Counter sales", key: "csales", width: 12 },
    { header: "Counter revenue (₦)", key: "counter", width: 18, style: { numFmt: MONEY } },
    { header: "Total revenue (₦)", key: "total", width: 18, style: { numFmt: MONEY } },
    { header: "Share of total", key: "share", width: 12, style: { numFmt: "0.0%" } },
    { header: "Units online", key: "items", width: 12 },
    { header: "Units at counter", key: "citems", width: 14 },
    { header: "Delivery fees (₦)", key: "delivery", width: 16, style: { numFmt: MONEY } },
    { header: "Discounts (₦)", key: "discounts", width: 14, style: { numFmt: MONEY } },
  ];
  const grand = input.rows.reduce((s, r) => s + r.revenue, 0);
  for (const r of input.rows) {
    ws.addRow({ label: r.label, orders: r.orders, online: naira(r.onlineRevenue), csales: r.counterSales, counter: naira(r.counterRevenue), total: naira(r.revenue), share: grand > 0 ? r.revenue / grand : null, items: r.items, citems: r.counterItems, delivery: naira(r.deliveryFees), discounts: naira(r.discounts) });
  }
  headerRow(ws.getRow(1));
  if (input.rows.length) {
    const sumOf = (pick: (r: SalesReportRow) => number) => input.rows.reduce((s, r) => s + pick(r), 0);
    const total = ws.addRow({ label: "Total", orders: sumOf((r) => r.orders), online: naira(sumOf((r) => r.onlineRevenue)), csales: sumOf((r) => r.counterSales), counter: naira(sumOf((r) => r.counterRevenue)), total: naira(grand), share: grand > 0 ? 1 : null, items: sumOf((r) => r.items), citems: sumOf((r) => r.counterItems), delivery: naira(sumOf((r) => r.deliveryFees)), discounts: naira(sumOf((r) => r.discounts)) });
    total.font = { bold: true };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 11 } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
