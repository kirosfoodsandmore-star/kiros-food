// Sales reports grouped by day, branch, menu, item or option: online orders and counter sales (walk-in, catering) together,
// with the previous equal period for comparison, and CSV / Excel export.
import { assertPermission } from "../../../shared/access/can";
import { branchScope } from "../../../shared/access/scope";
import { FileResult } from "../../../shared/http/handler";
import type { Actor } from "../../../shared/types/actor";
import { toCsv } from "../../../shared/utils/csv";
import { formatDateTime, resolveRange } from "../../../shared/utils/dates";
import { previousRange } from "../../finance/domain/analytics";
import { BranchService } from "../../branch/services/branch.service";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { CounterSalesRepository, type CounterRow, type CounterScope, type CounterTotals } from "../repositories/counterSales.repository";
import { ReportRepository, type SalesRow, type SalesScope, type SalesTotals } from "../repositories/report.repository";
import type { SalesReportQuery } from "../validators/report.schema";
import { salesReportWorkbook, XLSX_MIME } from "./salesReportExport";

/** One group (a day, a branch, an item…) with the online and counter figures side by side. Money is kobo. */
export interface SalesReportRow {
  key: string;
  label: string;
  /** Online orders. */
  orders: number;
  /** Units on online orders. */
  items: number;
  subtotal: number;
  deliveryFees: number;
  discounts: number;
  onlineRevenue: number;
  /** Counter sales (walk-in / catering entries). */
  counterSales: number;
  /** Units on counter sales that listed their items. */
  counterItems: number;
  counterRevenue: number;
  /** Online + counter. */
  revenue: number;
}

export interface SalesReportTotals {
  orders: number;
  items: number;
  onlineRevenue: number;
  deliveryOrders: number;
  pickupOrders: number;
  counterSales: number;
  counterItems: number;
  counterRevenue: number;
  /** Online + counter. */
  revenue: number;
  /** Revenue per order or counter sale. */
  averageSaleValue: number;
}

export function combineTotals(online: SalesTotals, counter: CounterTotals): SalesReportTotals {
  const revenue = online.revenue + counter.revenue;
  const count = online.orders + counter.sales;
  return {
    orders: online.orders,
    items: online.items,
    onlineRevenue: online.revenue,
    deliveryOrders: online.deliveryOrders,
    pickupOrders: online.pickupOrders,
    counterSales: counter.sales,
    counterItems: counter.items,
    counterRevenue: counter.revenue,
    revenue,
    averageSaleValue: count > 0 ? Math.round(revenue / count) : 0,
  };
}

const blank = (key: string, label: string): SalesReportRow => ({ key, label, orders: 0, items: 0, subtotal: 0, deliveryFees: 0, discounts: 0, onlineRevenue: 0, counterSales: 0, counterItems: 0, counterRevenue: 0, revenue: 0 });

/** Joins online and counter rows that share a key; days run oldest first, everything else biggest first. */
export function mergeRows(groupBy: string, online: SalesRow[], counter: CounterRow[]): SalesReportRow[] {
  const rows = new Map<string, SalesReportRow>();
  for (const o of online) {
    const r = rows.get(o.key) ?? blank(o.key, o.label);
    r.orders += o.orders;
    r.items += o.items;
    r.subtotal += o.subtotal;
    r.deliveryFees += o.deliveryFees;
    r.discounts += o.discounts;
    r.onlineRevenue += o.revenue;
    rows.set(o.key, r);
  }
  for (const c of counter) {
    const r = rows.get(c.key) ?? blank(c.key, c.label);
    r.counterSales += c.sales;
    r.counterItems += c.items;
    r.counterRevenue += c.revenue;
    rows.set(c.key, r);
  }
  const out = [...rows.values()].map((r) => ({ ...r, revenue: r.onlineRevenue + r.counterRevenue }));
  return groupBy === "day" ? out.sort((a, b) => (a.key < b.key ? -1 : 1)) : out.sort((a, b) => b.revenue - a.revenue);
}

export class ReportService {
  static Instance = new ReportService();
  private constructor(
    private readonly repo = ReportRepository.Instance,
    private readonly counter = CounterSalesRepository.Instance,
    private readonly organizations = OrganizationRepository.Instance,
    private readonly branches = BranchService.Instance
  ) {}

  async scope(actor: Actor, branchId?: string, from?: string, to?: string): Promise<SalesScope> {
    const org = await this.organizations.findById(actor.organizationId);
    const timezone = org?.timezone ?? "Africa/Lagos";
    const range = resolveRange(timezone, from, to);
    return { organizationId: actor.organizationId, branchIds: branchScope(actor, branchId), from: range.from, to: range.to, timezone };
  }

  private counterScope(s: SalesScope): CounterScope {
    return { organizationId: s.organizationId, branchIds: s.branchIds, from: s.from, to: s.to };
  }

  private async totalsFor(s: SalesScope): Promise<SalesReportTotals> {
    const [online, counter] = await Promise.all([this.repo.totals(s), this.counter.totals(this.counterScope(s))]);
    return combineTotals(online, counter);
  }

  async sales(actor: Actor, q: SalesReportQuery) {
    const scope = await this.scope(actor, q.branchId, q.from, q.to);
    const prev = previousRange(scope.from, scope.to);
    const [rows, totals, previousTotals] = await Promise.all([this.rowsFor(q.groupBy, scope), this.totalsFor(scope), this.totalsFor({ ...scope, ...prev })]);
    const previous = { from: prev.from, to: prev.to, totals: previousTotals };

    if (q.format === "csv" || q.format === "xlsx") {
      assertPermission(actor, "reports.export");
      if (q.format === "xlsx") {
        const [org, branches] = await Promise.all([this.organizations.findById(actor.organizationId), this.branches.list(actor)]);
        const body = await salesReportWorkbook({
          restaurant: org?.name ?? "Restaurant",
          groupBy: q.groupBy,
          branch: q.branchId ? (branches.find((b) => b.id === q.branchId)?.name ?? "One branch") : "All branches",
          from: scope.from,
          to: scope.to,
          generatedAt: formatDateTime(new Date(), scope.timezone),
          totals,
          previous,
          rows,
        });
        return new FileResult(`sales-by-${q.groupBy}-${scope.from}-to-${scope.to}.xlsx`, XLSX_MIME, body);
      }
      const csv = toCsv<SalesReportRow>(rows, [
        { header: q.groupBy[0].toUpperCase() + q.groupBy.slice(1), value: (r) => r.label },
        { header: "Online orders", value: (r) => r.orders },
        { header: "Online items", value: (r) => r.items },
        { header: "Online revenue (kobo)", value: (r) => r.onlineRevenue },
        { header: "Delivery fees (kobo)", value: (r) => r.deliveryFees },
        { header: "Discounts (kobo)", value: (r) => r.discounts },
        { header: "Counter sales", value: (r) => r.counterSales },
        { header: "Counter items", value: (r) => r.counterItems },
        { header: "Counter revenue (kobo)", value: (r) => r.counterRevenue },
        { header: "Total revenue (kobo)", value: (r) => r.revenue },
      ]);
      return new FileResult(`sales-by-${q.groupBy}-${scope.from}-to-${scope.to}.csv`, "text/csv; charset=utf-8", csv);
    }
    return { groupBy: q.groupBy, from: scope.from, to: scope.to, timezone: scope.timezone, previous, totals, rows };
  }

  private async rowsFor(groupBy: SalesReportQuery["groupBy"], scope: SalesScope): Promise<SalesReportRow[]> {
    const cs = this.counterScope(scope);
    switch (groupBy) {
      case "branch":
        return mergeRows(groupBy, await this.repo.byBranch(scope), await this.counter.byBranch(cs));
      case "menu":
        return mergeRows(groupBy, await this.repo.byMenu(scope), await this.counter.byMenu(cs));
      case "item":
        return mergeRows(groupBy, await this.repo.byItem(scope), await this.counter.byItem(cs));
      case "option":
        // Options aren't recorded on counter sales: online only.
        return mergeRows(groupBy, await this.repo.byOption(scope), []);
      default:
        return mergeRows(groupBy, await this.repo.byDay(scope), await this.counter.byDay(cs));
    }
  }
}
