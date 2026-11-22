// Business analytics: storefront sales and the books together. History and trends over any range (or since the
// start), compared with the period before, plus restaurant KPIs, cash, payback, busy times and plain-language insights.
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { ArrowDown, CircleCheck, Info, Lightbulb, OctagonAlert, Plus, TriangleAlert } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { BranchSelect } from "@/components/admin/BranchSelect"
import { ChartCard, ColumnChart, compactNumber, Heatmap, Legend, TrendChart, type Series } from "@/components/charts/Charts"
import { StatTile } from "@/components/charts/StatTile"
import { PageHeader } from "@/components/layout/PageHeader"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { ErrorState } from "@/components/shared/States"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { useAdminBranch } from "@/hooks/useAdminBranch"
import { useBranches } from "@/hooks/useAdminBranches"
import { useFinanceAnalytics } from "@/hooks/useFinance"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { usePersistedState } from "@/hooks/usePersistedState"
import { bucketLabel, change, pct, presetRange, PRESETS, type Preset } from "@/lib/finance"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { FinanceAnalytics, Granularity, InsightTone } from "@/types/finance.types"

const C1 = "var(--chart-1)"
const C2 = "var(--chart-2)"
const C3 = "var(--chart-3)"

const TONE: Record<InsightTone, { icon: typeof Info; className: string; label: string }> = {
  critical: { icon: OctagonAlert, className: "text-destructive", label: "Needs attention" },
  warning: { icon: TriangleAlert, className: "text-warning", label: "Watch" },
  good: { icon: CircleCheck, className: "text-success", label: "Good" },
  info: { icon: Info, className: "text-info", label: "Note" },
}

export default function AnalyticsPage() {
  const fmt = useAdminCurrency()
  const { can } = useAuth()
  const money = (v: number) => formatMoney(v, fmt)
  const [branchId, setBranchId] = useAdminBranch()
  const [preset, setPreset] = usePersistedState<Preset>("kiros.analytics.preset", "90d")
  const [custom, setCustom] = useState({ from: "", to: "" })
  const [gran, setGran] = useState<"auto" | Granularity>("auto")
  const params = { ...presetRange(preset, custom), branchId: branchId || undefined, granularity: gran === "auto" ? undefined : gran }
  const { data, isLoading, error, refetch, isFetching } = useFinanceAnalytics(params)
  const { data: branches } = useBranches()
  const branchName = branchId ? (branches?.find((b) => b.id === branchId)?.name ?? "this branch") : null

  return (
    <div data-cy="analytics-page">
      <PageHeader
        title="Business analytics"
        description={data ? `${format(parseISO(data.range.from), "d MMM yyyy")} → ${format(parseISO(data.range.to), "d MMM yyyy")} · compared with the ${differenceInCalendarDays(parseISO(data.range.to), parseISO(data.range.from)) + 1} days before` : undefined}
        actions={
          <>
            <BranchSelect value={branchId} onChange={setBranchId} allowAll className="w-full sm:w-44" />
            <Select value={gran} onValueChange={(v) => setGran(v as typeof gran)}>
              <SelectTrigger className="w-full sm:w-32" aria-label="Group by"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="auto">Auto</SelectItem><SelectItem value="day">Daily</SelectItem><SelectItem value="week">Weekly</SelectItem><SelectItem value="month">Monthly</SelectItem></SelectContent>
            </Select>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {/* min-w-0 + max-w-full: on phones the presets scroll inside their strip instead of widening the page. */}
        <Tabs value={preset} onValueChange={(v) => setPreset(v as Preset)} className="min-w-0 max-w-full">
          <TabsList>{PRESETS.map(([k, l]) => <TabsTrigger key={k} value={k} data-cy={`analytics-preset-${k}`}>{l}</TabsTrigger>)}</TabsList>
        </Tabs>
        {preset === "custom" ? <DateRangeFilter from={custom.from} to={custom.to} onChange={setCustom} /> : null}
        {isFetching && data ? <span className="text-xs text-muted-foreground">Updating…</span> : null}
      </div>
      {isLoading ? <PageLoader /> : error || !data ? <ErrorState message={`Analytics could not be loaded.${error instanceof Error ? ` ${error.message}` : ""}`} onRetry={() => void refetch()} /> : <Body data={data} money={money} fmt={fmt} canManage={can("finance.manage")} branchName={branchName} onShowAll={() => setBranchId("")} />}
    </div>
  )
}

function Body({ data, money, fmt, canManage, branchName, onShowAll }: { data: FinanceAnalytics; money: (v: number) => string; fmt: ReturnType<typeof useAdminCurrency>; canManage: boolean; branchName: string | null; onShowAll: () => void }) {
  const { totals: t, previous: p, series, range } = data
  const g = range.granularity
  const labels = useMemo(() => series.map((s) => bucketLabel(s.bucket, g, true)), [series, g])
  const tick = (i: number) => bucketLabel(series[i].bucket, g)
  const running = (x: { costOfSales: number; operating: number }) => x.costOfSales + x.operating

  const trend: Series[] = [
    { key: "revenue", label: "Revenue", color: C1, values: series.map((s) => s.revenue) },
    { key: "costs", label: "Costs", color: C2, values: series.map(running) },
    { key: "profit", label: "Operating profit", color: C3, values: series.map((s) => s.operatingProfit) },
  ]
  const groups: Series[] = [
    { key: "cos", label: "Cost of sales", color: C1, values: series.map((s) => s.costOfSales) },
    { key: "run", label: "Running costs", color: C2, values: series.map((s) => s.operating) },
    { key: "capex", label: "Assets & fit-out", color: C3, values: series.map((s) => s.capex) },
  ]
  const customers: Series[] = [
    { key: "new", label: "New customers", color: C1, values: series.map((s) => s.newCustomers) },
    { key: "returning", label: "Returning", color: C2, values: series.map((s) => Math.max(0, s.customers - s.newCustomers)) },
  ]
  const tableOf = (cols: string[], pick: (i: number) => ReactNode[]) => ({ columns: ["Period", ...cols], rows: series.map((_, i) => [labels[i], ...pick(i)]) })

  const tiles: Array<{ label: string; value: ReactNode; now: number; before: number; upIsGood: boolean; spark: number[]; ratio?: boolean }> = [
    { label: "Revenue", value: <Money value={t.revenue} fmt={fmt} />, now: t.revenue, before: p.revenue, upIsGood: true, spark: series.map((s) => s.revenue) },
    { label: "Costs", value: <Money value={running(t)} fmt={fmt} />, now: running(t), before: running(p), upIsGood: false, spark: series.map(running) },
    { label: "Operating profit", value: <Money value={t.operatingProfit} fmt={fmt} />, now: t.operatingProfit, before: p.operatingProfit, upIsGood: true, spark: series.map((s) => s.operatingProfit) },
    { label: "Operating margin", value: pct(t.operatingMargin), now: t.operatingMargin ?? 0, before: p.operatingMargin ?? 0, upIsGood: true, spark: series.map((s) => (s.revenue ? s.operatingProfit / s.revenue : 0)), ratio: true },
    { label: "App orders", value: t.orders.toLocaleString(), now: t.orders, before: p.orders, upIsGood: true, spark: series.map((s) => s.orders) },
    { label: "Average order", value: <Money value={t.averageOrderValue} fmt={fmt} />, now: t.averageOrderValue, before: p.averageOrderValue, upIsGood: true, spark: series.map((s) => s.averageOrderValue) },
  ]

  return (
    <div className="space-y-5">
      {/* A branch picked on any admin page stays applied here. Entries filed for the whole business can't be part of one
          branch's numbers, so say so instead of letting a sale quietly disappear. */}
      {branchName && data.leftOut ? (
        <Card className="border-warning/50 bg-warning/5" role="status" data-cy="analytics-left-out">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 gap-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <div className="min-w-0 text-sm">
                <p className="font-medium">Showing {branchName} only. Some of your books aren't in these numbers.</p>
                <p className="mt-0.5 text-muted-foreground">
                  {data.leftOut.entries} {data.leftOut.entries === 1 ? "entry" : "entries"} recorded for the whole business in this period:{" "}
                  {[data.leftOut.income ? <span key="i"><Money value={data.leftOut.income} fmt={fmt} /> income</span> : null, data.leftOut.expenses ? <span key="e"><Money value={data.leftOut.expenses} fmt={fmt} /> expenses</span> : null, data.leftOut.capital ? <span key="c"><Money value={data.leftOut.capital} fmt={fmt} /> capital</span> : null, data.leftOut.withdrawals ? <span key="w"><Money value={data.leftOut.withdrawals} fmt={fmt} /> money out</span> : null]
                    .filter(Boolean)
                    .flatMap((el, i) => (i ? [", ", el] : [el]))}
                  . Entries without a branch only appear under <b>All branches</b>.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={onShowAll} data-cy="analytics-show-all">Show all branches</Button>
          </CardContent>
        </Card>
      ) : null}
      {!data.hasLedger ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-sm"><b>Only app sales are counted so far.</b> <span className="text-muted-foreground">Record capital, expenses and walk-in sales to see profit, margins, cash and payback.</span></p>
            <Button asChild><Link to="/admin/finance"><Plus /> {canManage ? "Add your books" : "Open capital & expenses"}</Link></Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => <StatTile key={tile.label} {...tile} />)}
      </div>

      {/* Insights */}
      {data.insights.length ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="size-4 text-warning" /> What stands out</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-3 md:grid-cols-2">
              {data.insights.map((i) => {
                const tone = TONE[i.tone]
                return (
                  <li key={i.title} className="flex gap-3 rounded-lg border border-border p-3">
                    <tone.icon className={cn("mt-0.5 size-4 shrink-0", tone.className)} aria-label={tone.label} />
                    <div className="min-w-0"><p className="text-sm font-medium">{i.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{i.detail}</p></div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Main trend */}
      <ChartCard title="Revenue, costs and profit" description="Revenue is app orders plus other income. Costs are cost of sales plus running costs; assets are shown separately below." legend={trend} table={tableOf(["Revenue", "Costs", "Profit"], (i) => [money(trend[0].values[i]), money(trend[1].values[i]), money(trend[2].values[i])])}>
        <TrendChart labels={labels} series={trend} format={money} tickLabel={tick} height={280} />
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Estimated cash over time" description={<>Everything in minus everything out, from the first record. Now <Money value={data.lifetime.cashPosition} fmt={fmt} className="font-medium text-foreground" />.</>} table={tableOf(["Cash", "Net flow"], (i) => [money(series[i].cash), money(series[i].netCashFlow)])}>
          <TrendChart labels={labels} series={[{ key: "cash", label: "Estimated cash", color: C1, values: series.map((s) => s.cash), area: true }]} format={money} tickLabel={tick} />
        </ChartCard>
        <ChartCard title="Profit or loss by period" description="Operating profit per period: above the line made money, below it lost money." legend={[{ key: "p", label: "Profit", color: C3 }, { key: "l", label: "Loss", color: C2 }]} table={tableOf(["Operating profit"], (i) => [money(series[i].operatingProfit)])}>
          <ColumnChart labels={labels} series={[{ key: "profit", label: "Operating profit", color: C3, values: series.map((s) => s.operatingProfit) }]} signed negativeColor={C2} format={money} tickLabel={tick} />
        </ChartCard>
      </div>

      {/* Spending */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Where the money goes" description="Spending per period, split by type." legend={groups} table={tableOf(groups.map((s) => s.label), (i) => groups.map((s) => money(s.values[i])))}>
          <ColumnChart labels={labels} series={groups} format={money} tickLabel={tick} />
        </ChartCard>
        <ExpenseCategories data={data} fmt={fmt} />
      </div>

      {/* Health & long-term */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Restaurant health</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Meter label="Food cost" hint="Ingredients and packaging as a share of revenue. Target 28–35%." value={t.foodCostRatio} warnAt={0.35} badAt={0.4} />
            <Meter label="Labour" hint="Salaries and wages as a share of revenue. Target 25–35%." value={t.labourRatio} warnAt={0.35} badAt={0.42} />
            <Meter label="Prime cost" hint="Food plus labour. Keep it under 65%." value={t.primeCostRatio} warnAt={0.62} badAt={0.7} />
            <Meter label="Gross margin" hint="What's left of revenue after cost of sales." value={t.grossMargin} invert warnAt={0.6} badAt={0.5} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Break-even & burn</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <KV label="Average revenue a month" value={<Money value={data.kpis.averageMonthlyRevenue} fmt={fmt} />} />
            <KV label="Break-even revenue a month" value={data.kpis.breakEvenMonthlyRevenue !== null ? <Money value={data.kpis.breakEvenMonthlyRevenue} fmt={fmt} /> : "—"} hint="Running costs ÷ gross margin" />
            {data.kpis.breakEvenMonthlyRevenue ? <Progress value={data.kpis.averageMonthlyRevenue / data.kpis.breakEvenMonthlyRevenue} label={`${pct(data.kpis.averageMonthlyRevenue / data.kpis.breakEvenMonthlyRevenue)} of break-even`} /> : null}
            <KV label="Spending a month (burn)" value={<Money value={data.kpis.monthlyBurn} fmt={fmt} />} hint="Cost of sales + running costs" />
            <KV label="Runway" value={data.kpis.runwayMonths === null ? (t.operatingProfit >= 0 ? "Not burning cash" : "—") : `${data.kpis.runwayMonths.toFixed(1)} months`} hint="Cash ÷ monthly loss" />
            <KV label="Assets bought this period" value={<Money value={t.capex} fmt={fmt} />} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Since the start</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <KV label="Capital put in" value={<Money value={data.lifetime.capitalInvested} fmt={fmt} />} />
            <KV label="Money taken out" value={<Money value={data.lifetime.withdrawals} fmt={fmt} />} />
            <KV label="Revenue" value={<Money value={data.lifetime.revenue} fmt={fmt} />} />
            <KV label="Spent (incl. assets)" value={<Money value={data.lifetime.expenses} fmt={fmt} />} />
            <KV label="Estimated cash" value={<Money value={data.lifetime.cashPosition} fmt={fmt} />} />
            {data.lifetime.paybackRatio !== null ? (
              <div>
                <KV label="Capital earned back" value={pct(Math.max(0, data.lifetime.paybackRatio))} hint="Operating profit, less assets, ÷ capital" />
                <Progress value={Math.max(0, data.lifetime.paybackRatio)} label={data.lifetime.paybackRatio >= 1 ? "Paid back" : data.lifetime.paybackRatio <= 0 ? "Not yet earning it back" : "On the way"} />
              </div>
            ) : <p className="text-xs text-muted-foreground">Record capital to track payback.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Sources and branches */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Revenue sources</CardTitle></CardHeader>
          <CardContent>
            {data.revenueSources.length === 0 ? <p className="text-sm text-muted-foreground">No revenue in this range.</p> : (
              <ul className="space-y-3">
                {data.revenueSources.map((s) => <BarRow key={s.key} label={s.label} amount={s.amount} max={data.revenueSources[0].amount} share={t.revenue ? s.amount / t.revenue : null} color={C1} fmt={fmt} />)}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader><CardTitle>By branch</CardTitle></CardHeader>
          <CardContent>
            {data.branches.length === 0 ? <p className="text-sm text-muted-foreground">Nothing in this range.</p> : (
              <>
              {/* Phones: one compact block per branch, so profit is never scrolled out of sight. */}
              <ul className="divide-y divide-border sm:hidden">
                {data.branches.map((b) => (
                  <li key={b.branchId ?? "business"} className="py-3 first:pt-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn("font-medium", !b.branchId && "text-muted-foreground")}>{b.name}</span>
                      <span className="text-sm font-medium tabular-nums"><Signed value={b.operatingProfit} money={money} /></span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {b.orders} orders · revenue <Money value={b.revenue} fmt={fmt} /> · costs <Money value={b.expenses} fmt={fmt} />{b.branchId && b.operatingMargin !== null ? ` · ${pct(b.operatingMargin)} margin` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
              <Table>
                <TableHeader><TableRow><TableHead>Branch</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Costs</TableHead><TableHead className="text-right">Profit</TableHead><TableHead className="hidden text-right sm:table-cell">Margin</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.branches.map((b) => (
                    <TableRow key={b.branchId ?? "business"}>
                      <TableCell className={cn("font-medium", !b.branchId && "text-muted-foreground")}>{b.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.orders}</TableCell>
                      <TableCell className="text-right tabular-nums"><Money value={b.revenue} fmt={fmt} /></TableCell>
                      <TableCell className="text-right tabular-nums"><Money value={b.expenses} fmt={fmt} /></TableCell>
                      <TableCell className="text-right tabular-nums"><Signed value={b.operatingProfit} money={money} /></TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{b.branchId ? pct(b.operatingMargin) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              </>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Costs filed against the whole business (not one branch) appear on their own row.</p>
          </CardContent>
        </Card>
      </div>

      {/* What's selling: app orders and counter sales together */}
      <BestSellers rows={data.bestSellers} fmt={fmt} />

      {/* Customers & timing */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Busy times" description="App orders by day of the week and hour.">
          <Heatmap cells={data.heatmap} format={money} />
        </ChartCard>
        <ChartCard title="Customers" description="People ordering through the app: first-timers and those coming back." legend={customers} table={tableOf(["New", "Returning"], (i) => [customers[0].values[i], customers[1].values[i]])}>
          <ColumnChart labels={labels} series={customers} format={(v) => v.toLocaleString()} axis={compactNumber} tickLabel={tick} />
        </ChartCard>
      </div>

      {/* Funding & vendors */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="min-w-0">
          <CardHeader><CardTitle>Funding history</CardTitle></CardHeader>
          <CardContent>
            {data.funding.length === 0 ? <p className="text-sm text-muted-foreground">No capital recorded yet.</p> : <FundingTimeline funding={data.funding} fmt={fmt} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top vendors & customers this period</CardTitle></CardHeader>
          <CardContent>
            {data.topVendors.length === 0 ? <p className="text-sm text-muted-foreground">Add a vendor to expenses to see who you spend the most with.</p> : (
              <ul className="space-y-3">{data.topVendors.map((v) => <BarRow key={v.party} label={`${v.party} (${v.entries})`} amount={v.amount} max={data.topVendors[0].amount} share={running(t) + t.capex ? v.amount / (running(t) + t.capex) : null} color={C2} fmt={fmt} />)}</ul>
            )}
            {data.topCustomers.length ? (
              <>
                <p className="mt-5 mb-3 text-sm font-semibold">Top customers (other income)</p>
                <ul className="space-y-3" data-cy="top-customers">{data.topCustomers.map((v) => <BarRow key={v.party} label={`${v.party} (${v.entries})`} amount={v.amount} max={data.topCustomers[0].amount} share={t.otherIncome ? v.amount / t.otherIncome : null} color={C1} fmt={fmt} />)}</ul>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">App revenue counts paid orders (cancelled and refunded left out), including delivery fees. Cash is an estimate from what's recorded here: it doesn't know about payment-provider fees or money that isn't recorded. Times are in {range.timezone}.</p>
    </div>
  )
}

// ── Pieces ───────────────────────────────────────────────────────────────

/** Capital in and money out, oldest first; only the latest few until asked. */
function FundingTimeline({ funding, fmt }: { funding: FinanceAnalytics["funding"]; fmt: ReturnType<typeof useAdminCurrency> }) {
  const [all, setAll] = useState(false)
  const SHOW = 8
  const hidden = all ? 0 : Math.max(0, funding.length - SHOW)
  return (
    <>
      {hidden ? <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => setAll(true)}>Show {hidden} earlier</Button> : null}
              <ol className="relative space-y-4 border-l border-border pl-5">
                {funding.slice(hidden).map((f) => (
                  <li key={f.id} className="relative">
                    <span className={cn("absolute -left-[27px] top-1 flex size-3.5 items-center justify-center rounded-full ring-4 ring-card", f.kind === "capital" ? "bg-chart-1" : "bg-chart-2")} />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-sm font-medium">{f.kind === "capital" ? "+" : "−"} <Money value={f.amount} fmt={fmt} /> · {f.title}</p>
                      <span className="text-xs text-muted-foreground">{format(parseISO(f.date), "d MMM yyyy")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{f.categoryLabel}{f.party ? ` · ${f.party}` : ""} · net capital <Money value={f.netCapital} fmt={fmt} /></p>
                  </li>
                ))}
              </ol>
    </>
  )
}

/** Items by units sold, app orders and walk-in sales side by side. */
function BestSellers({ rows, fmt }: { rows: FinanceAnalytics["bestSellers"]; fmt: ReturnType<typeof useAdminCurrency> }) {
  const max = Math.max(1, ...rows.map((r) => r.units))
  return (
    <Card data-cy="best-sellers">
      <CardHeader>
        <CardTitle>Best sellers</CardTitle>
        <p className="text-sm text-muted-foreground">Items by units sold this period: online orders and sales recorded at the counter together.</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to show yet. Pick the menu items when you record a walk-in sale (Capital & expenses → Record → Other income) and they'll appear here with your online orders.</p>
        ) : (
          <>
            <Legend series={[{ key: "app", label: "Online orders", color: C1 }, { key: "walk", label: "Sold at the counter", color: C2 }]} className="mb-3" />
            <ul className="space-y-3">
              {rows.map((r, i) => (
                <li key={r.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate"><span className="text-muted-foreground tabular-nums">{i + 1}.</span> {r.name}</span>
                    <span className="shrink-0 tabular-nums"><span className="font-medium">{r.units.toLocaleString()} sold</span> <span className="text-xs text-muted-foreground">· <Money value={r.revenue} fmt={fmt} /></span></span>
                  </div>
                  <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${r.appUnits} from online orders, ${r.walkInUnits} at the counter`}>
                    {r.appUnits ? <div className="h-2" style={{ width: `${(r.appUnits / max) * 100}%`, background: C1 }} /> : null}
                    {r.appUnits && r.walkInUnits ? <div className="h-2 w-0.5 bg-card" /> : null}
                    {r.walkInUnits ? <div className="h-2" style={{ width: `${(r.walkInUnits / max) * 100}%`, background: C2 }} /> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.appUnits} online · {r.walkInUnits} at the counter</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ExpenseCategories({ data, fmt }: { data: FinanceAnalytics; fmt: ReturnType<typeof useAdminCurrency> }) {
  const rows = data.expenseByCategory
  const max = Math.max(1, ...rows.map((r) => Math.max(r.amount, r.budgetForPeriod ?? 0)))
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div><CardTitle>Spending by category</CardTitle><p className="mt-1 text-sm text-muted-foreground">Against the period before and your budget (the tick mark).</p></div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No expenses in this range.</p> : (
          // Capped with its own scroll only beside the chart on wide screens; on phones it's part of the page scroll.
          <ul className="space-y-3 lg:max-h-[360px] lg:overflow-y-auto lg:pr-1">
            {rows.map((r) => {
              const d = change(r.amount, r.previous)
              // 5% leeway (as the server's insights use): a monthly bill landing just inside the range isn't "over".
              const over = r.budgetForPeriod !== null && r.amount > r.budgetForPeriod * 1.05
              return (
                <li key={r.category}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{r.label}</span>
                    <span className="shrink-0 tabular-nums"><Money value={r.amount} fmt={fmt} className="font-medium" /> <span className="text-xs text-muted-foreground">{pct(r.share)}</span></span>
                  </div>
                  <div className="relative mt-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full" style={{ width: `${(r.amount / max) * 100}%`, background: C2 }} />
                    {r.budgetForPeriod ? <span className="absolute -top-0.5 h-3 w-0.5 rounded bg-foreground/70" style={{ left: `calc(${(r.budgetForPeriod / max) * 100}% - 1px)` }} title="Budget for this period" /> : null}
                  </div>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {d !== null ? <span>{d >= 0 ? "▲" : "▼"} {pct(Math.abs(d))} vs before</span> : r.previous === 0 && r.amount > 0 ? <span>new this period</span> : null}
                    {r.budgetForPeriod !== null ? <span className={over ? "font-medium text-destructive" : undefined}>{over ? <><TriangleAlert className="mr-0.5 inline size-3" />Over budget by <Money value={r.amount - r.budgetForPeriod} fmt={fmt} /></> : <>Budget <Money value={r.budgetForPeriod} fmt={fmt} /></>}</span> : null}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function BarRow({ label, amount, max, share, color, fmt }: { label: string; amount: number; max: number; share: number | null; color: string; fmt: ReturnType<typeof useAdminCurrency> }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-sm"><span className="min-w-0 truncate">{label}</span><span className="shrink-0 tabular-nums"><Money value={amount} fmt={fmt} className="font-medium" /> <span className="text-xs text-muted-foreground">{pct(share)}</span></span></div>
      <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full" style={{ width: `${Math.max(2, (amount / Math.max(1, max)) * 100)}%`, background: color }} /></div>
    </li>
  )
}

function Meter({ label, hint, value, warnAt, badAt, invert = false }: { label: string; hint: string; value: number | null; warnAt: number; badAt: number; invert?: boolean }) {
  const state = value === null ? null : invert ? (value < badAt ? "bad" : value < warnAt ? "warn" : "ok") : value > badAt ? "bad" : value > warnAt ? "warn" : "ok"
  const color = state === "bad" ? "var(--destructive)" : state === "warn" ? "var(--warning)" : "var(--success)"
  const Icon = state === "bad" ? OctagonAlert : state === "warn" ? TriangleAlert : CircleCheck
  const word = state === "bad" ? "High" : state === "warn" ? "Watch" : "Healthy"
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="flex items-center gap-1 tabular-nums">{value === null ? <span className="text-muted-foreground">no data</span> : <><Icon className="size-3.5" style={{ color }} aria-hidden /><span className="text-xs text-muted-foreground">{invert ? (state === "ok" ? "Healthy" : state === "warn" ? "Watch" : "Low") : word}</span> {pct(value)}</>}</span>
      </div>
      <div className="mt-1 h-2 rounded-full" style={{ background: `color-mix(in srgb, ${value === null ? "var(--muted-foreground)" : color} 15%, transparent)` }}>
        {value !== null ? <div className="h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(2, value * 100))}%`, background: color }} /> : null}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function KV({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0"><span>{label}</span>{hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}</span>
      <span className="shrink-0 font-medium tabular-nums">{value}</span>
    </div>
  )
}

function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="h-2 rounded-full bg-[color-mix(in_srgb,var(--chart-1)_15%,transparent)]"><div className="h-2 rounded-full bg-chart-1" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} /></div>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function Signed({ value, money }: { value: number; money: (v: number) => string }) {
  return <span className={cn("inline-flex items-center gap-0.5", value < 0 && "text-destructive")}>{value < 0 ? <ArrowDown className="size-3" aria-label="Loss" /> : null}{money(Math.abs(value))}</span>
}
