// What the rider has finished in the last 24 hours: proof of the day's work, and somewhere to look if a customer calls back.
import { format } from "date-fns"
import { CheckCircle2, MapPin } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { EmptyState } from "@/components/shared/States"
import { Card, CardContent } from "@/components/ui/card"
import { useLiveOrderInvalidation, useMyDeliveries } from "@/hooks/useAdminOrders"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { plural } from "@/lib/utils"

export default function RiderDeliveredPage() {
  const fmt = useAdminCurrency()
  useLiveOrderInvalidation()
  const { data, isLoading } = useMyDeliveries(true)
  if (isLoading) return <PageLoader />

  return (
    <div data-cy="rider-delivered">
      <PageHeader title="Delivered" description={data && data.length > 0 ? `${plural(data.length, "delivery", "deliveries")} completed in the last 24 hours.` : "What you've delivered in the last 24 hours shows here."} />
      {!data || data.length === 0 ? <EmptyState title="Nothing delivered yet" /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((o) => (
            <Card key={o.id} data-cy={`delivered-${o.id}`}>
              <CardContent className="space-y-2 pt-5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{o.number}</span>
                  <span className="flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" aria-hidden /> Delivered {o.completedAt ? format(new Date(o.completedAt), "HH:mm") : ""}</span>
                </div>
                <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> {o.deliveryAddress?.line ?? "No address on this order"}</p>
                <p className="text-muted-foreground">{o.customerName ?? "Customer"} · {o.branchName} · <Money value={o.total} fmt={fmt} /></p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
