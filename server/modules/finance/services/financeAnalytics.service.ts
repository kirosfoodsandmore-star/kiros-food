// Business analytics: storefront sales and the finance ledger together, over any range (or all time), with the
// previous period for comparison, a running cash line, restaurant KPIs, busy times and plain-language insights.
import { assertPermission } from "../../../shared/access/can";
import { branchScope } from "../../../shared/access/scope";
import type { Actor } from "../../../shared/types/actor";
import { addDays, resolveRange, todayIn } from "../../../shared/utils/dates";
import { formatMoney } from "../../../shared/utils/money";
import { BranchService } from "../../branch/services/branch.service";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { categoryLabel, EXPENSE_GROUP_LABELS, EXPENSE_GROUPS, FINANCE_KIND_LABELS } from "../catalog/finance.catalog";
import { autoGranularity, bucketList, buildInsights, groupOf, monthsIn, previousRange, ratio, totalsOf, type LedgerAmount } from "../domain/analytics";
import { FinanceRepository } from "../repositories/finance.repository";
import type { AnalyticsQuery } from "../validators/finance.schema";

const sumBy = <T>(rows: T[], pick: (r: T) => number) => rows.reduce((s, r) => s + pick(r), 0);

export class FinanceAnalyticsService {
  static Instance = new FinanceAnalyticsService();
  private constructor(
    private readonly repo = FinanceRepository.Instance,
    private readonly organizations = OrganizationRepository.Instance,
    private readonly branches = BranchService.Instance
  ) {}

  async analytics(actor: Actor, q: AnalyticsQuery) {
    assertPermission(actor, "finance.view");
    const org = await this.organizations.findById(actor.organizationId);
    const timezone = org?.timezone ?? "Africa/Lagos";
    const fmt = (kobo: number) => formatMoney(kobo, org?.currencySymbol ?? "₦", org?.currencyDecimals ?? 0);
    const branchIds = branchScope(actor, q.branchId);
    const organizationId = actor.organizationId;

    const [firstEntry, firstOrder] = await Promise.all([this.repo.firstEntryDate(organizationId, branchIds), this.repo.firstOrderDate(organizationId, branchIds, timezone)]);
    const firstActivity = [firstEntry, firstOrder].filter((d): d is string => Boolean(d)).sort()[0] ?? null;
    const today = todayIn(timezone);
    let { from, to } = resolveRange(timezone, q.from, q.to, 90);
    if (q.allTime) from = firstActivity && firstActivity < to ? firstActivity : addDays(to, -29);
    if (to > today) to = today;
    if (from > to) from = to;
    const granularity = q.granularity ?? autoGranularity(from, to);
    const prev = previousRange(from, to);
    const scope = { organizationId, branchIds, from, to, timezone };
    const prevScope = { ...scope, ...prev };

    const [ledger, orders, prevLedger, prevOrders, allLedger, allRevenue, heat, vendors, customers, funding, ledgerBranches, orderBranches, budgets, branchList] = await Promise.all([
      this.repo.ledgerBuckets(scope, granularity),
      this.repo.orderBuckets(scope, granularity),
      this.repo.ledgerBuckets(prevScope, "month"),
      this.repo.orderBuckets(prevScope, "month"),
      this.repo.ledgerTotalsUpTo(organizationId, branchIds, to),
      this.repo.orderRevenueUpTo({ organizationId, branchIds, to, timezone }),
      this.repo.heatmap(scope),
      this.repo.topParties(scope, "expense"),
      this.repo.topParties(scope, "income"),
      this.repo.fundingHistory(organizationId, branchIds, to),
      this.repo.ledgerByBranch(scope),
      this.repo.ordersByBranch(scope),
      this.repo.budgets(organizationId),
      this.branches.list(actor),
    ]);

    // ── Period totals ────────────────────────────────────────────────────
    const current = totalsOf(ledger, sumBy(orders, (o) => o.revenue), sumBy(orders, (o) => o.orders));
    const previous = totalsOf(prevLedger, sumBy(prevOrders, (o) => o.revenue), sumBy(prevOrders, (o) => o.orders));
    const months = monthsIn(from, to);

    // ── All time (up to `to`) ────────────────────────────────────────────
    const life = totalsOf(allLedger, allRevenue, 0);
    const cashPosition = life.netCashFlow;
    const paybackRatio = life.capitalIn > 0 ? (life.operatingProfit - life.capex) / life.capitalIn : null;

    // ── KPIs ─────────────────────────────────────────────────────────────
    const monthlyBurn = Math.round((current.costOfSales + current.operating) / months);
    const averageMonthlyRevenue = Math.round(current.revenue / months);
    const monthlyLoss = current.operatingProfit < 0 ? -current.operatingProfit / months : 0;
    const runwayMonths = monthlyLoss > 0 && cashPosition > 0 ? cashPosition / monthlyLoss : null;
    const breakEvenMonthlyRevenue = current.grossMargin !== null && current.grossMargin > 0 && current.operating > 0 ? Math.round(current.operating / months / current.grossMargin) : null;

    // ── Series, with a running cash line that ends at today's estimated cash ─
    const buckets = bucketList(from, to, granularity);
    const ledgerBy = new Map<string, LedgerAmount[]>();
    for (const r of ledger) ledgerBy.set(r.bucket, [...(ledgerBy.get(r.bucket) ?? []), r]);
    const ordersBy = new Map(orders.map((o) => [o.bucket, o]));
    const rawSeries = buckets.map((bucket) => {
      const o = ordersBy.get(bucket);
      const t = totalsOf(ledgerBy.get(bucket) ?? [], o?.revenue ?? 0, o?.orders ?? 0);
      return {
        bucket,
        appRevenue: t.appRevenue,
        otherIncome: t.otherIncome,
        revenue: t.revenue,
        costOfSales: t.costOfSales,
        operating: t.operating,
        capex: t.capex,
        expenses: t.expenses,
        capitalIn: t.capitalIn,
        withdrawals: t.withdrawals,
        operatingProfit: t.operatingProfit,
        netCashFlow: t.netCashFlow,
        orders: t.orders,
        averageOrderValue: t.averageOrderValue,
        customers: o?.customers ?? 0,
        newCustomers: o?.newCustomers ?? 0,
      };
    });
    let cash = cashPosition - sumBy(rawSeries, (s) => s.netCashFlow);
    const openingCash = cash;
    let cumulativeProfit = 0;
    const series = rawSeries.map((s) => {
      cash += s.netCashFlow;
      cumulativeProfit += s.operatingProfit;
      return { ...s, cash, cumulativeProfit };
    });

    // ── Breakdowns ───────────────────────────────────────────────────────
    const budgetOf = new Map(budgets.map((b) => [b.category, b.monthlyAmount]));
    const sumCats = (rows: LedgerAmount[], kind: string) => {
      const m = new Map<string, number>();
      for (const r of rows) if (r.kind === kind) m.set(r.category, (m.get(r.category) ?? 0) + r.amount);
      return m;
    };
    const expNow = sumCats(ledger, "expense");
    const expPrev = sumCats(prevLedger, "expense");
    const expenseCats = new Set([...expNow.keys(), ...expPrev.keys(), ...budgetOf.keys()]);
    const expenseByCategory = [...expenseCats]
      .map((category) => ({
        category,
        label: categoryLabel(category),
        group: groupOf(category),
        amount: expNow.get(category) ?? 0,
        previous: expPrev.get(category) ?? 0,
        budget: budgetOf.get(category) ?? null,
        budgetForPeriod: budgetOf.has(category) ? Math.round(budgetOf.get(category)! * months) : null,
        share: ratio(expNow.get(category) ?? 0, current.expenses),
      }))
      .filter((e) => e.amount > 0 || e.previous > 0 || e.budget)
      .sort((a, b) => b.amount - a.amount);
    const expenseByGroup = EXPENSE_GROUPS.map((group) => ({ group, label: EXPENSE_GROUP_LABELS[group], amount: sumBy(expenseByCategory.filter((e) => e.group === group), (e) => e.amount) }));
    const incomeNow = sumCats(ledger, "income");
    const revenueSources = [{ key: "app", label: "Online orders (this app)", amount: current.appRevenue }, ...[...incomeNow].map(([key, amount]) => ({ key, label: categoryLabel(key), amount }))]
      .filter((r) => r.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const names = new Map(branchList.map((b) => [b.id, b.name]));
    const branchRows = new Map<string, { branchId: string | null; name: string; orders: number; appRevenue: number; ledger: LedgerAmount[] }>();
    const rowFor = (id: string | null) => {
      const key = id ?? "business";
      if (!branchRows.has(key)) branchRows.set(key, { branchId: id, name: id ? (names.get(id) ?? "Former branch") : "Whole business", orders: 0, appRevenue: 0, ledger: [] });
      return branchRows.get(key)!;
    };
    for (const o of orderBranches) Object.assign(rowFor(o.branchId), { orders: o.orders, appRevenue: o.revenue });
    for (const l of ledgerBranches) rowFor(l.branchId).ledger.push(l);
    const branches = [...branchRows.values()]
      .map((b) => {
        const t = totalsOf(b.ledger, b.appRevenue, b.orders);
        return { branchId: b.branchId, name: b.name, orders: b.orders, revenue: t.revenue, expenses: t.costOfSales + t.operating, capex: t.capex, operatingProfit: t.operatingProfit, operatingMargin: t.operatingMargin };
      })
      .sort((a, b) => (a.branchId === null ? 1 : b.branchId === null ? -1 : b.revenue - a.revenue));

    let runningCapital = 0;
    const fundingHistory = funding.map((e) => {
      runningCapital += e.kind === "capital" ? e.amount : -e.amount;
      return { id: e.id, date: e.entryDate, kind: e.kind, kindLabel: FINANCE_KIND_LABELS[e.kind], category: e.category, categoryLabel: categoryLabel(e.category), title: e.title, party: e.party, amount: e.amount, netCapital: runningCapital };
    });

    const busiest = heat.reduce<{ weekday: number; hour: number; orders: number } | null>((best, h) => (!best || h.orders > best.orders ? h : best), null);
    const insights = buildInsights({
      current,
      previous,
      expenseByCategory: expenseByCategory.map((e) => ({ category: e.category, amount: e.amount, previous: e.previous, budget: e.budget })),
      busiest,
      cashPosition,
      monthlyBurn,
      runwayMonths,
      breakEvenMonthlyRevenue,
      averageMonthlyRevenue,
      paybackRatio,
      months,
      hasLedger: allLedger.length > 0,
      fmt,
    });

    return {
      range: { from, to, granularity, timezone, allTime: Boolean(q.allTime), previousFrom: prev.from, previousTo: prev.to, firstActivity, months: Math.round(months * 10) / 10 },
      totals: current,
      previous,
      lifetime: {
        capitalInvested: life.capitalIn,
        withdrawals: life.withdrawals,
        netCapital: life.capitalIn - life.withdrawals,
        revenue: life.revenue,
        expenses: life.expenses,
        assets: life.capex,
        operatingProfit: life.operatingProfit,
        cashPosition,
        paybackRatio,
      },
      kpis: { monthlyBurn, averageMonthlyRevenue, runwayMonths, breakEvenMonthlyRevenue, openingCash },
      series,
      expenseByCategory,
      expenseByGroup,
      revenueSources,
      branches,
      heatmap: heat,
      topVendors: vendors,
      topCustomers: customers,
      funding: fundingHistory,
      insights,
      hasLedger: allLedger.length > 0,
    };
  }
}
