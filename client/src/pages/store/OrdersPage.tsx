import { format } from "date-fns"
import { ChevronRight, ClipboardList } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { Pagination } from "@/components/shared/Pagination"
import { EmptyState, ErrorState } from "@/components/shared/States"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { NothingSavedNotice } from "@/components/store/AccountPrompts"
import { Button } from "@/components/ui/button"
import { useCustomer } from "@/contexts/CustomerContext"
import { useStore } from "@/contexts/StoreContext"
import { useMyOrders } from "@/hooks/useCustomerOrders"
import { plural } from "@/lib/utils"

export default function OrdersPage() {
  const { slug, fmt } = useStore()
  const { checking, isSignedIn } = useCustomer()
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useMyOrders(slug, page, isSignedIn)

  if (checking) return <PageLoader label="Checking your account…" />
  if (!isSignedIn) {
    return <NothingSavedNotice title="Your orders" text="Orders you place are saved on this device and show up here." cy="orders-empty" />
  }
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-6" data-cy="orders-page">
      <h1 className="text-2xl font-semibold">Your orders</h1>
      {isLoading ? <PageLoader /> : error ? <ErrorState message="Could not load your orders." onRetry={() => void refetch()} /> : !data || data.data.length === 0 ? (
        <EmptyState title="No orders yet" description="Your orders will show up here." icon={<ClipboardList className="size-8" />} action={<Button asChild><Link to={`/${slug}/menu`}>Browse the menu</Link></Button>} />
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card">
            {data.data.map((o) => (
              <li key={o.id}>
                <Link to={`/${slug}/orders/${o.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/50" data-cy={`order-row-${o.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{o.number}</p>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{format(new Date(o.createdAt), "d MMM yyyy, HH:mm")} · {o.branchName} · {plural(o.itemCount, "item")}</p>
                  </div>
                  <Money value={o.total} fmt={fmt} className="font-medium" />
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
