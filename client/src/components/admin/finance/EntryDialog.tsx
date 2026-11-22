// Record or edit one money movement: capital in, an expense, off-app income, or money taken out. One entry can be
// split between several vendors (or customers, investors…), each with their own amount; the total is their sum.
// An offline sale (walk-in, catering) can list the menu items sold, so what's selling can be tracked.
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { Plus, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Money } from "@/components/shared/Money"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { useBranches } from "@/hooks/useAdminBranches"
import { useFinanceCatalog, useFinanceMutations, useFinanceParties, useSaleMenu } from "@/hooks/useFinance"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { KIND_HINTS, KIND_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/finance"
import { formatMoney, toMajor, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { FinanceEntry, FinanceKind, PartyLineInput, SaleItemInput } from "@/types/finance.types"
import { ItemPicker } from "./ItemPicker"
import { PartyPicker } from "./PartyPicker"

const ALL_KINDS: FinanceKind[] = ["expense", "capital", "income", "withdrawal"]
const NONE = "__none"

/** What the people on an entry are called, per kind. */
const PARTY_WORDS: Record<FinanceKind, { label: string; one: string; many: string }> = {
  expense: { label: "Vendor / paid to", one: "vendor", many: "vendors" },
  income: { label: "Customer / client", one: "customer", many: "customers" },
  capital: { label: "From (investor, lender…)", one: "investor or lender", many: "investors / lenders" },
  withdrawal: { label: "Paid to", one: "person", many: "people" },
}

interface Line {
  key: number
  partyId?: string
  name: string
  amount: string
}

/** One item on a sale: quantity and price are kept as typed until saved. */
interface ItemLine {
  key: number
  itemId?: string
  name: string
  qty: string
  price: string
}

interface Draft {
  kind: FinanceKind
  category: string
  title: string
  amount: string
  entryDate: string
  branchId: string
  paymentMethod: string
  /** One line normally (its amount is the entry amount); several when split. */
  lines: Line[]
  split: boolean
  items: ItemLine[]
  reference: string
  notes: string
}

let nextKey = 1
const blankLine = (): Line => ({ key: nextKey++, name: "", amount: "" })
const blankItem = (): ItemLine => ({ key: nextKey++, name: "", qty: "1", price: "" })
const qtyOf = (l: ItemLine) => Math.max(0, Number.parseInt(l.qty, 10) || 0)
const lineTotal = (l: ItemLine) => qtyOf(l) * toMinor(l.price || "0")

function draftOf(entry: FinanceEntry | undefined, kind: FinanceKind, branchId: string, category: string): Draft {
  const lines: Line[] = entry?.parties.length
    ? entry.parties.map((p) => ({ key: nextKey++, partyId: p.partyId, name: p.name, amount: toMajor(p.amount) }))
    : entry?.party
      ? [{ key: nextKey++, name: entry.party, amount: toMajor(entry.amount) }]
      : [blankLine()]
  return {
    kind: entry?.kind ?? kind,
    category: entry?.category ?? category,
    title: entry?.title ?? "",
    amount: entry ? toMajor(entry.amount) : "",
    entryDate: entry?.entryDate ?? format(new Date(), "yyyy-MM-dd"),
    branchId: entry ? (entry.branchId ?? NONE) : branchId,
    paymentMethod: entry?.paymentMethod ?? NONE,
    lines,
    split: lines.length > 1,
    items: (entry?.items ?? []).map((i) => ({ key: nextKey++, itemId: i.itemId ?? undefined, name: i.name, qty: String(i.quantity), price: toMajor(i.unitPrice) })),
    reference: entry?.reference ?? "",
    notes: entry?.notes ?? "",
  }
}

export function EntryDialog({ open, onOpenChange, entry, defaultKind = "expense", kinds = ALL_KINDS, title }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  entry?: FinanceEntry
  defaultKind?: FinanceKind
  /** Which kinds this person may record (sales-only staff: just "income"). */
  kinds?: FinanceKind[]
  title?: string
}) {
  const fmt = useAdminCurrency()
  const { session, can } = useAuth()
  const catalog = useFinanceCatalog()
  const { data: branches } = useBranches()
  const { data: parties } = useFinanceParties(open)
  const m = useFinanceMutations()
  // Staff limited to some branches can't file business-wide entries: they pick one of theirs.
  const wholeBusinessAllowed = Boolean(session?.user.allBranches || can("*"))
  const firstBranch = wholeBusinessAllowed ? NONE : (branches?.[0]?.id ?? NONE)
  // A sales-only form starts on the usual sale category.
  const startCategory = kinds.length === 1 && kinds[0] === "income" ? (catalog.active.find((c) => c.kind === "income" && c.isSale)?.key ?? "") : ""
  const [d, setD] = useState<Draft>(() => draftOf(entry, defaultKind, firstBranch, startCategory))
  // Fill the form only when the dialog opens: a background refetch (e.g. on returning to the tab) must never wipe
  // what's been typed.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) setD(draftOf(entry, kinds.includes(defaultKind) ? defaultKind : kinds[0], firstBranch, startCategory))
    wasOpen.current = open
  }, [open, entry, defaultKind, kinds, firstBranch, startCategory])
  // Branches may arrive after the dialog opened.
  useEffect(() => {
    if (open && !wholeBusinessAllowed && d.branchId === NONE && firstBranch !== NONE) setD((s) => ({ ...s, branchId: firstBranch }))
  }, [open, wholeBusinessAllowed, d.branchId, firstBranch])
  const set = (p: Partial<Draft>) => setD((s) => ({ ...s, ...p }))
  const setLine = (key: number, p: Partial<Line>) => setD((s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, ...p } : l)) }))
  const setItem = (key: number, p: Partial<ItemLine>) => setD((s) => ({ ...s, items: s.items.map((l) => (l.key === key ? { ...l, ...p } : l)) }))

  // Hidden categories aren't offered, except the one an entry being edited already has.
  const cats = useMemo(() => (catalog.data?.categories ?? []).filter((c) => c.kind === d.kind && (c.isActive || c.key === d.category)), [catalog.data, d.kind, d.category])
  const groups = catalog.data?.groups ?? []
  const words = PARTY_WORDS[d.kind]
  const busy = m.create.isPending || m.update.isPending
  // A date two or more days back is flagged (it is probably a slip), with a one-click way back to today.
  const salesOnlyForm = kinds.length === 1 && kinds[0] === "income"
  const backDated = Boolean(d.entryDate) && differenceInCalendarDays(new Date(), parseISO(d.entryDate)) >= 2
  const splitTotal = d.lines.reduce((s, l) => s + toMinor(l.amount || "0"), 0)

  // What was sold: offered for walk-in and catering sales. The total then comes from the items.
  const itemsEligible = d.kind === "income" && catalog.isSale(d.category)
  const { data: menu } = useSaleMenu(d.branchId === NONE ? undefined : d.branchId, open && itemsEligible)
  const hasItems = itemsEligible && d.items.length > 0
  const itemsTotal = d.items.reduce((s, l) => s + lineTotal(l), 0)
  const total = hasItems ? itemsTotal : d.split ? splitTotal : toMinor(d.amount)
  const derivedTotal = hasItems || d.split

  const startSplit = () => setD((s) => ({ ...s, split: true, lines: [{ ...s.lines[0], amount: s.lines[0].amount || (hasItems ? toMajor(itemsTotal) : s.amount) }, blankLine()] }))
  const removeLine = (key: number) =>
    setD((s) => {
      const lines = s.lines.filter((l) => l.key !== key)
      // Back to one person: their amount becomes the entry amount again.
      return lines.length <= 1 ? { ...s, split: false, lines: lines.length ? lines : [blankLine()], amount: lines[0]?.amount || s.amount } : { ...s, lines }
    })

  const submit = async () => {
    if (!d.category) return toast.error("Choose a category")
    if (!d.entryDate) return toast.error("Choose the date")
    let items: SaleItemInput[] = []
    if (itemsEligible) {
      const filled = d.items.filter((l) => l.name.trim() || l.price.trim())
      for (const l of filled) {
        if (!l.name.trim()) return toast.error("Each item needs a name")
        if (qtyOf(l) < 1) return toast.error(`Enter how many ${l.name.trim()} were sold`)
        if (!l.price.trim()) return toast.error(`Enter the price of ${l.name.trim()}`)
      }
      items = filled.map((l) => ({ ...(l.itemId ? { itemId: l.itemId } : {}), name: l.name.trim(), quantity: qtyOf(l), unitPrice: toMinor(l.price) }))
    }
    const amount = items.length ? items.reduce((s, l) => s + l.quantity * l.unitPrice, 0) : d.split ? splitTotal : toMinor(d.amount)
    let lines: PartyLineInput[]
    if (d.split) {
      const filled = d.lines.filter((l) => l.name.trim() || l.amount.trim())
      if (filled.some((l) => !l.name.trim())) return toast.error(`Each line needs a ${words.one}`)
      if (filled.some((l) => !(toMinor(l.amount) > 0))) return toast.error("Each line needs an amount above zero")
      if (filled.length === 0) return toast.error(`Add at least one ${words.one}`)
      lines = filled.map((l) => ({ ...(l.partyId ? { partyId: l.partyId } : { name: l.name.trim() }), amount: toMinor(l.amount) }))
      const assigned = lines.reduce((s, l) => s + l.amount, 0)
      if (items.length && assigned !== amount) return toast.error(`The ${words.many} add up to ${formatMoney(assigned, fmt)}, but the items come to ${formatMoney(amount, fmt)}`)
    } else {
      const l = d.lines[0]
      lines = l?.name.trim() ? [{ ...(l.partyId ? { partyId: l.partyId } : { name: l.name.trim() }), amount }] : []
    }
    if (!(amount > 0)) return toast.error(items.length ? "The items come to zero: check the prices" : "Enter an amount above zero")
    if (!wholeBusinessAllowed && d.branchId === NONE) return toast.error("Choose your branch")
    const body = {
      kind: d.kind,
      category: d.category,
      title: d.title.trim() || catalog.label(d.category),
      amount,
      entryDate: d.entryDate,
      branchId: d.branchId === NONE ? null : d.branchId,
      paymentMethod: d.paymentMethod === NONE ? null : d.paymentMethod,
      parties: lines,
      items,
      reference: d.reference.trim() || null,
      notes: d.notes.trim() || null,
    }
    try {
      if (entry) await m.update.mutateAsync({ id: entry.id, body })
      else await m.create.mutateAsync(body)
      toast.success(entry ? "Entry updated" : "Entry recorded")
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-cy="finance-entry-dialog" className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{title ?? (entry ? "Edit entry" : "Record money in or out")}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          {kinds.length > 1 ? (
            <div role="radiogroup" aria-label="Kind" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-4">
              {kinds.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={d.kind === k} onClick={() => set({ kind: k, category: k === d.kind ? d.category : "" })} className={cn("rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors", d.kind === k && "bg-card text-foreground shadow-sm")} data-cy={`entry-kind-${k}`}>
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">{KIND_HINTS[d.kind]}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Category">
              {/* Always controlled (never undefined), so the box can't show a choice the form no longer has. */}
              <Select value={d.category} onValueChange={(v) => set({ category: v })}>
                <SelectTrigger data-cy="entry-category"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {d.kind === "expense"
                    ? groups.map((g) => (
                        <SelectGroup key={g.key}>
                          <SelectLabel>{g.label}</SelectLabel>
                          {cats.filter((c) => c.group === g.key).map((c) => <SelectItem key={c.key} value={c.key}>{c.label}{c.isActive ? "" : " (hidden)"}</SelectItem>)}
                        </SelectGroup>
                      ))
                    : cats.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}{c.isActive ? "" : " (hidden)"}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={derivedTotal ? "Total (₦)" : "Amount (₦)"} hint={hasItems ? "Adds up the items below" : d.split ? `Adds up the ${words.many} below` : undefined}>
              {derivedTotal ? (
                <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium tabular-nums" data-cy="entry-total"><Money value={total} fmt={fmt} /></div>
              ) : (
                <Input inputMode="decimal" value={d.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0" data-cy="entry-amount" />
              )}
            </Field>

            {itemsEligible ? (
              <div className="sm:col-span-2" data-cy="entry-items">
                <p className="mb-1.5 text-sm font-medium">What was sold <span className="font-normal text-muted-foreground">(optional)</span></p>
                {d.items.length === 0 ? <p className="mb-1.5 text-xs text-muted-foreground">Pick the menu items so you can see what's selling. The total then adds up by itself.</p> : null}
                <div className="space-y-2">
                  {d.items.map((l, i) => (
                    <div key={l.key} className="space-y-2 rounded-lg border border-border p-2">
                      <div className="flex items-start gap-2">
                        <ItemPicker
                          value={l.name}
                          menu={menu ?? []}
                          onType={(name, exact) => setItem(l.key, { name, itemId: exact?.id, ...(exact && !l.price ? { price: toMajor(exact.price) } : {}) })}
                          onPick={(it) => setItem(l.key, { itemId: it.id, name: it.name, price: toMajor(it.price), qty: l.qty || "1" })}
                          formatPrice={(k) => formatMoney(k, fmt)}
                          placeholder={`Item ${i + 1}: start typing…`}
                          ariaLabel={`Item ${i + 1}`}
                          dataCy={`entry-item-${i}`}
                          autoFocus={i === d.items.length - 1 && !l.name && d.items.length > 1}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setD((s) => ({ ...s, items: s.items.filter((x) => x.key !== l.key) }))} aria-label={`Remove item ${i + 1}`}><X /></Button>
                      </div>
                      <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2">
                        <Input inputMode="numeric" value={l.qty} onChange={(e) => setItem(l.key, { qty: e.target.value.replace(/\D/g, "") })} placeholder="Qty" aria-label={`Quantity of item ${i + 1}`} className="text-center" data-cy={`entry-item-qty-${i}`} />
                        <Input inputMode="decimal" value={l.price} onChange={(e) => setItem(l.key, { price: e.target.value })} placeholder="₦ each" aria-label={`Price each of item ${i + 1}`} data-cy={`entry-item-price-${i}`} />
                        <span className="min-w-[5.5rem] text-right text-sm font-medium tabular-nums"><Money value={lineTotal(l)} fmt={fmt} /></span>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => setD((s) => ({ ...s, items: [...s.items, blankItem()] }))} data-cy="entry-add-item">
                  <Plus /> {d.items.length ? "Add another item" : "Add what was sold"}
                </Button>
              </div>
            ) : null}

            <div className="sm:col-span-2" data-cy="entry-parties">
              <p className="mb-1.5 text-sm font-medium">{d.split ? `${words.many[0].toUpperCase()}${words.many.slice(1)}` : words.label}</p>
              <div className="space-y-2">
                {d.lines.map((l, i) => (
                  <div key={l.key} className={cn("grid items-start gap-2", d.split ? "grid-cols-[1fr_7.5rem_auto]" : "grid-cols-1")}>
                    <PartyPicker
                      value={{ partyId: l.partyId, name: l.name }}
                      onChange={(v) => setLine(l.key, { partyId: v.partyId, name: v.name })}
                      parties={parties ?? []}
                      kind={d.kind}
                      placeholder={d.split ? `${words.one[0].toUpperCase()}${words.one.slice(1)} ${i + 1}` : `Start typing a ${words.one}…`}
                      ariaLabel={`${words.one} ${i + 1}`}
                      dataCy={`entry-party-${i}`}
                      autoFocus={d.split && i === d.lines.length - 1 && !l.name}
                    />
                    {d.split ? (
                      <>
                        <Input inputMode="decimal" value={l.amount} onChange={(e) => setLine(l.key, { amount: e.target.value })} placeholder="₦ amount" aria-label={`Amount for ${l.name || `${words.one} ${i + 1}`}`} className="text-right" data-cy={`entry-party-amount-${i}`} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(l.key)} aria-label={`Remove ${l.name || `${words.one} ${i + 1}`}`}><X /></Button>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
              {hasItems && d.split ? (
                <p className={cn("mt-1 text-xs", splitTotal === itemsTotal ? "text-muted-foreground" : "text-destructive")} data-cy="entry-assigned">
                  {formatMoney(splitTotal, fmt)} of {formatMoney(itemsTotal, fmt)} assigned
                </p>
              ) : null}
              <Button type="button" variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => (d.split ? set({ lines: [...d.lines, blankLine()] }) : startSplit())} data-cy="entry-add-party">
                <Plus /> {d.split ? `Add another ${words.one}` : `Split between several ${words.many}`}
              </Button>
            </div>

            <Field label="Description" className="sm:col-span-2">
              <Input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder={d.category ? catalog.label(d.category) : "What was it for?"} maxLength={160} data-cy="entry-title" />
            </Field>
            <Field label="Date" hint={backDated ? undefined : salesOnlyForm ? "Today, unless you're entering an earlier sale." : "Back-date freely: history from before the app counts."}>
              <Input type="date" value={d.entryDate} max={format(new Date(), "yyyy-MM-dd")} onChange={(e) => set({ entryDate: e.target.value })} data-cy="entry-date" />
              {backDated ? (
                // A date a few days back usually means a slip (a mistyped day or month), and the entry then lands in another
                // period: it won't show in today's totals or this month's analytics.
                <p className="text-xs font-medium text-warning" role="alert" data-cy="entry-date-warning">
                  Dated {format(parseISO(d.entryDate), "d MMM yyyy")}, not today. It counts in that period, not in today's or this month's totals.{" "}
                  <button type="button" className="underline underline-offset-2" onClick={() => set({ entryDate: format(new Date(), "yyyy-MM-dd") })}>Use today</button>
                </p>
              ) : null}
            </Field>
            <Field label="Branch" hint={d.kind === "income" && wholeBusinessAllowed ? "Staff at a branch only see sales filed to their branch." : undefined}>
              <Select value={d.branchId} onValueChange={(v) => set({ branchId: v })}>
                <SelectTrigger data-cy="entry-branch"><SelectValue placeholder="Choose your branch" /></SelectTrigger>
                <SelectContent>
                  {wholeBusinessAllowed ? <SelectItem value={NONE}>Whole business</SelectItem> : null}
                  {(branches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Paid by">
              <Select value={d.paymentMethod} onValueChange={(v) => set({ paymentMethod: v })}>
                <SelectTrigger data-cy="entry-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {(catalog.data?.paymentMethods ?? []).map((p) => <SelectItem key={p} value={p}>{PAYMENT_METHOD_LABELS[p] ?? p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference / receipt no.">
              <Input value={d.reference} onChange={(e) => set({ reference: e.target.value })} maxLength={80} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={busy} data-cy="entry-save">{entry ? "Save changes" : "Record"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
