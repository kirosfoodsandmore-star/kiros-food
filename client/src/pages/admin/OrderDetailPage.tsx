import { format } from "date-fns"
import { Printer } from "lucide-react"
import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { DispatchDialog } from "@/components/admin/DispatchDialog"
import { OrderTicket } from "@/components/admin/OrderTicket"
import { PageHeader } from "@/components/layout/PageHeader"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { ErrorState } from "@/components/shared/States"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { StatusTimeline } from "@/components/shared/StatusTimeline"
import { ChatPanel } from "@/components/store/ChatPanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { useAdminOrder, useLiveOrderInvalidation, useOrderMutations, usePaymentMutations, useRiders } from "@/hooks/useAdminOrders"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { ORDER_STATUS_LABELS } from "@/lib/enums"
import { toMajor, toMinor } from "@/lib/money"
import type { OrderStatus } from "@/types/store.types"

export default function AdminOrderDetailPage() {
  const { id } = useParams()
  const fmt = useAdminCurrency()
  const { can, session } = useAuth()
  useLiveOrderInvalidation()
  const { data: order, isLoading, error, refetch } = useAdminOrder(id)
  const { changeStatus, reject, refund, assignRider } = useOrderMutations()
  const payments = usePaymentMutations()
  const { data: riders } = useRiders(id, Boolean(order && order.fulfilment === "delivery" && can("orders.assign_rider")))
  const [dialog, setDialog] = useState<"reject" | "refund" | "payment-reject" | null>(null)
  const [reason, setReason] = useState("")
  const [amount, setAmount] = useState("")
  // A delivery with no rider asks who's taking it before it goes out.
  const [dispatch, setDispatch] = useState<{ id: string; number: string; branchName: string } | null>(null)

  if (isLoading) return <PageLoader />
  if (error || !order) return <ErrorState message="Order not found." onRetry={() => void refetch()} />
  const fail = (e: Error) => toast.error(e.message)
  const closeDialog = () => { setDialog(null); setReason(""); setAmount("") }

  return (
    <>
    {/* On screen: the full page. When printing, only the ticket below is shown. */}
    <div className="print:hidden" data-cy="admin-order-page">
      <PageHeader
        title={`Order ${order.number}`}
        description={`${format(new Date(order.createdAt), "d MMM yyyy, HH:mm")} · ${order.branchName} · ${order.fulfilment}`}
        actions={<><StatusBadge status={order.status} className="text-sm" /><Button variant="outline" onClick={() => window.print()} data-cy="print-ticket"><Printer /> Ticket</Button></>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {order.status === "awaiting_confirmation" && order.payment && can("payments.confirm") ? (
            <Card className="border-warning/50" data-cy="confirm-payment-card">
              <CardHeader><CardTitle>Bank transfer to confirm</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3 text-sm">
                <p>Claimed {order.payment.claimedAt ? format(new Date(order.payment.claimedAt), "d MMM, HH:mm") : ""} · <Money value={order.payment.amount} fmt={fmt} className="font-semibold" /> · ref {order.number}</p>
                {order.payment.proofUrl ? <a href={order.payment.proofUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">View receipt</a> : <span className="text-muted-foreground">No receipt uploaded</span>}
                <div className="ml-auto flex gap-2">
                  <Button onClick={() => payments.confirm.mutate(order.payment!.id, { onSuccess: () => toast.success("Payment confirmed"), onError: fail })} loading={payments.confirm.isPending} data-cy="payment-confirm">Confirm payment</Button>
                  <Button variant="destructive" onClick={() => setDialog("payment-reject")} data-cy="payment-reject">Reject</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader><CardTitle>Items</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y">
                {order.lines.map((l) => (
                  <li key={l.id} className="flex gap-3 py-2 text-sm">
                    <span className="w-8 font-semibold">{l.quantity}×</span>
                    <div className="flex-1">
                      <p className="font-medium">{l.itemName}</p>
                      {l.options.length > 0 ? <p className="text-muted-foreground">{l.options.map((o) => `${o.groupName}: ${o.name}`).join(" · ")}</p> : null}
                      {l.note ? <p className="font-medium text-accent">Note: {l.note}</p> : null}
                    </div>
                    <Money value={l.lineTotal} fmt={fmt} />
                  </li>
                ))}
              </ul>
              {order.note ? <p className="mt-3 rounded-lg bg-accent/10 p-2 text-sm"><span className="font-medium">Order note:</span> {order.note}</p> : null}
              <dl className="mt-3 space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between"><dt>Subtotal</dt><dd><Money value={order.subtotal} fmt={fmt} /></dd></div>
                <div className="flex justify-between"><dt>Delivery</dt><dd><Money value={order.deliveryFee} fmt={fmt} /></dd></div>
                {order.discount > 0 ? <div className="flex justify-between"><dt>Discount {order.promoCode}</dt><dd>−<Money value={order.discount} fmt={fmt} /></dd></div> : null}
                <div className="flex justify-between font-semibold"><dt>Total</dt><dd><Money value={order.total} fmt={fmt} /></dd></div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Customer & fulfilment</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Name</span><br />{order.customerName ?? "—"}</p>
              <p><span className="text-muted-foreground">Phone</span><br />{order.customerPhone}</p>
              <p><span className="text-muted-foreground">Time</span><br />{order.scheduledFor ? format(new Date(order.scheduledFor), "EEE d MMM, HH:mm") : "As soon as possible"}</p>
              <p><span className="text-muted-foreground">Payment</span><br />{order.paymentMethod} · {order.payment?.status ?? "—"}</p>
              {order.deliveryAddress ? <p className="sm:col-span-2"><span className="text-muted-foreground">Deliver to</span><br />{order.deliveryAddress.line}{order.deliveryAddress.instructions ? ` — ${order.deliveryAddress.instructions}` : ""}</p> : null}
              {order.cancelReason ? <p className="text-destructive sm:col-span-2">Reason: {order.cancelReason}</p> : null}
            </CardContent>
          </Card>
          {can("chat.view") ? <ChatPanel kind="staff" orderId={order.id} canReply={can("chat.reply")} /> : null}
          <Card><CardHeader><CardTitle>History</CardTitle></CardHeader><CardContent><StatusTimeline events={order.events} /></CardContent></Card>
        </div>
        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(order.nextStatuses ?? []).filter((s) => s !== "cancelled" && s !== "refunded").map((s) => (
                <Button key={s} className="w-full" onClick={() => (s === "out_for_delivery" && order.fulfilment === "delivery" && !order.riderId && can("orders.assign_rider") ? setDispatch({ id: order.id, number: order.number, branchName: order.branchName }) : changeStatus.mutate({ id: order.id, status: s as OrderStatus }, { onError: fail }))} loading={changeStatus.isPending} data-cy={`action-${s}`}>
                  Mark {ORDER_STATUS_LABELS[s as OrderStatus].toLowerCase()}
                </Button>
              ))}
              {order.nextStatuses?.includes("cancelled") && can("orders.reject") ? <Button variant="outline" className="w-full text-destructive" onClick={() => setDialog("reject")} data-cy="action-reject">Reject order</Button> : null}
              {order.nextStatuses?.includes("refunded") && can("orders.refund") ? <Button variant="outline" className="w-full" onClick={() => setDialog("refund")} data-cy="action-refund">Refund</Button> : null}
              {(order.nextStatuses ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No actions available.</p> : null}
            </CardContent>
          </Card>
          {order.fulfilment === "delivery" && can("orders.assign_rider") ? (
            <Card>
              <CardHeader><CardTitle>Rider</CardTitle></CardHeader>
              <CardContent>
                <Select value={order.riderId ?? "__none"} onValueChange={(v) => assignRider.mutate({ id: order.id, riderId: v === "__none" ? null : v }, { onError: fail })}>
                  <SelectTrigger data-cy="rider-select"><SelectValue placeholder="Assign a rider" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {(riders ?? []).map((r) => <SelectItem key={r.id} value={r.id} disabled={!r.onDuty && r.id !== order.riderId}>{r.name}{r.onDuty ? "" : " · Off duty"}</SelectItem>)}
                  </SelectContent>
                </Select>
                {order.riderId && order.riderResponse === "pending" ? <p className="mt-2 text-sm text-warning" data-cy="rider-pending">Waiting for {order.riderName} to accept</p> : null}
                {order.riderId && order.riderResponse === "accepted" ? <p className="mt-2 text-sm text-success" data-cy="rider-accepted">{order.riderName} accepted</p> : null}
              </CardContent>
            </Card>
          ) : null}
          <Link to="/admin/orders" className="block text-sm text-primary hover:underline">← All orders</Link>
        </aside>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{dialog === "refund" ? "Refund order" : dialog === "payment-reject" ? "Reject payment" : "Reject order"}</DialogTitle></DialogHeader>
          {dialog === "refund" ? <Field label={`Amount (leave blank for full ${fmt.currencySymbol}${toMajor(order.total)})`}><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} data-cy="refund-amount" /></Field> : null}
          <Field label={dialog === "refund" ? "Note" : "Reason (shown to the customer)"}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} data-cy="reason-input" /></Field>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!reason.trim()}
              loading={reject.isPending || refund.isPending || payments.reject.isPending}
              onClick={() => {
                const done = { onSuccess: closeDialog, onError: fail }
                if (dialog === "reject") reject.mutate({ id: order.id, reason }, done)
                else if (dialog === "refund") refund.mutate({ id: order.id, note: reason, amount: amount ? toMinor(amount) : undefined }, done)
                else if (order.payment) payments.reject.mutate({ id: order.payment.id, reason }, done)
              }}
              data-cy="reason-confirm"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DispatchDialog order={dispatch} onOpenChange={(open) => !open && setDispatch(null)} />
    </div>
    <OrderTicket order={order} restaurantName={session?.restaurant.name ?? ""} fmt={fmt} />
    </>
  )
}
