// A slim bar under the header while the customer has an order in progress, on every page except the orders
// themselves. Placing an order lands on its page; this is the way back to it from anywhere else (the menu, the
// FAQ, after pressing Back), without leaving a permanent link in the header.
import { ArrowRight } from "lucide-react"
import { Link, useMatch } from "react-router-dom"
import { useCustomer } from "@/contexts/CustomerContext"
import { useStore } from "@/contexts/StoreContext"
import { useActiveOrders } from "@/hooks/useCustomerOrders"
import { ORDER_STATUS_LABELS } from "@/lib/enums"
import { cn } from "@/lib/utils"

export function ActiveOrderBar() {
  const { slug } = useStore()
  const { isSignedIn } = useCustomer()
  const onOrders = Boolean(useMatch("/:slug/orders/*"))
  const active = useActiveOrders(slug, isSignedIn)
  if (onOrders || active.length === 0) return null

  const [first] = active
  const many = active.length > 1
  const needsPayment = first.status === "pending_payment"
  return (
    <Link
      to={many ? `/${slug}/orders` : `/${slug}/orders/${first.id}`}
      className="block border-b bg-primary/10 transition-colors hover:bg-primary/15"
      data-cy="active-order-bar"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 text-sm">
        <span className="relative flex size-2.5 shrink-0" aria-hidden>
          <span className={cn("absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping", needsPayment ? "bg-warning" : "bg-success")} />
          <span className={cn("relative inline-flex size-2.5 rounded-full", needsPayment ? "bg-warning" : "bg-success")} />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {many ? (
            <><b className="font-semibold">{active.length} orders</b> in progress</>
          ) : (
            <><b className="font-semibold"><span className="hidden sm:inline">Order </span>{first.number}</b> · {needsPayment ? "payment due" : ORDER_STATUS_LABELS[first.status]}</>
          )}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary">
          {many ? "View orders" : "Track order"} <ArrowRight className="size-4" />
        </span>
      </div>
    </Link>
  )
}
