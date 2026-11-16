// Dashboard: today's orders, revenue, average order value, top items, open or closed per branch,
// and how many orders sit in each live status.
import { can } from "../../../shared/access/can";
import type { Actor } from "../../../shared/types/actor";
import { todayIn } from "../../../shared/utils/dates";
import { BranchService } from "../../branch/services/branch.service";
import { ReportRepository } from "../repositories/report.repository";
import { ReportService } from "./report.service";

export class DashboardService {
  static Instance = new DashboardService();
  private constructor(
    private readonly reports = ReportRepository.Instance,
    private readonly reportService = ReportService.Instance,
    private readonly branches = BranchService.Instance
  ) {}

  async overview(actor: Actor, branchId?: string) {
    const scope = await this.reportService.scope(actor, branchId);
    const today = todayIn(scope.timezone);
    const todayScope = { ...scope, from: today, to: today };
    const [todayTotals, weekTotals, topItems, statusCounts, branchList] = await Promise.all([
      this.reports.totals(todayScope),
      this.reports.totals({ ...scope, from: scope.from, to: today }),
      this.reports.topItemsToday(todayScope),
      this.reports.statusCounts(actor.organizationId, scope.branchIds),
      this.branches.list(actor),
    ]);
    const storefront = await this.branches.storefrontList(actor.organizationId);
    const branches = branchList
      .filter((b) => !scope.branchIds || scope.branchIds.includes(b.id))
      .map((b) => {
        const live = storefront.find((s) => s.id === b.id);
        return { id: b.id, name: b.name, city: b.city, isActive: b.isActive, isPaused: b.isPaused, pauseReason: b.pauseReason, isOpen: live?.isOpen ?? false, closesAt: live?.closesAt ?? null, nextOpenAt: live?.nextOpenAt ?? null };
      });
    // Order counts are for everyone who can open the dashboard; revenue and average order value need the sales-report permission.
    const money = can(actor, "reports.view");
    const hide = <T extends { revenue: number; averageOrderValue: number }>(t: T) => (money ? t : { ...t, revenue: null, averageOrderValue: null });
    return { date: today, timezone: scope.timezone, canSeeRevenue: money, today: hide(todayTotals), last30Days: hide(weekTotals), topItemsToday: topItems, liveStatusCounts: statusCounts, branches };
  }
}
