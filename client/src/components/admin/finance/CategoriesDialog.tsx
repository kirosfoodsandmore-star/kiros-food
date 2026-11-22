// Categories: the kinds of money in and out the restaurant records. Built-in ones can be renamed, regrouped and hidden;
// the owner's own can also be deleted while nothing uses them. Everything already recorded keeps its category.
import { Check, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useCategoryMutations, useFinanceCatalog } from "@/hooks/useFinance"
import { KIND_LABELS } from "@/lib/finance"
import type { ExpenseGroup, FinanceCategory, FinanceKind } from "@/types/finance.types"

const KIND_ORDER: FinanceKind[] = ["expense", "income", "capital", "withdrawal"]
const KIND_BLURB: Record<FinanceKind, string> = {
  expense: "What the business spends.",
  income: "Sales and other income outside the app. Mark the ones that are sales.",
  capital: "Money put into the business.",
  withdrawal: "Money taken out.",
}

export function CategoriesDialog({ open, onOpenChange, manage }: { open: boolean; onOpenChange: (o: boolean) => void; manage: boolean }) {
  const catalog = useFinanceCatalog()
  const m = useCategoryMutations()
  const groups = catalog.data?.groups ?? []
  const all = catalog.data?.categories ?? []
  const [label, setLabel] = useState("")
  const [kind, setKind] = useState<FinanceKind>("expense")
  const [group, setGroup] = useState<ExpenseGroup>("operating")
  const [isSale, setIsSale] = useState(false)
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null)

  const run = async (work: () => Promise<unknown>, done?: string) => {
    try {
      await work()
      if (done) toast.success(done)
      return true
    } catch (err) {
      toast.error((err as Error).message)
      return false
    }
  }

  const add = async () => {
    const name = label.trim()
    if (name.length < 2) return toast.error("Give the category a name")
    const ok = await run(() => m.create.mutateAsync({ label: name, kind, ...(kind === "expense" ? { group } : {}), ...(kind === "income" ? { isSale } : {}) }), `Added ${name}`)
    if (ok) { setLabel(""); setIsSale(false) }
  }

  const row = (c: FinanceCategory) => {
    const used = (c.entries ?? 0) > 0 || (c.budgets ?? 0) > 0
    const renaming = editing?.id === c.id
    return (
      <li key={c.id} className="py-2.5" data-cy={`category-${c.key}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="min-w-0 flex-1 basis-40">
            {renaming ? (
              <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void run(() => m.update.mutateAsync({ id: c.id, body: { label: editing.label.trim() } }), "Renamed").then((ok) => ok && setEditing(null)) }}>
                <Input value={editing.label} onChange={(e) => setEditing({ id: c.id, label: e.target.value })} autoFocus maxLength={80} aria-label={`New name for ${c.label}`} className="h-8" />
                <Button type="submit" size="icon-sm" disabled={editing.label.trim().length < 2} aria-label="Save name"><Check /></Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(null)} aria-label="Cancel"><X /></Button>
              </form>
            ) : (
              <>
                <p className={`break-words text-sm font-medium ${c.isActive ? "" : "text-muted-foreground line-through"}`}>{c.label}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {!c.isBuiltin ? <Badge variant="info">Yours</Badge> : null}
                  {!c.isActive ? <Badge variant="neutral">Hidden</Badge> : null}
                  {c.kind === "income" && c.isSale ? <Badge variant="success">Counts as a sale</Badge> : null}
                  {c.entries !== undefined ? <span>{c.entries} {c.entries === 1 ? "entry" : "entries"}{c.budgets ? " · budget set" : ""}</span> : null}
                </p>
              </>
            )}
          </div>

          {manage && !renaming ? (
            <div className="flex shrink-0 items-center gap-1">
              {c.kind === "expense" ? (
                <Select value={c.group ?? "operating"} onValueChange={(g) => void run(() => m.update.mutateAsync({ id: c.id, body: { group: g as ExpenseGroup } }), "Moved: past entries follow it")}>
                  <SelectTrigger className="h-8 w-36 text-xs" aria-label={`Group for ${c.label}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{groups.map((g) => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : null}
              {c.kind === "income" ? (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Switch checked={c.isSale} onCheckedChange={(v) => void run(() => m.update.mutateAsync({ id: c.id, body: { isSale: v } }))} aria-label={`${c.label} counts as a sale`} data-cy={`category-sale-${c.key}`} /> Sale
                </label>
              ) : null}
              <Button variant="ghost" size="icon-sm" onClick={() => setEditing({ id: c.id, label: c.label })} aria-label={`Rename ${c.label}`}><Pencil /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => void run(() => m.update.mutateAsync({ id: c.id, body: { isActive: !c.isActive } }), c.isActive ? `${c.label} hidden` : `${c.label} shown again`)} aria-label={c.isActive ? `Hide ${c.label}` : `Show ${c.label}`} title={c.isActive ? "Hide: not offered for new entries" : "Show again"}>{c.isActive ? <EyeOff /> : <Eye />}</Button>
              {!c.isBuiltin ? (
                <Button variant="ghost" size="icon-sm" disabled={used} onClick={() => void run(() => m.remove.mutateAsync(c.id), `Deleted ${c.label}`)} aria-label={`Delete ${c.label}`} title={used ? "In use: hide it instead" : "Delete"}><Trash2 className="text-destructive" /></Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </li>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setEditing(null) }}>
      <DialogContent className="sm:max-w-2xl" data-cy="categories-dialog">
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>The kinds of money in and out you record. Add your own, rename them, or hide the ones you never use. Everything you've already recorded keeps its category.</DialogDescription>
        </DialogHeader>

        {manage ? (
          <form className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); void add() }} data-cy="category-add-form">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New category, e.g. Generator servicing" maxLength={80} aria-label="New category name" data-cy="category-new-name" />
            <Select value={kind} onValueChange={(v) => setKind(v as FinanceKind)}>
              <SelectTrigger className="sm:w-36" aria-label="Type" data-cy="category-new-kind"><SelectValue /></SelectTrigger>
              <SelectContent>{KIND_ORDER.map((k) => <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="submit" loading={m.create.isPending} data-cy="category-add"><Plus /> Add</Button>
            {kind === "expense" ? (
              <div className="sm:col-span-3">
                <Select value={group} onValueChange={(v) => setGroup(v as ExpenseGroup)}>
                  <SelectTrigger aria-label="Where it belongs" data-cy="category-new-group"><SelectValue /></SelectTrigger>
                  <SelectContent>{groups.map((g) => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Where it sits in your profit: <b>cost of sales</b> (ingredients, packaging), <b>running costs</b> (rent, pay, fuel) or <b>assets &amp; fit-out</b> (one-off equipment, not a monthly cost).</p>
              </div>
            ) : null}
            {kind === "income" ? (
              <label className="flex items-center gap-2 text-sm sm:col-span-3"><Switch checked={isSale} onCheckedChange={setIsSale} data-cy="category-new-sale" /> Counts as a sale <span className="text-xs text-muted-foreground">(shows in Sales reports and the Dashboard, and can list the menu items sold)</span></label>
            ) : null}
          </form>
        ) : null}

        <div className="max-h-[52vh] space-y-5 overflow-y-auto pr-1" data-cy="categories-list">
          {KIND_ORDER.map((k) => {
            const ofKind = all.filter((c) => c.kind === k)
            if (!ofKind.length) return null
            return (
              <section key={k}>
                <h3 className="text-sm font-semibold">{KIND_LABELS[k]} <span className="font-normal text-muted-foreground">· {KIND_BLURB[k]}</span></h3>
                {k === "expense" ? (
                  groups.map((g) => {
                    const inGroup = ofKind.filter((c) => (c.group ?? "operating") === g.key)
                    if (!inGroup.length) return null
                    return (
                      <div key={g.key} className="mt-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                        <ul className="divide-y divide-border">{inGroup.map(row)}</ul>
                      </div>
                    )
                  })
                ) : (
                  <ul className="mt-1 divide-y divide-border">{ofKind.map(row)}</ul>
                )}
              </section>
            )
          })}
        </div>
        {manage ? <p className="text-xs text-muted-foreground">Moving an expense between groups changes how its past entries count in profit and cost ratios. Hiding is safe: old entries keep the category, it just isn't offered for new ones. A category can only be deleted while nothing uses it.</p> : null}
      </DialogContent>
    </Dialog>
  )
}
