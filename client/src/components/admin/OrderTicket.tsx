// The printed ticket for an order: what the kitchen cooks, what the rider needs, and what the customer owes.
// It's invisible on screen and takes over the page when printing (the rest of the admin is hidden in print).
// Plain black on white and narrow (fits an 80 mm receipt printer as well as A4), so it never depends on the theme.
import { format } from "date-fns"
import { formatMoney, type CurrencyFormat } from "@/lib/money"
import type { OrderDetail } from "@/types/store.types"

const Rule = () => <hr className="my-2 border-0 border-t border-dashed border-black" />

const PAYMENT_METHOD = { transfer: "Bank transfer", paystack: "Card / Paystack" } as const
const PAYMENT_STATE: Record<string, string> = { pending: "not paid yet", claimed: "waiting to be confirmed", paid: "PAID", failed: "failed", rejected: "rejected", expired: "expired", refunded: "refunded" }

export function OrderTicket({ order, restaurantName, fmt }: { order: OrderDetail; restaurantName: string; fmt: CurrencyFormat }) {
  const money = (n: number) => formatMoney(n, fmt)
  const delivery = order.fulfilment === "delivery"
  const paymentState = order.payment ? (PAYMENT_STATE[order.payment.status] ?? order.payment.status) : "—"

  return (
    <section className="mx-auto hidden w-full max-w-[80mm] bg-white text-[12px] leading-snug text-black print:block" data-cy="order-ticket">
      <header className="text-center">
        <p className="text-base font-bold">{restaurantName}</p>
        <p className="font-semibold">{order.branch.name}</p>
        <p>{[order.branch.address, order.branch.phone].filter(Boolean).join(" · ")}</p>
      </header>
      <Rule />

      <div className="text-center">
        <p className="text-xl font-extrabold tracking-wide">{order.number}</p>
        <p className="mt-1 inline-block border-2 border-black px-3 py-0.5 text-sm font-bold uppercase tracking-wider">{delivery ? "Delivery" : "Pickup"}</p>
        <p className="mt-1">Placed {format(new Date(order.createdAt), "d MMM yyyy, HH:mm")}</p>
        <p className="font-semibold">{order.scheduledFor ? `For ${format(new Date(order.scheduledFor), "EEE d MMM, HH:mm")}` : "As soon as possible"}</p>
      </div>
      <Rule />

      <ul className="space-y-1.5">
        {order.lines.map((l) => (
          <li key={l.id} className="break-inside-avoid">
            <div className="flex gap-2">
              <span className="w-7 shrink-0 font-bold">{l.quantity}×</span>
              <span className="flex-1 font-semibold">{l.itemName}</span>
              <span className="shrink-0">{money(l.lineTotal)}</span>
            </div>
            {l.options.length > 0 ? <p className="pl-9">{l.options.map((o) => `${o.groupName}: ${o.name}`).join(" · ")}</p> : null}
            {l.note ? <p className="pl-9 font-bold">Note: {l.note}</p> : null}
          </li>
        ))}
      </ul>
      {order.note ? <p className="mt-2 border border-black p-1.5 font-semibold">Order note: {order.note}</p> : null}
      <Rule />

      <dl className="space-y-0.5">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
        {delivery ? <div className="flex justify-between"><dt>Delivery</dt><dd>{money(order.deliveryFee)}</dd></div> : null}
        {order.discount > 0 ? <div className="flex justify-between"><dt>Discount{order.promoCode ? ` (${order.promoCode})` : ""}</dt><dd>−{money(order.discount)}</dd></div> : null}
        <div className="flex justify-between pt-1 text-sm font-extrabold"><dt>TOTAL</dt><dd>{money(order.total)}</dd></div>
        <div className="flex justify-between pt-0.5"><dt>Payment</dt><dd>{PAYMENT_METHOD[order.paymentMethod]} · {paymentState}</dd></div>
      </dl>
      <Rule />

      <div className="space-y-0.5">
        <p><span className="font-semibold">Customer:</span> {order.customerName ?? "—"}</p>
        <p><span className="font-semibold">Phone:</span> {order.customerPhone}</p>
        {delivery ? (
          <>
            <p><span className="font-semibold">Deliver to:</span> {order.deliveryAddress?.line ?? "—"}</p>
            {order.deliveryAddress?.instructions ? <p className="font-bold">Instructions: {order.deliveryAddress.instructions}</p> : null}
            <p><span className="font-semibold">Rider:</span> {order.riderName ?? "not assigned yet"}</p>
          </>
        ) : (
          <p className="font-semibold">Customer collects from the branch.</p>
        )}
      </div>
    </section>
  )
}
