// The rider's screen: what's been assigned to them, where it's going, and the two buttons that matter
// (picked up, delivered). Closest-to-done first, so the next stop is always at the top.
import { Check, MapPin, Navigation, Phone, X } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/PageHeader"
import { AnswerClock } from "@/components/rider/AnswerClock"
import { DeclineDialog } from "@/components/rider/DeclineDialog"
import { DeliveryCodeDialog } from "@/components/rider/DeliveryCodeDialog"
import { OnDutySwitch } from "@/components/rider/OnDutySwitch"
import { PushPrompt } from "@/components/rider/PushPrompt"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { EmptyState } from "@/components/shared/States"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { useLiveOrderInvalidation, useMyDeliveries, useOrderMutations } from "@/hooks/useAdminOrders"
import { useAdminCurrency } from "@/hooks/useFormatters"
import type { RiderDelivery } from "@/types/admin.types"
import type { OrderStatus } from "@/types/store.types"

/** Given to this rider but not answered yet. Older assignments have no answer on record and count as accepted. */
const awaitingAnswer = (d: RiderDelivery) => d.riderResponse === "pending"

const GROUPS: Array<{ key: string; title: string; hint?: string; match: (d: RiderDelivery) => boolean }> = [
  { key: "pending", title: "Needs your answer", hint: "Accept to take it, or give it back if you can't.", match: awaitingAnswer },
  { key: "out_for_delivery", title: "On the way", match: (d) => !awaitingAnswer(d) && d.status === "out_for_delivery" },
  { key: "ready", title: "Ready to pick up", match: (d) => !awaitingAnswer(d) && d.status === "ready" },
  { key: "preparing", title: "Being prepared", hint: "Coming up. You can pick these up once the kitchen marks them ready.", match: (d) => !awaitingAnswer(d) && ["paid", "accepted", "preparing"].includes(d.status) },
]

/** Opens the maps app on a phone (or Google Maps in a browser), aimed at the pin if there is one, otherwise at the typed address. */
function directionsUrl(d: RiderDelivery): string | null {
  const a = d.deliveryAddress
  if (!a) return null
  const destination = a.lat !== null && a.lng !== null ? `${a.lat},${a.lng}` : a.line
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

/** `inPortal`: shown inside the rider portal, where order numbers aren't links, so riders are never sent into the admin screens. */
export default function DeliveriesPage({ inPortal = false }: { inPortal?: boolean }) {
  const fmt = useAdminCurrency()
  const { can } = useAuth()
  useLiveOrderInvalidation()
  const { data, isLoading, refetch } = useMyDeliveries()
  const { changeStatus, respond } = useOrderMutations()
  const [declining, setDeclining] = useState<{ id: string; number: string } | null>(null)
  const [codingId, setCodingId] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  if (isLoading) return <PageLoader />

  const go = (id: string, status: OrderStatus) => changeStatus.mutate({ id, status }, { onError: (e) => toast.error(e.message) })
  const busy = (id: string) => (changeStatus.isPending && changeStatus.variables?.id === id) || (respond.isPending && respond.variables?.id === id)
  const accept = (o: RiderDelivery) => respond.mutate({ id: o.id, action: "accept" }, { onSuccess: () => toast.success(`You've got ${o.number}`), onError: (e) => toast.error(e.message) })
  const giveBack = (reason: string) => {
    if (!declining) return
    respond.mutate({ id: declining.id, action: "decline", reason }, { onSuccess: () => { toast.success(`${declining.number} went back to the manager`); setDeclining(null) }, onError: (e) => toast.error(e.message) })
  }
  // Finishing a delivery the customer holds a code for asks for that code first.
  const finish = (o: RiderDelivery) => {
    if (o.needsCode) { setCodeError(null); setCodingId(o.id) } else go(o.id, "completed")
  }
  const submitCode = (code: string) => {
    if (!codingId) return
    changeStatus.mutate(
      { id: codingId, status: "completed", code },
      { onSuccess: () => { toast.success("Delivered. Thank you!"); setCodingId(null) }, onError: (e) => { setCodeError(e.message); void refetch() } }
    )
  }
  const coding = data?.find((d) => d.id === codingId) ?? null

  return (
    <div data-cy="deliveries-page">
      <PageHeader title="My deliveries" description="Orders assigned to you. New ones appear here the moment a manager gives them to you." />
      <OnDutySwitch />
      <PushPrompt />
      {!data || data.length === 0 ? <EmptyState title="Nothing assigned to you right now" /> : (
        <div className="space-y-6">
          {GROUPS.map((g) => {
            const rows = data.filter(g.match)
            if (rows.length === 0) return null
            return (
              <section key={g.key} data-cy={`deliveries-${g.key}`}>
                <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                  {g.title} <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{rows.length}</span>
                </h2>
                {g.hint ? <p className="-mt-1 mb-2 text-xs text-muted-foreground">{g.hint}</p> : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  {rows.map((o) => {
                    const directions = directionsUrl(o)
                    return (
                      <Card key={o.id} data-cy={`delivery-${o.id}`}>
                        <CardContent className="space-y-3 pt-5 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            {inPortal || !can("orders.view") ? <span className="font-semibold">{o.number}</span> : <Link to={`/admin/orders/${o.id}`} className="font-semibold hover:underline">{o.number}</Link>}
                            <StatusBadge status={o.status} />
                          </div>

                          <div className="flex gap-2" data-cy="delivery-address">
                            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                            <div className="min-w-0">
                              <p className="text-base font-medium leading-snug">{o.deliveryAddress?.line ?? "No address on this order"}</p>
                              {o.deliveryAddress?.instructions ? <p className="mt-0.5 text-accent">“{o.deliveryAddress.instructions}”</p> : null}
                            </div>
                          </div>
                          {o.note ? <p className="rounded-lg bg-accent/10 p-2"><span className="font-medium">Order note:</span> {o.note}</p> : null}

                          <p className="text-muted-foreground">
                            {o.customerName ?? "Customer"} · {o.branchName} · <Money value={o.total} fmt={fmt} />
                          </p>

                          <div className="flex gap-2">
                            {directions ? (
                              <Button variant="outline" size="sm" className="flex-1" asChild>
                                <a href={directions} target="_blank" rel="noreferrer" data-cy="delivery-directions"><Navigation /> Directions</a>
                              </Button>
                            ) : null}
                            <Button variant="outline" size="sm" className="flex-1" asChild>
                              <a href={`tel:${o.customerPhone}`} data-cy="delivery-call"><Phone /> Call {o.customerPhone}</a>
                            </Button>
                          </div>

                          {awaitingAnswer(o) ? <AnswerClock answerBy={o.answerBy} /> : null}
                          {awaitingAnswer(o) ? (
                            <div className="grid grid-cols-2 gap-2" data-cy="delivery-answer">
                              <Button onClick={() => accept(o)} loading={respond.isPending && respond.variables?.id === o.id && respond.variables.action === "accept"} disabled={busy(o.id)} data-cy="delivery-accept"><Check /> Accept</Button>
                              <Button variant="outline" onClick={() => setDeclining({ id: o.id, number: o.number })} disabled={busy(o.id)} data-cy="delivery-decline"><X /> Can't take it</Button>
                            </div>
                          ) : null}
                          {!awaitingAnswer(o) && o.status === "ready" ? <Button className="w-full" onClick={() => go(o.id, "out_for_delivery")} loading={busy(o.id)} data-cy="delivery-start">Picked up, on my way</Button> : null}
                          {!awaitingAnswer(o) && o.status === "out_for_delivery" ? <Button className="w-full" variant="accent" onClick={() => finish(o)} loading={busy(o.id) && !o.needsCode} data-cy="delivery-done">{o.needsCode ? "Enter customer's code" : "Mark delivered"}</Button> : null}
                          {!awaitingAnswer(o) && ["paid", "accepted", "preparing", "ready"].includes(o.status) ? (
                            <button type="button" className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setDeclining({ id: o.id, number: o.number })} data-cy="delivery-give-back">Can't make it? Give it back</button>
                          ) : null}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
      <DeclineDialog order={declining} busy={respond.isPending} onConfirm={giveBack} onOpenChange={(o) => !o && setDeclining(null)} />
      <DeliveryCodeDialog
        order={coding ? { id: coding.id, number: coding.number, attemptsLeft: coding.codeAttemptsLeft } : null}
        busy={changeStatus.isPending}
        error={codeError}
        onSubmit={submitCode}
        onOpenChange={(o) => !o && setCodingId(null)}
      />
    </div>
  )
}
