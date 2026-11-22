// Pure business-analytics maths over ledger + order aggregates. No I/O.
// Money is kobo. Ratios are 0–1 (null when the denominator is zero).
import { addDays } from "../../../shared/utils/dates";
import type { ExpenseGroup } from "../catalog/finance.catalog";
import type { Granularity } from "../validators/finance.schema";

export interface LedgerAmount {
  kind: string;
  category: string;
  amount: number;
}

export interface PeriodTotals {
  appRevenue: number;
  otherIncome: number;
  revenue: number;
  costOfSales: number;
  operating: number;
  capex: number;
  /** cost of sales + running costs + assets */
  expenses: number;
  salaries: number;
  capitalIn: number;
  withdrawals: number;
  grossProfit: number;
  /** revenue − cost of sales − running costs (assets excluded: they're investment, not a running cost). */
  operatingProfit: number;
  /** Everything in minus everything out, capital and drawings included. */
  netCashFlow: number;
  orders: number;
  averageOrderValue: number;
  grossMargin: number | null;
  operatingMargin: number | null;
  foodCostRatio: number | null;
  labourRatio: number | null;
  primeCostRatio: number | null;
}

export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/**
 * Totals for a set of ledger rows. `groupOf` says where each expense category sits on the profit-and-loss; it's the
 * restaurant's own list (the owner can move a category between cost of sales, running costs and assets).
 */
export function totalsOf(ledger: LedgerAmount[], appRevenue: number, orders: number, groupOf: (category: string) => ExpenseGroup): PeriodTotals {
  let otherIncome = 0, costOfSales = 0, operating = 0, capex = 0, salaries = 0, capitalIn = 0, withdrawals = 0;
  for (const r of ledger) {
    if (r.kind === "income") otherIncome += r.amount;
    else if (r.kind === "capital") capitalIn += r.amount;
    else if (r.kind === "withdrawal") withdrawals += r.amount;
    else if (r.kind === "expense") {
      const g = groupOf(r.category);
      if (g === "cost_of_sales") costOfSales += r.amount;
      else if (g === "capex") capex += r.amount;
      else operating += r.amount;
      if (r.category === "salaries") salaries += r.amount;
    }
  }
  const revenue = appRevenue + otherIncome;
  const expenses = costOfSales + operating + capex;
  const grossProfit = revenue - costOfSales;
  const operatingProfit = grossProfit - operating;
  return {
    appRevenue,
    otherIncome,
    revenue,
    costOfSales,
    operating,
    capex,
    expenses,
    salaries,
    capitalIn,
    withdrawals,
    grossProfit,
    operatingProfit,
    netCashFlow: revenue + capitalIn - expenses - withdrawals,
    orders,
    averageOrderValue: orders > 0 ? Math.round(appRevenue / orders) : 0,
    grossMargin: ratio(grossProfit, revenue),
    operatingMargin: ratio(operatingProfit, revenue),
    foodCostRatio: ratio(costOfSales, revenue),
    labourRatio: ratio(salaries, revenue),
    primeCostRatio: ratio(costOfSales + salaries, revenue),
  };
}

// ── Buckets ──────────────────────────────────────────────────────────────

/** Day count of an inclusive YYYY-MM-DD range. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export function autoGranularity(from: string, to: string): Granularity {
  const days = daysBetween(from, to);
  if (days <= 45) return "day";
  if (days <= 190) return "week";
  return "month";
}

/** The start of the bucket holding `date` (weeks start Monday, like Postgres date_trunc). */
export function bucketStart(date: string, g: Granularity): string {
  if (g === "day") return date;
  if (g === "month") return `${date.slice(0, 7)}-01`;
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export function nextBucket(start: string, g: Granularity): string {
  if (g === "day") return addDays(start, 1);
  if (g === "week") return addDays(start, 7);
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function bucketList(from: string, to: string, g: Granularity, cap = 800): string[] {
  const out: string[] = [];
  for (let b = bucketStart(from, g); b <= to && out.length < cap; b = nextBucket(b, g)) out.push(b);
  return out;
}

/** The equally long period just before [from, to]. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const days = daysBetween(from, to);
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

/** Months spanned by a range (fractional, at least one day's worth). */
export function monthsIn(from: string, to: string): number {
  return Math.max(daysBetween(from, to), 1) / 30.4375;
}

// ── Insights ─────────────────────────────────────────────────────────────

export type InsightTone = "good" | "warning" | "critical" | "info";
export interface Insight {
  tone: InsightTone;
  title: string;
  detail: string;
}

export interface InsightInput {
  current: PeriodTotals;
  previous: PeriodTotals;
  expenseByCategory: Array<{ category: string; amount: number; previous: number; budget: number | null }>;
  busiest: { weekday: number; hour: number; orders: number } | null;
  cashPosition: number;
  monthlyBurn: number;
  runwayMonths: number | null;
  breakEvenMonthlyRevenue: number | null;
  averageMonthlyRevenue: number;
  paybackRatio: number | null;
  months: number;
  hasLedger: boolean;
  fmt: (kobo: number) => string;
  /** A category's name, from the restaurant's own list. */
  categoryLabel: (category: string) => string;
}

const pct = (r: number) => `${Math.round(r * 100)}%`;
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

/** Plain-language observations, most important first. Thresholds are common restaurant benchmarks. */
export function buildInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  const { current: c, previous: p, fmt } = i;

  if (!i.hasLedger) {
    out.push({ tone: "info", title: "Record your costs to unlock profit", detail: "Only app sales are counted so far. Add capital, expenses and walk-in sales (or import them) to see margins, break-even and cash position." });
  }

  if (c.revenue > 0 || c.expenses > 0) {
    if (c.operatingProfit >= 0) out.push({ tone: "good", title: `Profitable: ${fmt(c.operatingProfit)} operating profit`, detail: c.operatingMargin !== null ? `That's a ${pct(c.operatingMargin)} margin on ${fmt(c.revenue)} revenue.` : "Revenue covered cost of sales and running costs." });
    else out.push({ tone: "critical", title: `Running at a loss of ${fmt(-c.operatingProfit)}`, detail: `Cost of sales and running costs (${fmt(c.costOfSales + c.operating)}) were more than revenue (${fmt(c.revenue)}).` });
  }

  if (p.revenue > 0 && c.revenue > 0) {
    const change = (c.revenue - p.revenue) / p.revenue;
    if (Math.abs(change) >= 0.05) out.push({ tone: change > 0 ? "good" : "warning", title: `Revenue ${change > 0 ? "up" : "down"} ${pct(Math.abs(change))} on the previous period`, detail: `${fmt(c.revenue)} against ${fmt(p.revenue)}.` });
  }
  const runPrev = p.costOfSales + p.operating;
  const runNow = c.costOfSales + c.operating;
  if (runPrev > 0 && runNow > 0) {
    const change = (runNow - runPrev) / runPrev;
    const revChange = p.revenue > 0 ? (c.revenue - p.revenue) / p.revenue : 0;
    if (change >= 0.1 && change > revChange + 0.05) out.push({ tone: "warning", title: `Costs grew faster than sales (${pct(change)})`, detail: `Running costs and cost of sales rose to ${fmt(runNow)} while revenue moved ${revChange >= 0 ? "+" : ""}${pct(revChange)}.` });
  }

  if (c.foodCostRatio !== null && c.costOfSales > 0) {
    if (c.foodCostRatio > 0.38) out.push({ tone: "warning", title: `Food cost is ${pct(c.foodCostRatio)} of revenue`, detail: "Most restaurants aim for 28–35%. Check portion sizes, supplier prices and waste, or revisit menu prices." });
    else if (c.foodCostRatio <= 0.35) out.push({ tone: "good", title: `Food cost is healthy at ${pct(c.foodCostRatio)}`, detail: "Within the usual 28–35% target." });
  }
  if (c.primeCostRatio !== null && c.salaries > 0 && c.primeCostRatio > 0.65) {
    out.push({ tone: "warning", title: `Prime cost is ${pct(c.primeCostRatio)} of revenue`, detail: "Food plus labour above 65% leaves little for rent and everything else; 55–65% is the common target." });
  }

  const overBudget = i.expenseByCategory
    .filter((e) => e.budget !== null && e.budget > 0 && e.amount > e.budget * i.months * 1.05)
    .sort((a, b) => b.amount / (b.budget! * i.months) - a.amount / (a.budget! * i.months));
  for (const e of overBudget.slice(0, 2)) {
    const planned = Math.round(e.budget! * i.months);
    out.push({ tone: "warning", title: `${i.categoryLabel(e.category)} is over budget`, detail: `${fmt(e.amount)} spent against ${fmt(planned)} planned for this period (${pct(e.amount / planned - 1)} over).` });
  }

  const totalExp = i.expenseByCategory.reduce((s, e) => s + e.amount, 0);
  const top = [...i.expenseByCategory].sort((a, b) => b.amount - a.amount)[0];
  if (top && totalExp > 0 && top.amount / totalExp >= 0.3) {
    out.push({ tone: "info", title: `${i.categoryLabel(top.category)} is your biggest cost`, detail: `${pct(top.amount / totalExp)} of all spending (${fmt(top.amount)}).` });
  }

  if (i.breakEvenMonthlyRevenue !== null && i.breakEvenMonthlyRevenue > 0) {
    const gap = i.averageMonthlyRevenue - i.breakEvenMonthlyRevenue;
    out.push({ tone: gap >= 0 ? "good" : "warning", title: `Break-even: about ${fmt(i.breakEvenMonthlyRevenue)} a month`, detail: gap >= 0 ? `You're averaging ${fmt(i.averageMonthlyRevenue)}, ${fmt(gap)} above it.` : `You're averaging ${fmt(i.averageMonthlyRevenue)}, ${fmt(-gap)} short of it.` });
  }

  if (i.runwayMonths !== null) {
    out.push({ tone: i.runwayMonths < 3 ? "critical" : "warning", title: `About ${i.runwayMonths < 1 ? "less than a month" : `${Math.floor(i.runwayMonths)} month${Math.floor(i.runwayMonths) === 1 ? "" : "s"}`} of runway`, detail: `At the current loss rate, the estimated cash of ${fmt(i.cashPosition)} would last that long.` });
  }

  if (i.paybackRatio !== null) {
    if (i.paybackRatio >= 1) out.push({ tone: "good", title: "Capital fully earned back", detail: `Profits since the start total ${pct(i.paybackRatio)} of the capital put in.` });
    else if (i.paybackRatio > 0) out.push({ tone: "info", title: `${pct(i.paybackRatio)} of capital earned back`, detail: "Cumulative operating profit, less assets bought, against the capital invested." });
  }

  if (i.busiest && i.busiest.orders >= 3) {
    out.push({ tone: "info", title: `Busiest time: ${WEEKDAY[i.busiest.weekday]}s around ${hourLabel(i.busiest.hour)}`, detail: `${i.busiest.orders} orders in that hour slot over this period. Staff up and prep ahead.` });
  }

  if (c.orders > 0 && p.orders > 0 && p.averageOrderValue > 0) {
    const change = (c.averageOrderValue - p.averageOrderValue) / p.averageOrderValue;
    if (Math.abs(change) >= 0.08) out.push({ tone: change > 0 ? "good" : "warning", title: `Average order ${change > 0 ? "up" : "down"} ${pct(Math.abs(change))}`, detail: `${fmt(c.averageOrderValue)} now against ${fmt(p.averageOrderValue)} before.` });
  }

  const rank: Record<InsightTone, number> = { critical: 0, warning: 1, good: 2, info: 3 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 8);
}
