// Vendors & customers: everyone the business pays or is paid by. Search, add, rename, merge duplicates, remove.
import { format, parseISO } from "date-fns"
import { Check, GitMerge, Pencil, Plus, Trash2, X } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { SearchInput } from "@/components/shared/SearchInput"
import { Money } from "@/components/shared/Money"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFinanceParties, usePartyMutations } from "@/hooks/useFinance"
import { useAdminCurrency } from "@/hooks/useFormatters"
import type { FinanceKind, FinanceParty } from "@/types/finance.types"

const ROLE: Record<FinanceKind, { label: string; variant: "danger" | "success" | "info" | "warning" }> = {
  expense: { label: "Vendor", variant: "danger" },
  income: { label: "Customer", variant: "success" },
  capital: { label: "Investor / lender", variant: "info" },
  withdrawal: { label: "Paid out to", variant: "warning" },
}

type Mode = { kind: "rename"; id: string; name: string } | { kind: "merge"; id: string; intoId: string } | null

export function PartiesDialog({ open, onOpenChange, manage }: { open: boolean; onOpenChange: (o: boolean) => void; manage: boolean }) {
  const fmt = useAdminCurrency()
  const { data: parties, isLoading } = useFinanceParties(open)
  const m = usePartyMutations()
  const [search, setSearch] = useState("")
  const [adding, setAdding] = useState("")
  const [mode, setMode] = useState<Mode>(null)
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (parties ?? []).filter((p) => !q || p.name.toLowerCase().includes(q))
  }, [parties, search])

  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work()
      toast.success(done)
      setMode(null)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const add = () => {
    const name = adding.trim()
    if (!name) return
    void run(async () => { await m.create.mutateAsync({ name }); setAdding("") }, `Added ${name}`)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setMode(null) }}>
      <DialogContent className="sm:max-w-2xl" data-cy="parties-dialog">
        <DialogHeader>
          <DialogTitle>Vendors & customers</DialogTitle>
          <DialogDescription>Everyone you pay or get paid by. Names are added automatically as you record entries; tidy them up here.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search names" className="min-w-0 flex-1" dataCy="parties-search" />
          {manage ? (
            <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); add() }}>
              <Input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="New name" maxLength={160} className="min-w-0" data-cy="parties-new" />
              <Button type="submit" variant="outline" disabled={!adding.trim()} loading={m.create.isPending}><Plus /> Add</Button>
            </form>
          ) : null}
        </div>

        {isLoading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p> : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{search ? "No names match." : "No vendors or customers yet. They're added as you record entries."}</p>
        ) : (
          <ul className="max-h-[55vh] divide-y divide-border overflow-y-auto rounded-lg border border-border" data-cy="parties-list">
            {list.map((p) => (
              <li key={p.id} className="p-3">
                {mode?.kind === "rename" && mode.id === p.id ? (
                  <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => m.update.mutateAsync({ id: p.id, body: { name: mode.name.trim() } }), "Renamed") }}>
                    <Input value={mode.name} onChange={(e) => setMode({ ...mode, name: e.target.value })} autoFocus maxLength={160} aria-label={`New name for ${p.name}`} />
                    <Button type="submit" size="icon" disabled={!mode.name.trim()} loading={m.update.isPending} aria-label="Save name"><Check /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setMode(null)} aria-label="Cancel"><X /></Button>
                  </form>
                ) : mode?.kind === "merge" && mode.id === p.id ? (
                  <MergeRow party={p} parties={parties ?? []} intoId={mode.intoId} onPick={(intoId) => setMode({ ...mode, intoId })} onCancel={() => setMode(null)} busy={m.merge.isPending} onConfirm={() => void run(() => m.merge.mutateAsync({ id: p.id, intoId: mode.intoId }), "Merged")} />
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{p.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {p.kinds.map((k) => <Badge key={k} variant={ROLE[k].variant}>{ROLE[k].label}</Badge>)}
                        {p.entries ? <span>{p.entries} {p.entries === 1 ? "entry" : "entries"} · <Money value={p.total} fmt={fmt} />{p.lastUsed ? ` · last ${format(parseISO(p.lastUsed), "d MMM yyyy")}` : ""}</span> : <span>Not used yet</span>}
                      </div>
                    </div>
                    {manage ? (
                      <div className="flex shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={() => setMode({ kind: "rename", id: p.id, name: p.name })} aria-label={`Rename ${p.name}`}><Pencil /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setMode({ kind: "merge", id: p.id, intoId: "" })} aria-label={`Merge ${p.name} into another name`} title="Merge into another name"><GitMerge /></Button>
                        <Button variant="ghost" size="icon-sm" disabled={p.entries > 0} title={p.entries > 0 ? "Used on entries: merge it instead" : "Remove"} onClick={() => void run(() => m.remove.mutateAsync(p.id), `Removed ${p.name}`)} aria-label={`Remove ${p.name}`}><Trash2 className="text-destructive" /></Button>
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Merging moves every entry from one name to another (handy for "Mile 12 Mkt" and "Mile 12 market"), then removes the old name. A name that's on entries can't be removed; merge it instead.</p>
      </DialogContent>
    </Dialog>
  )
}

function MergeRow({ party, parties, intoId, onPick, onCancel, onConfirm, busy }: { party: FinanceParty; parties: FinanceParty[]; intoId: string; onPick: (id: string) => void; onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  const into = parties.find((p) => p.id === intoId)
  return (
    <div className="space-y-2" data-cy="parties-merge">
      <p className="text-sm">Merge <b>{party.name}</b> into:</p>
      <Select value={intoId} onValueChange={onPick}>
        <SelectTrigger aria-label="Merge into"><SelectValue placeholder="Choose the name to keep" /></SelectTrigger>
        <SelectContent>{parties.filter((p) => p.id !== party.id).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
      </Select>
      {into ? <p className="text-xs text-muted-foreground">{party.entries} {party.entries === 1 ? "entry moves" : "entries move"} to “{into.name}”, and “{party.name}” is removed.</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm} disabled={!intoId} loading={busy}><GitMerge /> Merge</Button>
      </div>
    </div>
  )
}
