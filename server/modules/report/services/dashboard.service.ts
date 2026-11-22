// Dashboard: today's orders, counter sales, revenue, average sale, top items, open or closed per branch,
// and how many orders sit in each live status. Revenue and everything about counter sales (walk-in and catering
// sales recorded in the app) need the sales-report permission; order counts are for everyone who can open it.
import { can } from "../../../shared/access/can";
import type { Actor } from "../../../shared/types/actor";
import { todayIn } from "../../../shared/utils/dates";
import { BranchService } from "../../branch/services/branch.service";
import { SaleItemRepository } from "../../finance/repositories/saleItem.repository";
import { CounterSalesRepository, type CounterScope } from "../repositories/counterSales.repository";
import { ReportRepository, type SalesScope, type SalesTotals } from "../repositories/report.repository";
import { combineTotals, ReportService } from "./report.service";

/** What the dashboard shows for one period. Counter and money fields are null for people without the sales-report permission. */
export interface DashboardTotals {
  /** Online orders. */
  orders: number;
  /** Units sold: online plus counter (counter only where the sale listed its items). Online only without the permission. */
  items: number;
  deliveryOrders: number;
  pickupOrders: number;
  /** Online + counter. */
  revenue: number | null;
  onlineRevenue: number | null;
  counterSales: number | null;
  counterRevenue: number | null;
  /** Revenue per order or counter sale. */
  averageOrderValue: number | null;
}

export class DashboardService {
  static Instance = new DashboardService();
  private constructor(
    private readonly reports = ReportRepository.Instance,
    private readonly counter = CounterSalesRepository.Instance,
    private readonly sold = SaleItemRepository.Instance,
    private readonly reportService = ReportService.Instance,
    private readonly branches = BranchService.Instance
  ) {}

  async overview(actor: Actor, branchId?: string) {
    const scope = await this.reportService.scope(actor, branchId);
    const today = todayIn(scope.timezone);
    const todayScope = { ...scope, from: today, to: today };
    const periodScope: SalesScope = { ...scope, from: scope.from, to: today };
    // Order counts are for everyone who can open the dashboard; revenue, average sale and counter sales need the sales-report permission.
    const money = can(actor, "reports.view");
    const counterScope = (s: SalesScope): CounterScope => ({ organizationId: s.organizationId, branchIds: s.branchIds, from: s.from, to: s.to });

    const [todayTotals, periodTotals, topItems, statusCounts, branchList, counterToday, counterPeriod, combinedTop] = await Promise.all([
      this.reports.totals(todayScope),
      this.reports.totals(periodScope),
      this.reports.topItemsToday(todayScope),
      this.reports.statusCounts(actor.organizationId, scope.branchIds),
      this.branches.list(actor),
      money ? this.counter.totals(counterScope(todayScope)) : Promise.resolve(null),
      money ? this.counter.totals(counterScope(periodScope)) : Promise.resolve(null),
      money ? this.sold.bestSellers(todayScope, 5) : Promise.resolve(null),
    ]);
    const storefront = await this.branches.storefrontList(actor.organizationId);
    const branches = branchList
      .filter((b) => !scope.branchIds || scope.branchIds.includes(b.id))
      .map((b) => {
        const live = storefront.find((s) => s.id === b.id);
        return { id: b.id, name: b.name, city: b.city, isActive: b.isActive, isPaused: b.isPaused, pauseReason: b.pauseReason, isOpen: live?.isOpen ?? false, closesAt: live?.closesAt ?? null, nextOpenAt: live?.nextOpenAt ?? null };
      });

    const totalsOf = (online: SalesTotals, counter: Awaited<ReturnType<CounterSalesRepository["totals"]>> | null): DashboardTotals => {
      if (!counter) return { orders: online.orders, items: online.items, deliveryOrders: online.deliveryOrders, pickupOrders: online.pickupOrders, revenue: null, onlineRevenue: null, counterSales: null, counterRevenue: null, averageOrderValue: null };
      const c = combineTotals(online, counter);
      return { orders: c.orders, items: c.items + c.counterItems, deliveryOrders: c.deliveryOrders, pickupOrders: c.pickupOrders, revenue: c.revenue, onlineRevenue: c.onlineRevenue, counterSales: c.counterSales, counterRevenue: c.counterRevenue, averageOrderValue: c.averageSaleValue };
    };
    return {
      date: today,
      timezone: scope.timezone,
      canSeeRevenue: money,
      today: totalsOf(todayTotals, counterToday),
      last30Days: totalsOf(periodTotals, counterPeriod),
      // With the sales-report permission the list adds counter sales to online orders, with each source's share of the units.
      topItemsToday: combinedTop ? combinedTop.map((r) => ({ label: r.name, items: r.units, online: r.appUnits, counter: r.walkInUnits })) : topItems.map((r) => ({ label: r.label, items: r.items })),
      liveStatusCounts: statusCounts,
      branches,
    };
  }
}
