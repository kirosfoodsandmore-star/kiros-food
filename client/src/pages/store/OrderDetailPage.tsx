// A customer's order. Desktop: the order itself on the left (payment, items, details), the conversation with the
// branch pinned beside it. Phones: one column in the order people need things (what to do next, what was ordered),
// with the chat and the history folded away until asked for, so nothing important sits below a long scroll.
import { format } from "date-fns"
import { ArrowLeft, Check, ChevronDown, Clock, Copy, FileText, History as HistoryIcon, MapPin, MessageCircle, Phone, RefreshCw, Upload, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { ErrorState } from "@/components/shared/States"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { StatusTimeline } from "@/components/shared/StatusTimeline"
import { NothingSavedNotice } from "@/components/store/AccountPrompts"
import { ChatPanel } from "@/components/store/ChatPanel"
import { OrderProgress } from "@/components/store/OrderProgress"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCustomer } from "@/contexts/CustomerContext"
import { useStore } from "@/contexts/StoreContext"
import { useMyOrder, useOrderActions } from "@/hooks/useCustomerOrders"
import { usePaymentMethods } from "@/hooks/useStore"
import { ORDER_STATUS_LABELS } from "@/lib/enums"
import { cn } from "@/lib/utils"
import { useStoreSession } from "@/stores/storeSession"
import type { OrderEvent } from "@/types/store.types"

/** On phones the first few lines show and the rest unfold; from the lg breakpoint every line is always shown. */
const LINES_SHOWN_ON_PHONE = 3
/** The server refuses a receipt larger than this. */
const MAX_RECEIPT_MB = 10

export default function OrderDetailPage() {
  const { slug, fmt } = useStore()
  const { id } = useParams()
  const navigate = useNavigate()
  const { checking, isSignedIn } = useCustomer()
  const open = useStoreSession((s) => s.open)
  const { data: order, isLoading, error, refetch } = useMyOrder(slug, id, isSignedIn)
  const { cancel, claimTransfer, reorder } = useOrderActions(slug)
  const { data: methods } = usePaymentMethods(slug, order?.branchId ?? null, order?.paymentMethod === "transfer")
  // Receipt: chosen on this page before "I have paid" (fileRef), or added afterwards once the claim is in (lateFileRef).
  const fileRef = useRef<HTMLInputElement>(null)
  const lateFileRef = useRef<HTMLInputElement>(null)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [remaining, setRemaining] = useState<string | null>(null)
  const [allLines, setAllLines] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const payment = order?.payment
  useEffect(() => {
    if (!receipt || !receipt.type.startsWith("image/")) return setReceiptPreview(null)
    const url = URL.createObjectURL(receipt)
    setReceiptPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [receipt])
  useEffect(() => {
    if (!payment?.expiresAt || order?.status !== "pending_payment") return setRemaining(null)
    const tick = () => {
      const ms = new Date(payment.expiresAt!).getTime() - Date.now()
      setRemaining(ms <= 0 ? "expired" : `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [payment?.expiresAt, order?.status])

  if (checking) return <PageLoader label="Checking your account…" />
  if (!isSignedIn) return <NothingSavedNotice title="We can't open this order here" text="Orders are saved on the device they were placed from. If you ordered somewhere else, contact us with your order number and we'll help." cy="order-empty" />
  if (isLoading) return <PageLoader />
  if (error || !order) return <div className="py-8"><ErrorState message="Order not found." onRetry={() => void refetch()} /></div>

  const bank = methods?.bankAccounts ?? []
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success("Copied"))
  /** Checks a picked file; returns it when it can be sent. */
  const acceptReceipt = (file: File | undefined): File | null => {
    if (!file) return null
    if (file.size > MAX_RECEIPT_MB * 1024 * 1024) {
      toast.error(`That file is too big. Please choose one under ${MAX_RECEIPT_MB} MB.`)
      return null
    }
    return file
  }
  const sendClaim = (file: File, done: string) =>
    claimTransfer.mutate({ id: order.id, receipt: file }, { onSuccess: () => { setReceipt(null); toast.success(done) }, onError: (err) => toast.error(err.message) })
  const hiddenLines = Math.max(0, order.lines.length - LINES_SHOWN_ON_PHONE)
  const showChat = !["cancelled", "refunded"].includes(order.status)

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-4 sm:py-6" data-cy="order-detail-page">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <Link to={`/${slug}/orders`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Orders</Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold sm:text-2xl">Order {order.number}</h1>
            <StatusBadge status={order.status} className="text-sm" />
          </div>
          <p className="text-sm text-muted-foreground">{format(new Date(order.createdAt), "d MMM yyyy, HH:mm")} · {order.fulfilment === "delivery" ? "Delivery" : "Pickup"} from {order.branch.name}</p>
        </div>
        <div className="lg:w-[28rem] lg:shrink-0"><OrderProgress status={order.status} fulfilment={order.fulfilment} /></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          {order.status === "pending_payment" && order.paymentMethod === "transfer" ? (
            <Card className="border-warning/50" data-cy="transfer-instructions">
              <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2"><CardTitle>Complete your bank transfer</CardTitle></CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 text-sm sm:p-5 sm:pt-0">
                <p>Transfer exactly <Money value={order.total} fmt={fmt} className="font-semibold" /> and use <span className="font-semibold">{order.number}</span> as the reference.{remaining ? <> Time left: <span className="font-mono font-semibold">{remaining}</span></> : null}</p>
                <div className={cn("grid gap-2", bank.length > 1 && "sm:grid-cols-2")}>
                  {bank.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 py-2 pl-3 pr-1">
                      <div className="min-w-0">
                        <p className="truncate text-muted-foreground">{b.bankName} · {b.accountName}</p>
                        <p className="font-mono text-lg font-semibold tracking-wide">{b.accountNumber}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => copy(b.accountNumber)} aria-label="Copy account number" data-cy="copy-account"><Copy /></Button>
                    </div>
                  ))}
                </div>
                {/* Step 2: attach the transfer receipt. Step 3 ("I have paid") stays locked until one is attached. */}
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = acceptReceipt(e.target.files?.[0]); if (f) setReceipt(f); e.target.value = "" }} data-cy="receipt-input" />
                {receipt ? (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-2" data-cy="receipt-chosen">
                    {receiptPreview ? <img src={receiptPreview} alt="Your receipt" className="size-12 shrink-0 rounded-md object-cover" /> : <span className="grid size-12 shrink-0 place-items-center rounded-md bg-muted"><FileText className="size-5 text-muted-foreground" /></span>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{receipt.name}</p>
                      <p className="text-xs text-muted-foreground">{Math.max(1, Math.round(receipt.size / 1024))} KB</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={claimTransfer.isPending} data-cy="change-receipt">Change</Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setReceipt(null)} disabled={claimTransfer.isPending} aria-label="Remove receipt" data-cy="remove-receipt"><X /></Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => fileRef.current?.click()} data-cy="upload-receipt"><Upload /> Upload receipt</Button>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="accent" loading={claimTransfer.isPending} disabled={!receipt} onClick={() => receipt && sendClaim(receipt, "Thanks, we'll confirm shortly")} aria-describedby="receipt-hint" data-cy="i-have-paid">I have paid</Button>
                  <Button variant="ghost" className="text-destructive" onClick={() => setCancelOpen(true)} data-cy="cancel-order">Cancel order</Button>
                </div>
                {!receipt ? <p id="receipt-hint" className="text-xs text-muted-foreground" data-cy="receipt-hint">After you transfer, upload a screenshot or photo of your receipt, then tap “I have paid”.</p> : <span id="receipt-hint" className="sr-only">Receipt attached.</span>}
              </CardContent>
            </Card>
          ) : null}

          {order.status === "pending_payment" && order.paymentMethod === "paystack" && payment?.authorizationUrl ? (
            <Card className="border-warning/50" data-cy="paystack-pending">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm sm:p-5">
                <p>Your payment hasn't come through yet.</p>
                <div className="flex gap-2">
                  <Button variant="accent" asChild><a href={payment.authorizationUrl}>Pay now</a></Button>
                  <Button variant="ghost" className="text-destructive" onClick={() => setCancelOpen(true)} data-cy="cancel-order">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {order.status === "awaiting_confirmation" ? (
            <div className="space-y-2">
              <p className="rounded-lg bg-info/10 p-3 text-sm" data-cy="awaiting-confirmation">We're checking your transfer. The kitchen starts as soon as it is confirmed.</p>
              {/* Forgot the receipt? It can still be added (or replaced) while we're checking. */}
              <input ref={lateFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = acceptReceipt(e.target.files?.[0]); if (f) sendClaim(f, payment?.proofUrl ? "Receipt replaced" : "Thanks, we've added your receipt"); e.target.value = "" }} data-cy="late-receipt-input" />
              {payment?.proofUrl ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3 text-sm" data-cy="receipt-on-file">
                  <span className="inline-flex items-center gap-1.5 font-medium text-success"><Check className="size-4" /> Receipt received</span>
                  <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline" data-cy="view-receipt">View</a>
                  <Button variant="link" size="sm" className="h-auto p-0" loading={claimTransfer.isPending} onClick={() => lateFileRef.current?.click()} data-cy="replace-receipt">Replace</Button>
                </div>
              ) : (
                <Card className="border-warning/50" data-cy="add-receipt">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                    <p>Add your transfer receipt so we can confirm your payment faster.</p>
                    <Button variant="accent" loading={claimTransfer.isPending} onClick={() => lateFileRef.current?.click()} data-cy="add-receipt-button"><Upload /> Upload receipt</Button>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
          {order.deliveryCode ? (
            <Card className="border-primary/40 bg-primary/5" data-cy="delivery-code">
              <CardContent className="space-y-2 p-4 text-center sm:p-5">
                <p className="text-sm font-medium">Your delivery code</p>
                <p className="font-mono text-4xl font-bold tracking-[0.4em] pl-[0.4em]" aria-label={`Delivery code ${order.deliveryCode.split("").join(" ")}`} data-cy="delivery-code-value">{order.deliveryCode}</p>
                <p className="text-sm text-muted-foreground">Give this to the rider when your order arrives. It proves you received it, so please keep it to yourself until then.</p>
              </CardContent>
            </Card>
          ) : null}
          {order.cancelReason ? <p className="rounded-lg bg-destructive/10 p-3 text-sm"><span className="font-medium">Reason:</span> {order.cancelReason}</p> : null}

          <Card data-cy="order-items">
            <CardHeader className="flex-row items-baseline justify-between p-4 pb-1 sm:p-5 sm:pb-1">
              <CardTitle>Items</CardTitle>
              <span className="text-sm text-muted-foreground">{order.lines.reduce((n, l) => n + l.quantity, 0)} in total</span>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
              <ul className="divide-y">
                {order.lines.map((l, i) => (
                  <li key={l.id} className={cn("flex gap-3 py-2 text-sm", i >= LINES_SHOWN_ON_PHONE && !allLines && "hidden lg:flex")}>
                    <span className="w-7 shrink-0 font-medium">{l.quantity}×</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{l.itemName}</p>
                      {l.options.length > 0 ? <p className="text-muted-foreground">{l.options.map((o) => o.name).join(", ")}</p> : null}
                      {l.note ? <p className="italic text-muted-foreground">“{l.note}”</p> : null}
                    </div>
                    <Money value={l.lineTotal} fmt={fmt} />
                  </li>
                ))}
              </ul>
              {hiddenLines > 0 ? (
                <button type="button" className="mb-1 flex w-full items-center justify-center gap-1 border-t py-2 text-sm font-medium text-primary lg:hidden" aria-expanded={allLines} onClick={() => setAllLines((v) => !v)} data-cy="toggle-lines">
                  {allLines ? "Show fewer items" : `Show ${hiddenLines} more item${hiddenLines === 1 ? "" : "s"}`}
                  <ChevronDown className={cn("size-4 transition-transform", allLines && "rotate-180")} />
                </button>
              ) : null}
              <dl className="space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd><Money value={order.subtotal} fmt={fmt} /></dd></div>
                {order.fulfilment === "delivery" ? <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd><Money value={order.deliveryFee} fmt={fmt} /></dd></div> : null}
                {order.discount > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Discount {order.promoCode ? `(${order.promoCode})` : ""}</dt><dd>−<Money value={order.discount} fmt={fmt} /></dd></div> : null}
                <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd><Money value={order.total} fmt={fmt} /></dd></div>
              </dl>

              <ul className="mt-3 space-y-2 border-t pt-3 text-sm" data-cy="order-details">
                <li className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span><span className="text-muted-foreground">{order.deliveryAddress ? "Deliver to" : "Pick up at"}:</span> {order.deliveryAddress ? order.deliveryAddress.line : order.branch.address}</span>
                </li>
                {order.scheduledFor ? (
                  <li className="flex gap-2">
                    <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span><span className="text-muted-foreground">Scheduled for</span> {format(new Date(order.scheduledFor), "EEE d MMM, HH:mm")}</span>
                  </li>
                ) : null}
                {order.branch.phone ? (
                  <li className="flex gap-2">
                    <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span><span className="text-muted-foreground">Questions?</span> <a href={`tel:${order.branch.phone}`} className="text-primary hover:underline">Call {order.branch.name}</a></span>
                  </li>
                ) : null}
              </ul>

              <Button variant="outline" className="mt-4 w-full sm:w-auto" loading={reorder.isPending} onClick={() => reorder.mutate(order.id, { onSuccess: () => { toast.success("Added to a new bag"); open("cart"); navigate(`/${slug}/menu`) }, onError: (e) => toast.error(e.message) })} data-cy="reorder"><RefreshCw /> Reorder</Button>
            </CardContent>
          </Card>
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
          {showChat ? (
            <section data-cy="order-chat">
              <button type="button" className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card p-4 text-left shadow-sm lg:hidden" aria-expanded={chatOpen} onClick={() => setChatOpen((v) => !v)} data-cy="toggle-chat">
                <span className="flex items-center gap-2 font-display font-semibold"><MessageCircle className="size-4 text-primary" /> Message the branch</span>
                <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", chatOpen && "rotate-180")} />
              </button>
              {/* Mounted while folded so new messages keep arriving; keyed so the list re-pins to the newest one on open. */}
              <div className={cn("mt-2 lg:mt-0 lg:block", !chatOpen && "hidden")}>
                <ChatPanel key={chatOpen ? "open" : "folded"} kind="customer" slug={slug} orderId={order.id} className="h-72 lg:h-[26rem]" />
              </div>
            </section>
          ) : null}
          <HistoryCard events={order.events} />
        </aside>
      </div>

      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel this order?" description="Only unpaid orders can be cancelled here." confirmLabel="Cancel order" loading={cancel.isPending} onConfirm={async () => { await cancel.mutateAsync(order.id).catch((e) => toast.error(e.message)); setCancelOpen(false) }} />
    </div>
  )
}

/** Folded by default: the one-line summary is the latest step, and the full trail opens on demand. */
function HistoryCard({ events }: { events: OrderEvent[] }) {
  const [open, setOpen] = useState(false)
  const latest = events.reduce<OrderEvent | null>((a, e) => (!a || new Date(e.createdAt) > new Date(a.createdAt) ? e : a), null)
  return (
    <Card data-cy="order-history">
      <button type="button" className="flex w-full items-center gap-2 p-4 text-left" aria-expanded={open} aria-controls="order-history-body" onClick={() => setOpen((v) => !v)} data-cy="toggle-history">
        <HistoryIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-display font-semibold">History</span>
        {latest ? <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">{ORDER_STATUS_LABELS[latest.toStatus]} · {format(new Date(latest.createdAt), "d MMM, HH:mm")}</span> : <span className="flex-1" />}
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div id="order-history-body" className="border-t p-4"><StatusTimeline events={events} /></div> : null}
    </Card>
  )
}
