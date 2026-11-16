// The cart drawer holds the whole checkout form: lines with availability warnings, fulfilment,
// address, phone, time, promo, totals, and the state-driven primary button.
import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Bike, ShoppingBag, Store as StoreIcon, Tag, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Money } from "@/components/shared/Money"
import { QuantityStepper } from "@/components/shared/QuantityStepper"
import { EmptyState } from "@/components/shared/States"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Field } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useCustomer } from "@/contexts/CustomerContext"
import { useStore } from "@/contexts/StoreContext"
import { useCart } from "@/hooks/useCart"
import { ORDERS_KEY } from "@/hooks/useCustomerOrders"
import { STORE_KEY, usePaymentMethods, useSlots, useStoreBranches } from "@/hooks/useStore"
import { useDebounce } from "@/hooks/useDebounce"
import { StoreEndpoints } from "@/endpoints/store.endpoints"
import { isE164 } from "@/lib/phone"
import { email as emailSchema } from "@/lib/validation"
import { ApiError, unwrap } from "@/transport/http"
import { useStoreSession } from "@/stores/storeSession"
import type { CartLine, DeliveryAddress, PaymentMethod } from "@/types/store.types"
import { AddressPicker } from "./AddressPicker"
import { SlotPicker } from "./SlotPicker"

export function CartDrawer() {
  const { slug, fmt } = useStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { overlay, close, open, branchId } = useStoreSession()
  const { session, isSignedIn, checking, startGuest } = useCustomer()
  const { cart, isLoading, updateLine, removeLine, clear, update, applyPromo, removePromo, setFulfilment, reset } = useCart()
  const { data: branches } = useStoreBranches(slug)
  const branch = branches?.find((b) => b.id === branchId)
  const isOpen = overlay === "cart"

  const [promo, setPromo] = useState("")
  const [phone, setPhone] = useState(cart?.phone ?? "")
  const [address, setAddress] = useState<DeliveryAddress | null>(cart?.deliveryAddress ?? null)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [placing, setPlacing] = useState(false)
  // Checking out without an account: who the order is for, and an optional email for the receipt.
  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")

  useEffect(() => {
    if (cart) {
      setPhone(cart.phone ?? session?.customer.phone ?? "")
      setAddress(cart.deliveryAddress)
    }
  }, [cart?.id, cart?.phone, cart?.deliveryAddress, session?.customer.phone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced sync of phone / address edits to the server-side cart.
  const debouncedPhone = useDebounce(phone, 600)
  const debouncedAddress = useDebounce(address, 600)
  useEffect(() => {
    if (!cart || !isOpen) return
    const patch: Record<string, unknown> = {}
    if (isE164(debouncedPhone) && debouncedPhone !== (cart.phone ?? "")) patch.phone = debouncedPhone
    const a = debouncedAddress
    if (a && (a.line !== cart.deliveryAddress?.line || a.lat !== cart.deliveryAddress?.lat || a.lng !== cart.deliveryAddress?.lng || (a.instructions ?? "") !== (cart.deliveryAddress?.instructions ?? ""))) patch.deliveryAddress = a
    if (Object.keys(patch).length > 0) update.mutate(patch)
  }, [debouncedPhone, debouncedAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  const at = address?.lat != null && address.lng != null ? { lat: address.lat, lng: address.lng } : null
  const { data: slots, isLoading: slotsLoading } = useSlots(slug, branchId, cart?.fulfilment ?? "delivery", cart?.fulfilment === "delivery" ? at : null, isOpen && Boolean(cart))
  const { data: paymentMethods } = usePaymentMethods(slug, branchId, isOpen && Boolean(cart))
  const methods = paymentMethods?.methods ?? []
  useEffect(() => {
    if (methods.length === 1) setMethod(methods[0])
    else if (method && !methods.includes(method)) setMethod(null)
  }, [methods, method])

  // The server also reports a missing phone number as a blocker. The contact form below already asks for it (and
  // the button says so), so it is left out here, otherwise it would disable the button before anyone has typed.
  const blockers = (cart?.blockers ?? []).filter((b) => !b.toLowerCase().includes("phone number"))
  const needsTime = blockers.some((b) => b.includes("choose a time") || b.includes("time slot"))
  const buttonLabel = useMemo(() => {
    if (checking) return "Checking your account…"
    if (!cart || cart.lines.length === 0) return "Your bag is empty"
    if (cart.warnings.length > 0) return "Review your bag"
    if (needsTime) return "Choose a time"
    if (blockers.length > 0) return blockers[0]
    if (!isSignedIn && !guestName.trim()) return "Add your name"
    if (!isE164(phone)) return "Add your phone number"
    if (methods.length > 1 && !method) return "Choose how to pay"
    return method === "transfer" ? "Pay by bank transfer" : "Pay now"
  }, [checking, cart, needsTime, blockers, isSignedIn, guestName, phone, methods.length, method])
  // The button stays pressable while contact details are missing: pressing it takes you to the empty field.
  const blocked = !cart || cart.lines.length === 0 || blockers.length > 0 || checking
  const contactMissing = !isE164(phone) || (!isSignedIn && !guestName.trim())
  const canPay = !blocked && !contactMissing && (methods.length <= 1 || Boolean(method))
  const focusField = (cy: string) => window.setTimeout(() => document.querySelector<HTMLElement>(`[data-cy=${cy}]`)?.focus(), 50)

  const place = async () => {
    if (!cart) return
    if (!isSignedIn && !guestName.trim()) {
      toast.error("Add your name so the branch knows who the order is for")
      return focusField("cart-guest-name")
    }
    if (!isE164(phone)) {
      toast.error("Add a phone number the branch can reach you on")
      return focusField("cart-phone")
    }
    let email = session?.customer.email ?? undefined
    if (!isSignedIn && guestEmail.trim()) {
      const parsed = emailSchema.safeParse(guestEmail)
      if (!parsed.success) {
        toast.error("That email address doesn't look right")
        return focusField("cart-guest-email")
      }
      email = parsed.data
    }
    const chosen = method ?? methods[0]
    if (!chosen) return toast.error(methods.length > 1 ? "Choose how you'd like to pay" : "No payment method is available at this branch")
    const { cartToken } = useStoreSession.getState()
    if (!cartToken) return
    setPlacing(true)
    try {
      // The contact number lives on the bag: make sure the server has the latest before paying.
      if (phone !== (cart.phone ?? "")) await update.mutateAsync({ phone })
      let name = session?.customer.name ?? undefined
      if (!isSignedIn) {
        // No account needed: this starts an anonymous session so this browser can pay for, track and chat about the order.
        const guest = await startGuest(guestName.trim(), email)
        name = guest.customer.name ?? undefined
        email = guest.customer.email ?? undefined
      }
      const result = unwrap(await StoreEndpoints.checkout(slug, cartToken, { cartId: cart.id, paymentMethod: chosen, name, email }))
      reset()
      close()
      // So the new order shows up in the bar under the header straight away.
      void qc.invalidateQueries({ queryKey: [STORE_KEY, slug, ORDERS_KEY] })
      if (result.payment.method === "paystack") {
        window.location.assign(result.payment.authorizationUrl)
        return
      }
      navigate(`/${slug}/orders/${result.order.id}`)
    } catch (err) {
      const e = err as ApiError
      toast.error(e.message)
      if (e.errors?.length) e.errors.slice(0, 3).forEach((x) => toast.message(x.message))
    } finally {
      setPlacing(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(o) => (o ? open("cart") : close())}>
      <SheetContent side="right" className="p-0" data-cy="cart-drawer">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5" /> Your bag
          </SheetTitle>
          {cart ? (
            <p className="text-sm text-muted-foreground">
              From {cart.branchName}
              <button type="button" className="ml-2 text-primary underline-offset-2 hover:underline" onClick={() => open("branch")} data-cy="cart-change-branch">
                Change branch
              </button>
            </p>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading your bag…</p>
          ) : !cart || cart.lines.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Your bag is empty" description="Browse the menu and add something you fancy." icon={<ShoppingBag className="size-8" />} action={<Button onClick={() => { close(); navigate(`/${slug}/menu`) }} data-cy="cart-browse">Browse the menu</Button>} />
            </div>
          ) : (
            <div className="space-y-5 p-4">
              <ul className="space-y-3" data-cy="cart-lines">
                {cart.lines.map((l) => (
                  <CartLineRow key={l.id} line={l} slug={slug} onQty={(q) => (q <= 0 ? removeLine.mutate(l.id) : updateLine.mutate({ lineId: l.id, quantity: q }))} onRemove={() => removeLine.mutate(l.id)} fmt={fmt} onClose={close} />
                ))}
              </ul>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setClearOpen(true)} data-cy="cart-clear">
                <Trash2 /> Clear bag
              </Button>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Delivery or pickup</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(["delivery", "pickup"] as const).map((f) => {
                    const enabled = f === "delivery" ? cart.branch.deliveryEnabled : cart.branch.pickupEnabled
                    return (
                      <button key={f} type="button" disabled={!enabled} onClick={() => setFulfilment.mutate(f)} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50 ${cart.fulfilment === f ? "border-primary bg-secondary/50" : ""}`} data-cy={`fulfilment-${f}`}>
                        {f === "delivery" ? <Bike className="size-4" /> : <StoreIcon className="size-4" />}
                        {f === "delivery" ? "Delivery" : "Pickup"}
                      </button>
                    )
                  })}
                </div>
                {cart.fulfilment === "delivery" ? (
                  <AddressPicker value={address} onChange={setAddress} saved={session?.addresses} branch={branch} />
                ) : (
                  <p className="rounded-lg bg-muted/60 p-3 text-sm">
                    <span className="font-medium">{branch?.name}</span>
                    <br />
                    <span className="text-muted-foreground">{branch?.address}</span>
                  </p>
                )}
                {cart.delivery && cart.fulfilment === "delivery" ? (
                  <p className="text-xs text-muted-foreground" data-cy="delivery-quote">
                    {cart.delivery.deliverable ? `${cart.delivery.zoneName} · ${cart.delivery.distanceKm} km · fee ` : cart.delivery.reason}
                    {cart.delivery.deliverable ? <Money value={cart.delivery.fee} fmt={fmt} /> : null}
                    {cart.delivery.deliverable && cart.delivery.minOrder > 0 ? <> · min. order <Money value={cart.delivery.minOrder} fmt={fmt} /></> : null}
                  </p>
                ) : null}
              </section>

              <section className="space-y-3" data-cy="cart-contact">
                <h3 className="text-sm font-semibold">{isSignedIn ? "Contact number" : "Your details"}</h3>
                {!isSignedIn ? (
                  <Field label="Name">
                    <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} autoComplete="name" placeholder="Your name" data-cy="cart-guest-name" />
                  </Field>
                ) : null}
                <Field label="Phone number" hint="So the branch can reach you about your order.">
                  <PhoneInput value={phone} onChange={setPhone} data-cy="cart-phone" />
                </Field>
                {!isSignedIn ? (
                  <>
                    <Field label="Email (optional)" hint="For your receipt.">
                      <Input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" data-cy="cart-guest-email" />
                    </Field>
                    <p className="text-xs text-muted-foreground">No account needed to order.</p>
                  </>
                ) : null}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">When</h3>
                <SlotPicker slots={slots} value={cart.scheduledFor} onChange={(iso) => update.mutate({ scheduledFor: iso })} loading={slotsLoading} />
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Promo code</h3>
                {cart.promoCode ? (
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" data-cy="promo-applied">
                    <span className="flex items-center gap-2">
                      <Tag className="size-4 text-primary" /> {cart.promoCode}
                      {!cart.promo.applied ? <span className="text-xs text-destructive">{cart.promo.reason}</span> : null}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => removePromo.mutate()} data-cy="promo-remove">
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="Enter a code" data-cy="promo-input" />
                    <Button variant="outline" disabled={!promo} loading={applyPromo.isPending} onClick={() => applyPromo.mutate(promo, { onSuccess: () => setPromo(""), onError: (e) => toast.error(e.message) })} data-cy="promo-apply">
                      Apply
                    </Button>
                  </div>
                )}
              </section>

              {methods.length > 1 ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">How would you like to pay?</h3>
                  <RadioGroup value={method ?? ""} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                    {methods.map((m) => (
                      <label key={m} className="flex items-center gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-primary" data-cy={`pay-${m}`}>
                        <RadioGroupItem value={m} />
                        <span className="flex-1">{m === "paystack" ? "Card, transfer or USSD (Paystack)" : "Bank transfer"}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </section>
              ) : null}

              <dl className="space-y-1 text-sm" data-cy="cart-totals">
                <Row label="Subtotal" value={<Money value={cart.subtotal} fmt={fmt} />} />
                {cart.fulfilment === "delivery" ? <Row label="Delivery fee" value={<Money value={cart.deliveryFee} fmt={fmt} />} /> : null}
                {cart.discount > 0 ? <Row label="Discount" value={<>−<Money value={cart.discount} fmt={fmt} /></>} /> : null}
                <Row label={<span className="font-semibold">Total</span>} value={<Money value={cart.total} fmt={fmt} className="font-display text-base font-semibold" />} />
              </dl>
              {blockers.length > 0 ? (
                <ul className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm" data-cy="cart-blockers">
                  {blockers.map((b) => (
                    <li key={b} className="flex gap-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /> {b}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>

        {cart && cart.lines.length > 0 ? (
          <div className="border-t p-4 safe-bottom">
            <Button className="w-full" size="lg" variant={canPay ? "accent" : "default"} disabled={blocked} loading={placing || update.isPending} onClick={place} data-cy="cart-primary">
              {buttonLabel}
              {canPay ? <span className="ml-1">· <Money value={cart.total} fmt={fmt} /></span> : null}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">Prices are confirmed by the branch at checkout.</p>
          </div>
        ) : null}
        <ConfirmDialog open={clearOpen} onOpenChange={setClearOpen} title="Clear your bag?" description="Everything in your bag will be removed." confirmLabel="Clear" loading={clear.isPending} onConfirm={async () => { await clear.mutateAsync(); setClearOpen(false) }} />
      </SheetContent>
    </Sheet>
  )
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function CartLineRow({ line, slug, onQty, onRemove, fmt, onClose }: { line: CartLine; slug: string; onQty: (q: number) => void; onRemove: () => void; fmt: { currencySymbol: string; currencyDecimals: number }; onClose: () => void }) {
  const navigate = useNavigate()
  const warn = line.warnings[0]
  return (
    <li className={`rounded-xl border p-3 ${warn ? "border-warning/60 bg-warning/5" : ""}`} data-cy={`cart-line-${line.id}`}>
      <div className="flex gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">{line.imageUrl ? <img src={line.imageUrl} alt="" className="size-full object-cover" /> : null}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{line.categoryName}</p>
          <p className="font-medium leading-snug">{line.itemName}</p>
          {line.optionSummary ? <p className="truncate text-xs text-muted-foreground">{line.optionSummary}</p> : null}
          {line.note ? <p className="truncate text-xs italic text-muted-foreground">“{line.note}”</p> : null}
          <div className="mt-2 flex items-center justify-between">
            <QuantityStepper value={line.quantity} onChange={onQty} size="sm" removeAtMin />
            <Money value={line.lineTotal} fmt={fmt} className="font-medium" />
          </div>
        </div>
      </div>
      {warn ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" data-cy="line-warning">
          <AlertTriangle className="size-4 text-warning" />
          <span className="flex-1">{warn.message}</span>
          {warn.canChangeOption && line.itemId ? (
            <Button size="sm" variant="outline" onClick={() => { onClose(); navigate(`/${slug}/item/${line.itemId}?line=${line.id}`) }} data-cy="line-change-option">
              Change an option
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onRemove} data-cy="line-remove">
            Remove item
          </Button>
        </div>
      ) : null}
    </li>
  )
}
