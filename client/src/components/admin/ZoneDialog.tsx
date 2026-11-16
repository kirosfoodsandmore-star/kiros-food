// Add or edit a delivery zone. Built for someone who has never set one up: every number carries its unit, the
// distance has one-tap choices, each field says what it does, and a plain sentence at the bottom reads back what
// customers in this zone will actually get.
import { Info, TriangleAlert } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AdornedInput } from "@/components/ui/adorned-input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { formatMoney, toMajor, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { DeliveryZone } from "@/types/admin.types"

export interface ZoneBody {
  name: string
  maxDistanceKm: number
  fee: number
  minOrder: number
  freeAboveAmount: number | null
  extraMinutes: number
  isActive: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The zone being edited; leave out to add a new one. */
  zone?: DeliveryZone
  /** The branch's other zones, for context and to catch two zones ending at the same distance. */
  others: DeliveryZone[]
  onSubmit: (body: ZoneBody) => Promise<unknown>
}

interface Form {
  distance: string
  name: string
  fee: string
  minOrder: string
  freeOn: boolean
  freeAbove: string
  extra: string
  isActive: boolean
}

const DISTANCE_CHOICES = [2, 5, 10, 15, 20]
const EXTRA_CHOICES = [0, 10, 20, 30]

const blank: Form = { distance: "", name: "", fee: "0", minOrder: "0", freeOn: false, freeAbove: "", extra: "0", isActive: true }

const fromZone = (z: DeliveryZone): Form => ({
  distance: String(z.maxDistanceKm),
  name: z.name,
  fee: toMajor(z.fee),
  minOrder: toMajor(z.minOrder),
  freeOn: z.freeAboveAmount !== null,
  freeAbove: z.freeAboveAmount !== null ? toMajor(z.freeAboveAmount) : "",
  extra: String(z.extraMinutes),
  isActive: z.isActive,
})

/** Typed text to a number; blank is NaN so callers decide what blank means. Commas are ignored. */
const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(/,/g, "")))
/** An amount box: blank counts as 0. */
const amount = (s: string) => (s.trim() === "" ? 0 : num(s))

const autoName = (distance: string) => {
  const km = num(distance)
  return Number.isFinite(km) && km > 0 ? `Within ${km} km` : ""
}

type Errors = Partial<Record<"distance" | "name" | "fee" | "minOrder" | "freeAbove" | "extra", string>>

function validate(f: Form): Errors {
  const e: Errors = {}
  const km = num(f.distance)
  if (!(km >= 0.1 && km <= 200)) e.distance = "Enter a distance between 0.1 and 200 km."
  if (!f.name.trim()) e.name = "Give the zone a name."
  else if (f.name.trim().length > 80) e.name = "Keep the name under 80 characters."
  if (!(amount(f.fee) >= 0)) e.fee = "Enter an amount, or 0 for free delivery."
  if (!(amount(f.minOrder) >= 0)) e.minOrder = "Enter an amount, or 0 for no minimum."
  if (f.freeOn && !(num(f.freeAbove) > 0)) e.freeAbove = "Enter the order amount that unlocks free delivery."
  const extra = num(f.extra)
  if (f.extra.trim() !== "" && !(Number.isInteger(extra) && extra >= 0 && extra <= 180)) e.extra = "Enter whole minutes, from 0 to 180."
  return e
}

function Choices<T extends number>({ options, value, onPick, label }: { options: readonly T[]; value: number; onPick: (v: T) => void; label: (v: T) => string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          aria-pressed={value === o}
          className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", value === o ? "border-primary bg-primary/10 text-primary" : "border-input bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground")}
        >
          {label(o)}
        </button>
      ))}
    </div>
  )
}

export function ZoneDialog({ open, onOpenChange, zone, others, onSubmit }: Props) {
  const fmt = useAdminCurrency()
  const [form, setForm] = useState<Form>(blank)
  // While the name is still the one we suggested, it follows the distance. Once typed over, it's theirs.
  const [nameTouched, setNameTouched] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const freeAboveRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setForm(zone ? fromZone(zone) : blank)
    setNameTouched(Boolean(zone))
    setShowErrors(false)
  }, [open, zone])

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))
  const setDistance = (distance: string) => setForm((f) => ({ ...f, distance, name: nameTouched ? f.name : autoName(distance) }))

  const errors = validate(form)
  const km = num(form.distance)
  const clash = Number.isFinite(km) ? others.find((z) => z.maxDistanceKm === km) : undefined
  const symbol = fmt.currencySymbol

  const submit = async () => {
    setShowErrors(true)
    if (Object.keys(errors).length > 0) return
    setBusy(true)
    try {
      await onSubmit({
        name: form.name.trim(),
        maxDistanceKm: km,
        fee: toMinor(amount(form.fee)),
        minOrder: toMinor(amount(form.minOrder)),
        freeAboveAmount: form.freeOn ? toMinor(num(form.freeAbove)) : null,
        extraMinutes: form.extra.trim() === "" ? 0 : num(form.extra),
        isActive: form.isActive,
      })
      toast.success("Saved")
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const err = (k: keyof Errors) => (showErrors ? errors[k] : undefined)
  const money = (v: string) => formatMoney(toMinor(amount(v)), fmt)
  const extra = form.extra.trim() === "" ? 0 : num(form.extra)

  // The same facts as the form, as a sentence a customer-facing person would say.
  const summary = [
    Number.isFinite(km) && km > 0 ? `Customers up to ${km} km from this branch` : "Customers in this zone",
    amount(form.fee) > 0 ? `pay ${money(form.fee)} for delivery` : "get delivery at no charge",
  ].join(" ") + "."
  const details = [
    amount(form.minOrder) > 0 ? `They need to order at least ${money(form.minOrder)}.` : "There's no minimum order.",
    form.freeOn && num(form.freeAbove) > 0 && amount(form.fee) > 0 ? `Orders of ${money(form.freeAbove)} or more get free delivery.` : null,
    extra > 0 ? `Allow about ${extra} extra minutes on top of the usual prep time.` : null,
    !form.isActive ? "This zone is switched off, so it isn't being used right now." : null,
  ].filter(Boolean)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-cy="zone-dialog">
        <DialogHeader>
          <DialogTitle>{zone ? "Edit delivery zone" : "New delivery zone"}</DialogTitle>
          <DialogDescription>Choose how far this branch delivers and what customers in that area pay.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
          <Field label="How far do you deliver?" error={err("distance")} hint="Measured in a straight line from the branch's map pin.">
            <div className="space-y-2">
              <AdornedInput inputMode="decimal" value={form.distance} onChange={(e) => setDistance(e.target.value)} trailing="km" placeholder="e.g. 5" autoFocus data-cy="zone-distance" />
              <Choices options={DISTANCE_CHOICES} value={km} onPick={(v) => setDistance(String(v))} label={(v) => `${v} km`} />
              {clash ? (
                <p className="flex items-start gap-1.5 text-xs text-warning" role="status">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> You already have a zone ("{clash.name}") that ends at {clash.maxDistanceKm} km. Pick a different distance so each zone covers its own ring.
                </p>
              ) : others.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Already set up: {[...others].sort((a, b) => a.maxDistanceKm - b.maxDistanceKm).map((z) => `up to ${z.maxDistanceKm} km`).join(", ")}. Each customer gets the smallest zone that covers them.
                </p>
              ) : null}
            </div>
          </Field>

          <Field label="Zone name" error={err("name")} hint="Customers see this at checkout, for example “Within 5 km” or “Island”.">
            <Input value={form.name} onChange={(e) => { setNameTouched(true); set({ name: e.target.value }) }} placeholder="e.g. Within 5 km" data-cy="zone-name" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Delivery fee" error={err("fee")} hint="Use 0 for free delivery.">
              <AdornedInput inputMode="decimal" leading={symbol} value={form.fee} onChange={(e) => set({ fee: e.target.value })} data-cy="zone-fee" />
            </Field>
            <Field label="Minimum order" error={err("minOrder")} hint="Use 0 for no minimum.">
              <AdornedInput inputMode="decimal" leading={symbol} value={form.minOrder} onChange={(e) => set({ minOrder: e.target.value })} data-cy="zone-min-order" />
            </Field>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={form.freeOn} onCheckedChange={(v) => { set({ freeOn: v }); if (v) setTimeout(() => freeAboveRef.current?.focus(), 0) }} data-cy="zone-free-on" />
              Free delivery on bigger orders
            </label>
            {form.freeOn ? (
              <Field label="Orders of at least" error={err("freeAbove")} hint="Once an order reaches this amount, the delivery fee is waived.">
                <AdornedInput inputMode="decimal" leading={symbol} value={form.freeAbove} onChange={(e) => set({ freeAbove: e.target.value })} placeholder="e.g. 10000" ref={freeAboveRef} data-cy="zone-free-above" />
              </Field>
            ) : null}
          </div>

          <Field label="Extra delivery time" error={err("extra")} hint="Added to the branch's prep time, for far-out areas or heavy traffic.">
            <div className="space-y-2">
              <AdornedInput inputMode="numeric" value={form.extra} onChange={(e) => set({ extra: e.target.value })} trailing="min" data-cy="zone-extra" />
              <Choices options={EXTRA_CHOICES} value={extra} onPick={(v) => set({ extra: String(v) })} label={(v) => (v === 0 ? "None" : `+${v} min`)} />
            </div>
          </Field>

          <label className="flex items-center gap-3 text-sm">
            <Switch checked={form.isActive} onCheckedChange={(v) => set({ isActive: v })} data-cy="zone-active" />
            Active (customers can order delivery to this zone)
          </label>

          <div className="flex gap-2.5 rounded-lg bg-muted/60 p-3 text-sm" data-cy="zone-summary">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p>
              <span className="font-medium">{summary}</span> {details.join(" ")}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={busy} data-cy="zone-save">{zone ? "Save changes" : "Add zone"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
