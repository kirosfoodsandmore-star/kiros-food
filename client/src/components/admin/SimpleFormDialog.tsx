// A small schema-driven form dialog for simple create/edit records (menus, categories, zones, roles…).
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { LocationPicker } from "@/components/shared/LocationPicker"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toMajor, toMinor } from "@/lib/money"
import { phone as phoneRule } from "@/lib/validation"

export interface FieldDef {
  name: string
  label: string
  /**
   * "location" renders an address search + map pin instead of an input. It reads and writes the form's own
   * `lat`, `lng`, `address` and `city` fields (declare lat/lng with `hidden: true`), so the form never shows raw coordinates.
   */
  /** "phone" is a country-code picker plus a local number; the value is saved in international format (+2348012345678). */
  type: "text" | "textarea" | "number" | "money" | "switch" | "select" | "date" | "datetime" | "time" | "password" | "location" | "phone"
  required?: boolean
  options?: Array<{ value: string; label: string }>
  default?: unknown
  hint?: string
  placeholder?: string
  hideWhen?: "edit" | "create"
  /** Kept in the form's values and submitted, but not shown (something else fills it in). */
  hidden?: boolean
  /** Share a row with the next half-width field (on screens wide enough for two columns). */
  half?: boolean
}

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  fields: FieldDef[]
  initial?: Record<string, unknown>
  onSubmit: (values: Record<string, unknown>) => Promise<unknown>
  submitLabel?: string
}

function initialValue(f: FieldDef, initial?: Record<string, unknown>): unknown {
  const v = initial?.[f.name]
  if (v === undefined || v === null) return f.default ?? (f.type === "switch" ? false : "")
  if (f.type === "money") return toMajor(Number(v))
  if (f.type === "datetime" && typeof v === "string") return v.slice(0, 16)
  return v
}

export function SimpleFormDialog({ open, onOpenChange, title, fields, initial, onSubmit, submitLabel }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState(false)
  const editing = Boolean(initial)
  useEffect(() => {
    if (open) setValues(Object.fromEntries(fields.map((f) => [f.name, initialValue(f, initial)])))
  }, [open, fields, initial])
  const visible = fields.filter((f) => !(f.hideWhen === "edit" && editing) && !(f.hideWhen === "create" && !editing))

  const submit = async () => {
    for (const f of visible) if (f.required && (values[f.name] === "" || values[f.name] === undefined)) return toast.error(`${f.label} is required`)
    for (const f of visible) if (f.type === "phone" && values[f.name] && !phoneRule.safeParse(values[f.name]).success) return toast.error(`${f.label} looks incomplete. Check the country code and number.`)
    const out: Record<string, unknown> = {}
    for (const f of visible) {
      const v = values[f.name]
      if (f.type === "location") continue // its lat/lng/address/city fields carry the data
      if (f.type === "money") out[f.name] = v === "" ? null : toMinor(String(v))
      else if (f.type === "number") out[f.name] = v === "" ? null : Number(v)
      else if (f.type === "datetime") out[f.name] = v ? new Date(String(v)).toISOString() : null
      else if (f.type === "select" && v === "__none") out[f.name] = null
      else out[f.name] = v === "" ? null : v
    }
    setBusy(true)
    try {
      await onSubmit(out)
      onOpenChange(false)
      toast.success("Saved")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Several fields at once (the location picker fills in lat, lng, address and city). Undefined means "leave as is", null clears.
  const patch = (p: object) =>
    setValues((s) => ({ ...s, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v ?? ""])) }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-cy="form-dialog"
        // Escape closes an open suggestion list first, not the whole dialog.
        onEscapeKeyDown={(e) => { if (document.activeElement?.getAttribute("aria-expanded") === "true") e.preventDefault() }}
      >
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visible.filter((f) => !f.hidden).map((f) => {
              const v = values[f.name]
              const set = (val: unknown) => setValues((s) => ({ ...s, [f.name]: val }))
              const cy = `field-${f.name}`
              return (
                <Field key={f.name} label={f.type === "switch" ? undefined : f.label} hint={f.hint} className={f.half ? undefined : "sm:col-span-2"}>
                  {f.type === "location" ? <LocationPicker lat={values.lat} lng={values.lng} address={String(values.address ?? "")} city={String(values.city ?? "")} onChange={patch} /> : null}
                  {f.type === "phone" ? <PhoneInput value={String(v ?? "")} onChange={set} placeholder={f.placeholder} data-cy={cy} /> : null}
                  {f.type === "textarea" ? <Textarea value={String(v ?? "")} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} data-cy={cy} /> : null}
                  {f.type === "switch" ? <label className="flex items-center gap-3 text-sm"><Switch checked={Boolean(v)} onCheckedChange={set} data-cy={cy} /> {f.label}</label> : null}
                  {f.type === "select" ? (
                    <Select value={v === null || v === "" ? "__none" : String(v)} onValueChange={set}>
                      <SelectTrigger data-cy={cy}><SelectValue placeholder={f.placeholder ?? "Choose"} /></SelectTrigger>
                      <SelectContent>{!f.required ? <SelectItem value="__none">—</SelectItem> : null}{(f.options ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : null}
                  {["text", "number", "money", "date", "datetime", "time", "password"].includes(f.type) ? (
                    <Input type={f.type === "money" ? "text" : f.type === "datetime" ? "datetime-local" : f.type} inputMode={f.type === "money" || f.type === "number" ? "decimal" : undefined} value={String(v ?? "")} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} data-cy={cy} />
                  ) : null}
                </Field>
              )
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={busy} data-cy="form-submit">{submitLabel ?? "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
