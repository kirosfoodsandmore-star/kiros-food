// Real-time board: one column per status; socket events invalidate the queries so new orders land within seconds.
import { formatDistanceToNow } from "date-fns"
import { Bike, Store as StoreIcon } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { BranchSelect } from "@/components/admin/BranchSelect"
import { DispatchDialog } from "@/components/admin/DispatchDialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { ErrorState } from "@/components/shared/States"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { useLiveOrderInvalidation, useOrderBoard, useOrderMutations } from "@/hooks/useAdminOrders"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { usePersistedState } from "@/hooks/usePersistedState"
import { BOARD_STATUSES, ORDER_STATUS_LABELS } from "@/lib/enums"
import type { OrderStatus, OrderSummary } from "@/types/store.types"
import { plural } from "@/lib/utils"

function nextStep(o: OrderSummary): { to: OrderStatus; label: string } | null {
  switch (o.status) {
    case "paid":
      return { to: "accepted", label: "Accept" }
    case "accepted":
      return { to: "preparing", label: "Start preparing" }
    case "preparing":
      return { to: "ready", label: "Ready" }
    case "ready":
      return o.fulfilment === "delivery" ? { to: "out_for_delivery", label: "Out for delivery" } : { to: "completed", label: "Complete" }
    case "out_for_delivery":
      return { to: "completed", label: "Delivered" }
    default:
      return null
  }
}

export default function LiveOrdersPage() {
  const fmt = useAdminCurrency()
  const { can } = useAuth()
  const [branchId, setBranchId] = usePersistedState<string>("kiros.admin.branch", "")
  useLiveOrderInvalidation()
  const { data, isLoading, error, refetch } = useOrderBoard(branchId || undefined)
  const { changeStatus } = useOrderMutations()
  // A delivery with no rider asks who's taking it before it goes out.
  const [dispatch, setDispatch] = useState<{ id: string; number: string; branchName: string } | null>(null)

  if (isLoading) return <PageLoader />
  if (error || !data) return <ErrorState message="The board could not be loaded." onRetry={() => void refetch()} />
  return (
    <div data-cy="live-orders-page">
      <PageHeader title="Live orders" description="Paid orders move left to right. New orders chime." actions={<BranchSelect value={branchId} onChange={setBranchId} allowAll />} />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {BOARD_STATUSES.map((status) => (
          // Columns share the width on large screens and keep a readable minimum (the board scrolls sideways below that).
          <section key={status} className="min-w-60 flex-1 basis-0 rounded-xl border bg-muted/40 xl:min-w-44" data-cy={`board-${status}`}>
            <header className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
              {ORDER_STATUS_LABELS[status]}
              <span className="rounded-full bg-card px-2 text-xs">{data[status]?.length ?? 0}</span>
            </header>
            <ul className="space-y-2 p-2">
              {(data[status] ?? []).map((o) => {
                const step = nextStep(o)
                return (
                  <li key={o.id} className="rounded-lg border bg-card p-3 text-sm shadow-sm" data-cy={`board-card-${o.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/admin/orders/${o.id}`} className="font-semibold hover:underline">{o.number}</Link>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">{o.fulfilment === "delivery" ? <Bike className="size-3.5" /> : <StoreIcon className="size-3.5" />}{o.fulfilment}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{o.branchName} · {plural(o.itemCount, "item")} · <Money value={o.total} fmt={fmt} /></p>
                    <p className="text-xs text-muted-foreground">{o.scheduledFor ? `Scheduled ${new Date(o.scheduledFor).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : `Paid ${o.paidAt ? formatDistanceToNow(new Date(o.paidAt), { addSuffix: true }) : ""}`}</p>
                    {o.riderName ? <p className="text-xs">Rider: {o.riderName}</p> : null}
                    {step && can("orders.update_status") ? (
                      <Button size="sm" className="mt-2 w-full" onClick={() => (step.to === "out_for_delivery" && !o.riderId && can("orders.assign_rider") ? setDispatch(o) : changeStatus.mutate({ id: o.id, status: step.to }, { onError: (e) => toast.error(e.message) }))} loading={changeStatus.isPending && changeStatus.variables?.id === o.id} data-cy="board-advance">{step.label}</Button>
                    ) : null}
                  </li>
                )
              })}
              {(data[status] ?? []).length === 0 ? <li className="py-6 text-center text-xs text-muted-foreground">—</li> : null}
            </ul>
          </section>
        ))}
      </div>
      <DispatchDialog order={dispatch} onOpenChange={(open) => !open && setDispatch(null)} />
    </div>
  )
}
