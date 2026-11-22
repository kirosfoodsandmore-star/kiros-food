import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { BranchSelect } from "@/components/admin/BranchSelect"
import { PageHeader } from "@/components/layout/PageHeader"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { ErrorState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { useDashboard } from "@/hooks/useAdminMisc"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { useAdminBranch } from "@/hooks/useAdminBranch"
import { ORDER_STATUS_LABELS } from "@/lib/enums"
import type { OrderStatus } from "@/types/store.types"

export default function DashboardPage() {
  const fmt = useAdminCurrency()
  const { can } = useAuth()
  const [branchId, setBranchId] = useAdminBranch()
  const { data, isLoading, error, refetch } = useDashboard(branchId || undefined)
  if (isLoading) return <PageLoader />
  if (error || !data) return <ErrorState message={`Dashboard could not be loaded.${error instanceof Error && error.message ? ` ${error.message}` : ""}`} onRetry={() => void refetch()} />
  // Order counts are for everyone with the dashboard; money needs the sales-report permission (the server leaves it out otherwise).
  const { today, last30Days } = data
  const split = (t: typeof today) => (t.onlineRevenue !== null && t.counterRevenue !== null ? <>Online <Money value={t.onlineRevenue} fmt={fmt} /> · Counter <Money value={t.counterRevenue} fmt={fmt} /></> : null)
  const tiles: Array<{ label: string; value: ReactNode; note?: ReactNode }> = [
    { label: "Orders today", value: String(today.orders), note: today.counterSales !== null ? "online" : undefined },
    ...(today.counterSales !== null ? [{ label: "Counter sales today", value: String(today.counterSales), note: "walk-in and catering" }] : []),
    ...(today.revenue !== null ? [{ label: "Revenue today", value: <Money value={today.revenue} fmt={fmt} />, note: split(today) }] : []),
    ...(today.averageOrderValue !== null ? [{ label: "Average sale", value: <Money value={today.averageOrderValue} fmt={fmt} />, note: "per order or counter sale" }] : []),
    { label: "Items sold today", value: String(today.items) },
  ]
  const tileCols = tiles.length >= 5 ? "lg:grid-cols-5" : tiles.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-2"
  return (
    <div data-cy="dashboard-page">
      <PageHeader title="Dashboard" description={`${data.date} · ${data.timezone}`} actions={<BranchSelect value={branchId} onChange={setBranchId} allowAll />} />
      <div className={`grid grid-cols-2 gap-3 ${tileCols}`} data-cy="dashboard-tiles">
        {tiles.map((t) => (
          <Card key={t.label}><CardContent className="p-4 sm:p-5"><p className="text-sm text-muted-foreground">{t.label}</p><p className="mt-1 truncate font-display text-xl font-semibold sm:text-2xl">{t.value}</p>{t.note ? <p className="mt-0.5 text-xs text-muted-foreground">{t.note}</p> : null}</CardContent></Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Live orders</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {Object.entries(data.liveStatusCounts).length === 0 ? <li className="text-muted-foreground">Nothing in progress.</li> : null}
              {Object.entries(data.liveStatusCounts).map(([s, n]) => (
                <li key={s} className="flex justify-between"><span>{ORDER_STATUS_LABELS[s as OrderStatus] ?? s}</span><span className="font-medium">{n}</span></li>
              ))}
            </ul>
            {can("orders.view") ? <Link to="/admin/live" className="mt-3 inline-block text-sm text-primary hover:underline" data-cy="dashboard-live-link">Open the live board</Link> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top items today</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {data.topItemsToday.length === 0 ? <li className="text-muted-foreground">No sales yet today.</li> : null}
              {data.topItemsToday.map((t, i) => (
                <li key={t.label} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0"><span className="block truncate">{i + 1}. {t.label}</span>{t.counter !== undefined ? <span className="block text-xs text-muted-foreground">{t.online} online · {t.counter} at the counter</span> : null}</span>
                  <span className="shrink-0 font-medium">{t.items}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader><CardTitle>Branches</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.branches.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2">
                  {can("branches.view") ? <Link to={`/admin/branches/${b.id}`} className="hover:underline">{b.name}</Link> : <span>{b.name}</span>}
                  <Badge variant={b.isPaused ? "warning" : b.isOpen ? "success" : "neutral"}>{b.isPaused ? "Paused" : b.isOpen ? `Open · ${b.closesAt}` : "Closed"}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Last 30 days</CardTitle></CardHeader>
        <CardContent className={`grid grid-cols-2 gap-3 text-sm ${last30Days.counterSales !== null ? "sm:grid-cols-5" : "sm:grid-cols-4"}`} data-cy="dashboard-30">
          <p>Orders <span className="block font-display text-xl font-semibold">{data.last30Days.orders}</span></p>
          {last30Days.counterSales !== null ? <p>Counter sales <span className="block font-display text-xl font-semibold">{last30Days.counterSales}</span></p> : null}
          {last30Days.revenue !== null ? <p>Revenue <span className="block font-display text-xl font-semibold"><Money value={last30Days.revenue} fmt={fmt} /></span><span className="block text-xs text-muted-foreground">{split(last30Days)}</span></p> : null}
          <p>Delivery <span className="block font-display text-xl font-semibold">{data.last30Days.deliveryOrders}</span></p>
          <p>Pickup <span className="block font-display text-xl font-semibold">{data.last30Days.pickupOrders}</span></p>
        </CardContent>
      </Card>
    </div>
  )
}
