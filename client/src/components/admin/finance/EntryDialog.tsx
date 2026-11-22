// Record or edit one money movement: capital in, an expense, off-app income, or money taken out.
import { format } from "date-fns"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useBranches } from "@/hooks/useAdminBranches"
import { useFinanceCatalog, useFinanceMutations } from "@/hooks/useFinance"
import { KIND_HINTS, KIND_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/finance"
import { toMajor, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { FinanceEntry, FinanceKind } from "@/types/finance.types"

const KINDS: FinanceKind[] = ["expense", "capital", "income", "withdrawal"]
const NONE = "__none"

interface Draft {
  kind: FinanceKind
  category: string
  title: string
  amount: string
  entryDate: string
  branchId: string
  paymentMethod: string
  party: string
  reference: string
  notes: string
}

function draftOf(entry: FinanceEntry | undefined, kind: FinanceKind): Draft {
  return {
    kind: entry?.kind ?? kind,
    category: entry?.category ?? "",
    title: entry?.title ?? "",
    amount: entry ? toMajor(entry.amount) : "",
    entryDate: entry?.entryDate ?? format(new Date(), "yyyy-MM-dd"),
    branchId: entry?.branchId ?? NONE,
    paymentMethod: entry?.paymentMethod ?? NONE,
    party: entry?.party ?? "",
    reference: entry?.reference ?? "",
    notes: entry?.notes ?? "",
  }
}

export function EntryDialog({ open, onOpenChange, entry, defaultKind = "expense" }: { open: boolean; onOpenChange: (o: boolean) => void; entry?: FinanceEntry; defaultKind?: FinanceKind }) {
  const catalog = useFinanceCatalog()
  const { data: branches } = useBranches()
  const m = useFinanceMutations()
  const [d, setD] = useState<Draft>(() => draftOf(entry, defaultKind))
  useEffect(() => { if (open) setD(draftOf(entry, defaultKind)) }, [open, entry, defaultKind])
  const set = (p: Partial<Draft>) => setD((s) => ({ ...s, ...p }))

  const cats = useMemo(() => (catalog.data?.categories ?? []).filter((c) => c.kind === d.kind), [catalog.data, d.kind])
  const groups = catalog.data?.groups ?? []
  const busy = m.create.isPending || m.update.isPending

  const submit = async () => {
    const amount = toMinor(d.amount)
    if (!d.category) return toast.error("Choose a category")
    if (!(amount > 0)) return toast.error("Enter an amount above zero")
    if (!d.entryDate) return toast.error("Choose the date")
    const body = {
      kind: d.kind,
      category: d.category,
      title: d.title.trim() || catalog.label(d.category),
      amount,
      entryDate: d.entryDate,
      branchId: d.branchId === NONE ? null : d.branchId,
      paymentMethod: d.paymentMethod === NONE ? null : d.paymentMethod,
      party: d.party.trim() || null,
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

  const partyLabel = d.kind === "capital" ? "From (investor, lender…)" : d.kind === "withdrawal" ? "Paid to" : d.kind === "income" ? "Customer / client" : "Vendor / paid to"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-cy="finance-entry-dialog" className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{entry ? "Edit entry" : "Record money in or out"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <div role="radiogroup" aria-label="Kind" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-4">
            {KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={d.kind === k} onClick={() => set({ kind: k, category: k === d.kind ? d.category : "" })} className={cn("rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors", d.kind === k && "bg-card text-foreground shadow-sm")} data-cy={`entry-kind-${k}`}>
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{KIND_HINTS[d.kind]}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Category">
              <Select value={d.category || undefined} onValueChange={(v) => set({ category: v })}>
                <SelectTrigger data-cy="entry-category"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {d.kind === "expense"
                    ? groups.map((g) => (
                        <SelectGroup key={g.key}>
                          <SelectLabel>{g.label}</SelectLabel>
                          {cats.filter((c) => c.group === g.key).map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                        </SelectGroup>
                      ))
                    : cats.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount (₦)">
              <Input inputMode="decimal" value={d.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0" data-cy="entry-amount" />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder={d.category ? catalog.label(d.category) : "What was it for?"} maxLength={160} data-cy="entry-title" />
            </Field>
            <Field label="Date" hint="Back-date freely: history from before the app counts.">
              <Input type="date" value={d.entryDate} max={format(new Date(), "yyyy-MM-dd")} onChange={(e) => set({ entryDate: e.target.value })} data-cy="entry-date" />
            </Field>
            <Field label="Branch">
              <Select value={d.branchId} onValueChange={(v) => set({ branchId: v })}>
                <SelectTrigger data-cy="entry-branch"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Whole business</SelectItem>
                  {(branches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={partyLabel}>
              <Input value={d.party} onChange={(e) => set({ party: e.target.value })} maxLength={160} data-cy="entry-party" />
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
