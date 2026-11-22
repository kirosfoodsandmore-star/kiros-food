// Sales reports: online orders and counter sales (walk-in, catering) together. A period with its previous one for
// comparison, a stacked chart over time, a few highlights, and a breakdown by day, branch, menu, item or option, with
// an Excel download. A source switch narrows everything to online orders or counter sales.
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { CalendarCheck, CalendarDays, FileSpreadsheet, Gauge, Trophy } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { BranchSelect } from "@/components/admin/BranchSelect"
import { ChartCard, ColumnChart, type Series } from "@/components/charts/Charts"
import { StatTile } from "@/components/charts/StatTile"
import { PageHeader } from "@/components/layout/PageHeader"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { Pagination } from "@/components/shared/Pagination"
import { EmptyState, ErrorState } from "@/components/shared/States"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { ReportEndpoints } from "@/endpoints/admin.endpoints"
import { useAdminBranch } from "@/hooks/useAdminBranch"
import { useBranches } from "@/hooks/useAdminBranches"
import { useSalesReport } from "@/hooks/useAdminMisc"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { usePersistedState } from "@/hooks/usePersistedState"
import { bucketLabel, pct } from "@/lib/finance"
import { formatMoney } from "@/lib/money"
import { bucketDays, revenueOf, SALES_PRESETS, SALES_SOURCES, salesPresetRange, type SalesPreset, type SalesSource } from "@/lib/salesReport"
import { cn } from "@/lib/utils"
import type { SalesReport, SalesReportRow } from "@/types/admin.types"

const GROUPS = [["day", "By day"], ["branch", "By branch"], ["menu", "By menu"], ["item", "By item"], ["option", "By option"]] as const
type Grouping = (typeof GROUPS)[number][0]

const C_ONLINE = "var(--chart-1)"
const C_COUNTER = "var(--chart-2)"
const PAGE_SIZE = 15
const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"]
const div = (a: number, b: number) => (b > 0 ? a / b : 0)

export default function ReportsPage() {
  const { can } = useAuth()
  const [branchId, setBranchId] = useAdminBranch()
  const { data: branches } = useBranches()
  const [preset, setPreset] = usePersistedState<SalesPreset>("kiros.reports.preset", "30d")
  const [custom, setCustom] = useState({ from: "", to: "" })
  const [groupBy, setGroupBy] = useState<Grouping>("day")
  const [source, setSource] = usePersistedState<SalesSource>("kiros.reports.source", "all")
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [groupBy, source, preset, branchId, custom.from, custom.to])

  const base = { ...salesPresetRange(preset, custom), branchId: branchId || undefined }
  // The chart, tiles and highlights always read the daily figures; the breakdown below reads the chosen grouping.
  const daily = useSalesReport({ ...base, groupBy: "day" })
  const grouped = useSalesReport({ ...base, groupBy }, groupBy !== "day")
  const table = groupBy === "day" ? daily : grouped
  const branchName = branchId ? (branches?.find((b) => b.id === branchId)?.name ?? "this branch") : null
  const d = daily.data

  return (
    <div data-cy="reports-page">
      <PageHeader
        title="Sales reports"
        description={d ? `${format(parseISO(d.from), "d MMM yyyy")} → ${format(parseISO(d.to), "d MMM yyyy")} · online orders and counter sales together · compared with ${format(parseISO(d.previous.from), "d MMM")} → ${format(parseISO(d.previous.to), "d MMM yyyy")}` : "Online orders and counter sales together."}
        actions={
          <>
            <BranchSelect value={branchId} onChange={setBranchId} allowAll className="w-full sm:w-44" />
            {can("reports.export") ? (
              <Button variant="outline" onClick={() => ReportEndpoints.exportSales({ ...base, groupBy }, `sales-by-${groupBy}.xlsx`).catch(() => toast.error("Download failed"))} data-cy="report-export"><FileSpreadsheet /> Excel</Button>
            ) : null}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <Tabs value={preset} onValueChange={(v) => setPreset(v as SalesPreset)} className="min-w-0 max-w-full">
            <TabsList>{SALES_PRESETS.map(([k, l]) => <TabsTrigger key={k} value={k} data-cy={`report-preset-${k}`}>{l}</TabsTrigger>)}</TabsList>
          </Tabs>
          {preset === "custom" ? <DateRangeFilter from={custom.from} to={custom.to} onChange={setCustom} /> : null}
        </div>
        <Tabs value={source} onValueChange={(v) => setSource(v as SalesSource)} className="min-w-0 max-w-full">
          <TabsList>{SALES_SOURCES.map(([k, l]) => <TabsTrigger key={k} value={k} data-cy={`report-source-${k}`}>{l}</TabsTrigger>)}</TabsList>
        </Tabs>
      </div>

      {daily.isLoading && !d ? <PageLoader /> : daily.error || !d ? (
        <ErrorState message={`The report could not be loaded.${daily.error instanceof Error ? ` ${daily.error.message}` : ""}`} onRetry={() => void daily.refetch()} />
      ) : (
        <Body daily={d} table={table.data} tableLoading={table.isLoading} groupBy={groupBy} setGroupBy={setGroupBy} source={source} page={page} setPage={setPage} branchName={branchName} />
      )}
    </div>
  )
}

function Body({ daily, table, tableLoading, groupBy, setGroupBy, source, page, setPage, branchName }: {
  daily: SalesReport
  table: SalesReport | undefined
  tableLoading: boolean
  groupBy: Grouping
  setGroupBy: (g: Grouping) => void
  source: SalesSource
  page: number
  setPage: (p: number) => void
  branchName: string | null
}) {
  const fmt = useAdminCurrency()
  const money = (v: number) => formatMoney(v, fmt)
  const t = daily.totals
  const p = daily.previous.totals
  const rev = (x: { onlineRevenue: number; counterRevenue: number }) => revenueOf(x, source)

  // ── Chart buckets (days → weeks → months) ───────────────────────────────
  const buckets = useMemo(() => bucketDays(daily.from, daily.to, daily.rows.map((r) => ({ key: r.key, online: r.onlineRevenue, counter: r.counterRevenue }))), [daily])
  const g = buckets.granularity
  const labels = buckets.buckets.map((b) => bucketLabel(b, g, true))
  const totalSpark = buckets.online.map((o, i) => o + buckets.counter[i])
  const series: Series[] = [
    { key: "online", label: "Online orders", color: C_ONLINE, values: buckets.online },
    { key: "counter", label: "Counter sales", color: C_COUNTER, values: buckets.counter },
  ].filter((s) => source === "all" || (source === "online") === (s.key === "online"))

  // ── Headline tiles, per source ─────────────────────────────────────────
  type Tile = { label: string; value: ReactNode; now: number; before: number; spark: number[]; ratio?: boolean; note?: ReactNode }
  const share = (x: typeof t) => div(x.counterRevenue, x.revenue)
  const deliveryShare = (x: typeof t) => div(x.deliveryOrders, x.orders)
  const tiles: Tile[] =
    source === "all"
      ? [
          { label: "Total sales", value: <Money value={t.revenue} fmt={fmt} />, now: t.revenue, before: p.revenue, spark: totalSpark, note: `${(t.orders + t.counterSales).toLocaleString()} sales` },
          { label: "Online orders", value: <Money value={t.onlineRevenue} fmt={fmt} />, now: t.onlineRevenue, before: p.onlineRevenue, spark: buckets.online, note: `${t.orders.toLocaleString()} orders` },
          { label: "Counter sales", value: <Money value={t.counterRevenue} fmt={fmt} />, now: t.counterRevenue, before: p.counterRevenue, spark: buckets.counter, note: `${t.counterSales.toLocaleString()} sales` },
          { label: "Average sale", value: <Money value={t.averageSaleValue} fmt={fmt} />, now: t.averageSaleValue, before: p.averageSaleValue, spark: [] },
          { label: "Counter share", value: pct(share(t)), now: share(t), before: share(p), spark: [], ratio: true, note: "of all sales" },
        ]
      : source === "online"
        ? [
            { label: "Online revenue", value: <Money value={t.onlineRevenue} fmt={fmt} />, now: t.onlineRevenue, before: p.onlineRevenue, spark: buckets.online },
            { label: "Orders", value: t.orders.toLocaleString(), now: t.orders, before: p.orders, spark: [] },
            { label: "Average order", value: <Money value={Math.round(div(t.onlineRevenue, t.orders))} fmt={fmt} />, now: div(t.onlineRevenue, t.orders), before: div(p.onlineRevenue, p.orders), spark: [] },
            { label: "Units sold", value: t.items.toLocaleString(), now: t.items, before: p.items, spark: [] },
            { label: "Delivery share", value: pct(deliveryShare(t)), now: deliveryShare(t), before: deliveryShare(p), spark: [], ratio: true, note: "of orders" },
          ]
        : [
            { label: "Counter revenue", value: <Money value={t.counterRevenue} fmt={fmt} />, now: t.counterRevenue, before: p.counterRevenue, spark: buckets.counter },
            { label: "Sales", value: t.counterSales.toLocaleString(), now: t.counterSales, before: p.counterSales, spark: [] },
            { label: "Average sale", value: <Money value={Math.round(div(t.counterRevenue, t.counterSales))} fmt={fmt} />, now: div(t.counterRevenue, t.counterSales), before: div(p.counterRevenue, p.counterSales), spark: [] },
            { label: "Units sold", value: t.counterItems.toLocaleString(), now: t.counterItems, before: p.counterItems, spark: [], note: "where items were listed" },
          ]
  const empty = rev(t) === 0 && (source === "online" ? t.orders : source === "counter" ? t.counterSales : t.orders + t.counterSales) === 0

  // ── Highlights from the daily figures ──────────────────────────────────
  const days = daily.rows.map((r) => ({ key: r.key, v: rev(r) })).filter((x) => x.v > 0)
  const best = days.reduce<{ key: string; v: number } | null>((a, b) => (!a || b.v > a.v ? b : a), null)
  const nDays = differenceInCalendarDays(parseISO(daily.to), parseISO(daily.from)) + 1
  const perWeekday = days.reduce((acc, x) => { acc[parseISO(x.key).getDay()] += x.v; return acc }, Array<number>(7).fill(0))
  const bestWeekday = perWeekday.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0)
  const highlights = [
    { icon: Trophy, label: "Best day", value: best ? format(parseISO(best.key), "EEE d MMM") : "—", sub: best ? money(best.v) : "no sales yet" },
    { icon: Gauge, label: "Average per day", value: money(Math.round(div(rev(t), nDays))), sub: `over ${nDays} ${nDays === 1 ? "day" : "days"}` },
    { icon: CalendarDays, label: "Best weekday", value: perWeekday[bestWeekday] > 0 ? WEEKDAYS[bestWeekday] : "—", sub: perWeekday[bestWeekday] > 0 ? `${money(perWeekday[bestWeekday])} in total` : "no sales yet" },
    { icon: CalendarCheck, label: "Days with sales", value: `${days.length} of ${nDays}`, sub: nDays > 0 ? `${pct(days.length / nDays)} of days` : "" },
  ]

  // ── The breakdown ──────────────────────────────────────────────────────
  const eff: SalesSource = groupBy === "option" ? "online" : source
  const rows = useMemo(() => {
    const list = (table?.rows ?? []).filter((r) => (eff === "online" ? r.orders > 0 || r.onlineRevenue > 0 : eff === "counter" ? r.counterSales > 0 || r.counterRevenue > 0 : true))
    return groupBy === "day" ? [...list].sort((a, b) => (a.key < b.key ? 1 : -1)) : [...list].sort((a, b) => revenueOf(b, eff) - revenueOf(a, eff))
  }, [table, eff, groupBy])
  const max = Math.max(1, ...rows.map((r) => revenueOf(r, eff)))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const meta = { page, limit: PAGE_SIZE, total: rows.length, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }
  const sum = (pick: (r: SalesReportRow) => number) => rows.reduce((s, r) => s + pick(r), 0)
  const rowLabel = (r: SalesReportRow) => (groupBy === "day" ? format(parseISO(r.key), "EEE d MMM yyyy") : r.label)
  const firstHead = GROUPS.find(([k]) => k === groupBy)?.[1].replace("By ", "") ?? ""

  return (
    <div className="space-y-5">
      {branchName ? <p className="text-xs text-muted-foreground" data-cy="report-branch-note">Showing {branchName} only. Counter sales filed for the whole business appear under All branches.</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-cy="report-tiles">
        {tiles.map((x) => <StatTile key={x.label} {...x} upIsGood />)}
      </div>

      {empty ? (
        <EmptyState title="No sales in this period" description="Counter sales count on the date of the sale. If you recorded one and it isn't here, check its date. Try a longer period or All branches." />
      ) : (
        <>
          <ChartCard
            title="Sales over time"
            description={`${g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"} sales, ${source === "all" ? "online orders and counter sales stacked" : source === "online" ? "online orders" : "counter sales"}.`}
            legend={series.length > 1 ? series : undefined}
            table={{ columns: ["Period", ...series.map((s) => s.label), ...(series.length > 1 ? ["Total"] : [])], rows: labels.map((l, i) => [l, ...series.map((s) => money(s.values[i])), ...(series.length > 1 ? [money(series.reduce((a, s) => a + s.values[i], 0))] : [])]) }}
          >
            <ColumnChart labels={labels} series={series} format={money} tickLabel={(i) => bucketLabel(buckets.buckets[i], g)} height={260} />
          </ChartCard>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-cy="report-highlights">
            {highlights.map((h) => (
              <Card key={h.label}>
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><h.icon className="size-4" aria-hidden /></span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{h.label}</p>
                    <p className="truncate font-display text-base font-semibold">{h.value}</p>
                    <p className="truncate text-xs text-muted-foreground">{h.sub}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div>
            <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as Grouping)} className="min-w-0 max-w-full">
              <TabsList>{GROUPS.map(([k, l]) => <TabsTrigger key={k} value={k} data-cy={`report-${k}`}>{l}</TabsTrigger>)}</TabsList>
            </Tabs>
            {groupBy === "option" ? <p className="mt-2 text-xs text-muted-foreground">Options are recorded on online orders only, so this view shows online orders whatever is selected above.</p> : null}

            {tableLoading && !table ? <PageLoader /> : rows.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nothing to show for this view.</p>
            ) : (
              <div className="mt-3" data-cy="report-table">
                {/* Phones: one card per row. */}
                <ul className="divide-y divide-border rounded-xl border border-border bg-card md:hidden">
                  {pageRows.map((r) => (
                    <li key={r.key} className="p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 break-words font-medium">{rowLabel(r)}</span>
                        <Money value={revenueOf(r, eff)} fmt={fmt} className="shrink-0 font-semibold tabular-nums" />
                      </div>
                      <MixBar online={eff === "counter" ? 0 : r.onlineRevenue} counter={eff === "online" ? 0 : r.counterRevenue} max={max} className="mt-1.5" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {eff !== "counter" ? `${r.orders} ${r.orders === 1 ? "order" : "orders"} · ${money(r.onlineRevenue)} online` : null}
                        {eff === "all" ? " · " : null}
                        {eff !== "online" ? `${r.counterSales} counter ${r.counterSales === 1 ? "sale" : "sales"} · ${money(r.counterRevenue)}` : null}
                      </p>
                    </li>
                  ))}
                  <li className="flex justify-between bg-muted/40 p-3 text-sm font-medium"><span>Total ({rows.length})</span><Money value={sum((r) => revenueOf(r, eff))} fmt={fmt} /></li>
                </ul>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      {eff === "all" ? (
                        <TableRow><TableHead>{firstHead}</TableHead><TableHead className="text-right">Online orders</TableHead><TableHead className="text-right">Counter sales</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-40">Mix</TableHead></TableRow>
                      ) : eff === "online" ? (
                        <TableRow><TableHead>{firstHead}</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">Delivery</TableHead><TableHead className="text-right">Discounts</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow>
                      ) : (
                        <TableRow><TableHead>{firstHead}</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="w-40">Share</TableHead></TableRow>
                      )}
                    </TableHeader>
                    <TableBody>
                      {pageRows.map((r) => (
                        <TableRow key={r.key}>
                          <TableCell className="font-medium">{rowLabel(r)}</TableCell>
                          {eff === "all" ? (
                            <>
                              <TableCell className="text-right tabular-nums"><Money value={r.onlineRevenue} fmt={fmt} /><span className="block text-xs text-muted-foreground">{r.orders} {r.orders === 1 ? "order" : "orders"}</span></TableCell>
                              <TableCell className="text-right tabular-nums"><Money value={r.counterRevenue} fmt={fmt} /><span className="block text-xs text-muted-foreground">{r.counterSales} {r.counterSales === 1 ? "sale" : "sales"}</span></TableCell>
                              <TableCell className="text-right font-medium tabular-nums"><Money value={r.revenue} fmt={fmt} /></TableCell>
                              <TableCell><MixBar online={r.onlineRevenue} counter={r.counterRevenue} max={max} /></TableCell>
                            </>
                          ) : eff === "online" ? (
                            <>
                              <TableCell className="text-right tabular-nums">{r.orders}</TableCell>
                              <TableCell className="text-right tabular-nums">{r.items}</TableCell>
                              <TableCell className="text-right tabular-nums"><Money value={r.subtotal} fmt={fmt} /></TableCell>
                              <TableCell className="text-right tabular-nums"><Money value={r.deliveryFees} fmt={fmt} /></TableCell>
                              <TableCell className="text-right tabular-nums"><Money value={r.discounts} fmt={fmt} /></TableCell>
                              <TableCell className="text-right font-medium tabular-nums"><Money value={r.onlineRevenue} fmt={fmt} /></TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="text-right tabular-nums">{r.counterSales}</TableCell>
                              <TableCell className="text-right tabular-nums">{r.counterItems || "—"}</TableCell>
                              <TableCell className="text-right font-medium tabular-nums"><Money value={r.counterRevenue} fmt={fmt} /></TableCell>
                              <TableCell><MixBar online={0} counter={r.counterRevenue} max={max} /></TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/40 font-medium hover:bg-muted/40">
                        <TableCell>Total ({rows.length})</TableCell>
                        {eff === "all" ? (
                          <>
                            <TableCell className="text-right tabular-nums"><Money value={sum((r) => r.onlineRevenue)} fmt={fmt} /></TableCell>
                            <TableCell className="text-right tabular-nums"><Money value={sum((r) => r.counterRevenue)} fmt={fmt} /></TableCell>
                            <TableCell className="text-right tabular-nums"><Money value={sum((r) => r.revenue)} fmt={fmt} /></TableCell>
                            <TableCell />
                          </>
                        ) : eff === "online" ? (
                          <>
                            <TableCell className="text-right tabular-nums">{sum((r) => r.orders)}</TableCell>
                            <TableCell className="text-right tabular-nums">{sum((r) => r.items)}</TableCell>
                            <TableCell className="text-right tabular-nums"><Money value={sum((r) => r.subtotal)} fmt={fmt} /></TableCell>
                            <TableCell className="text-right tabular-nums"><Money value={sum((r) => r.deliveryFees)} fmt={fmt} /></TableCell>
                            <TableCell className="text-right tabular-nums"><Money value={sum((r) => r.discounts)} fmt={fmt} /></TableCell>
                            <TableCell className="text-right tabular-nums"><Money value={sum((r) => r.onlineRevenue)} fmt={fmt} /></TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-right tabular-nums">{sum((r) => r.counterSales)}</TableCell>
                            <TableCell className="text-right tabular-nums">{sum((r) => r.counterItems) || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums"><Money value={sum((r) => r.counterRevenue)} fmt={fmt} /></TableCell>
                            <TableCell />
                          </>
                        )}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <Pagination meta={meta} onPageChange={setPage} />
              </div>
            )}
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">Online orders are paid orders (cancelled and refunded are left out). Counter sales are walk-in and catering sales recorded in the app, counted on the date of the sale. Counter sales appear under an item or menu only when the sale listed its items; the rest show as "Sales without items listed". Times are in {daily.timezone}.</p>
    </div>
  )
}

/** A bar whose length is the row's share of the biggest row, split into online (blue) and counter (orange). */
function MixBar({ online, counter, max, className }: { online: number; counter: number; max: number; className?: string }) {
  const total = online + counter
  const width = total > 0 ? Math.max(3, (total / Math.max(1, max)) * 100) : 0
  return (
    <div className={cn("h-2 w-full rounded-full bg-muted", className)} role="img" aria-label={`${Math.round(online / 100).toLocaleString()} online, ${Math.round(counter / 100).toLocaleString()} counter`}>
      <div className="flex h-2 overflow-hidden rounded-full" style={{ width: `${width}%` }}>
        {online > 0 ? <div style={{ flexGrow: online, background: C_ONLINE }} /> : null}
        {online > 0 && counter > 0 ? <div className="w-0.5 shrink-0 bg-card" /> : null}
        {counter > 0 ? <div style={{ flexGrow: counter, background: C_COUNTER }} /> : null}
      </div>
    </div>
  )
}
