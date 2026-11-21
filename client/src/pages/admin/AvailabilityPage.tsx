// Per-branch sold-out toggles for items and options, with optional auto-restore time.
// Rows can be multi-selected (checkboxes, select-all, shift-click ranges) to change many at once.
import { format } from "date-fns"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { BranchSelect } from "@/components/admin/BranchSelect"
import { PageHeader } from "@/components/layout/PageHeader"
import { SearchInput } from "@/components/shared/SearchInput"
import { EmptyState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { useBranches } from "@/hooks/useAdminBranches"
import { useAvailability, useItems, useOptionGroups, useSetAvailability, useSetManyAvailability } from "@/hooks/useAdminMenu"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { useAdminBranch } from "@/hooks/useAdminBranch"

type Target = { itemId?: string; optionId?: string }
type Row = { id: string; name: string; sub: string; kind: "item" | "option" }

const MAX_BULK = 200 // matches the API limit

export default function AvailabilityPage() {
  const { can, session } = useAuth()
  const { data: branches } = useBranches()
  const [stored, setStored] = useAdminBranch()
  const branchId = stored || session?.user.branchIds[0] || branches?.[0]?.id || ""
  const [tab, setTab] = useState<"items" | "options">("items")
  const [search, setSearch] = useState("")
  const term = useDebouncedSearch(search).toLowerCase()
  const { data: soldOut } = useAvailability(branchId || undefined)
  const { data: items } = useItems({})
  const { data: groups } = useOptionGroups()
  const set = useSetAvailability()
  const setMany = useSetManyAvailability()
  const busy = set.isPending || setMany.isPending
  const [pending, setPending] = useState<{ targets: Target[]; label: string; multi: boolean } | null>(null)
  const [restoreAt, setRestoreAt] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastClicked = useRef<number | null>(null)
  const canToggle = can("availability.toggle")

  // A selection only makes sense for what's on screen, so drop it when the view changes.
  useEffect(() => {
    setSelected(new Set())
    lastClicked.current = null
  }, [tab, branchId, term])

  const soldOutItems = new Set((soldOut ?? []).filter((r) => r.itemId).map((r) => r.itemId!))
  const soldOutOptions = new Set((soldOut ?? []).filter((r) => r.optionId).map((r) => r.optionId!))
  const restoreFor = (id: string) => soldOut?.find((r) => r.itemId === id || r.optionId === id)?.restoreAt
  const isOut = (r: Row) => (r.kind === "item" ? soldOutItems.has(r.id) : soldOutOptions.has(r.id))
  const toTarget = (r: Row): Target => (r.kind === "item" ? { itemId: r.id } : { optionId: r.id })

  const toggle = (row: Row, available: boolean) => {
    if (!branchId) return toast.error("Choose a branch")
    if (available) set.mutate({ branchId, ...toTarget(row), isAvailable: true }, { onError: (e) => toast.error(e.message) })
    else setPending({ targets: [toTarget(row)], label: row.name, multi: false })
  }

  const confirmSoldOut = () => {
    if (!pending) return
    const restore = restoreAt ? new Date(restoreAt).toISOString() : null
    const done = () => {
      if (pending.multi) {
        toast.success(`${pending.label} marked sold out`)
        setSelected(new Set())
      }
      setPending(null)
      setRestoreAt("")
    }
    const onError = (e: Error) => toast.error(e.message)
    if (pending.targets.length === 1) set.mutate({ branchId, ...pending.targets[0], isAvailable: false, restoreAt: restore }, { onSuccess: done, onError })
    else setMany.mutate({ branchId, targets: pending.targets, isAvailable: false, restoreAt: restore }, { onSuccess: done, onError })
  }

  const rows: Row[] =
    tab === "items"
      ? (items ?? []).map((i) => ({ id: i.id, name: i.name, sub: i.categoryName, kind: "item" as const }))
      : (groups ?? []).flatMap((g) => g.options.map((o) => ({ id: o.id, name: o.name, sub: g.name, kind: "option" as const })))
  const filtered = rows.filter((r) => !term || `${r.name} ${r.sub}`.toLowerCase().includes(term))

  // Selection ────────────────────────────────────────────────────────────────
  const noun = (n: number) => `${n} ${tab === "items" ? "item" : "option"}${n === 1 ? "" : "s"}`
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id))
  const someSelected = filtered.some((r) => selected.has(r.id))

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(filtered.map((r) => r.id)))
    lastClicked.current = null
  }
  const clickRow = (index: number, shift: boolean) => {
    const anchor = lastClicked.current // read before the updater runs
    lastClicked.current = index
    setSelected((prev) => {
      const next = new Set(prev)
      const turnOn = !prev.has(filtered[index].id)
      const [from, to] = shift && anchor !== null ? [Math.min(anchor, index), Math.max(anchor, index)] : [index, index]
      for (let i = from; i <= to; i++) {
        if (turnOn) next.add(filtered[i].id)
        else next.delete(filtered[i].id)
      }
      return next
    })
  }

  // Each bulk button only acts on the selected rows it would actually change.
  const selectedRows = filtered.filter((r) => selected.has(r.id))
  const bulkOut = selectedRows.filter((r) => !isOut(r))
  const bulkBack = selectedRows.filter(isOut)

  const bulkSoldOut = () => {
    if (!branchId) return toast.error("Choose a branch")
    if (bulkOut.length > MAX_BULK) return toast.error(`Select up to ${MAX_BULK} at a time`)
    setPending({ targets: bulkOut.map(toTarget), label: noun(bulkOut.length), multi: true })
  }
  const bulkAvailable = () => {
    if (!branchId) return toast.error("Choose a branch")
    if (bulkBack.length > MAX_BULK) return toast.error(`Select up to ${MAX_BULK} at a time`)
    setMany.mutate(
      { branchId, targets: bulkBack.map(toTarget), isAvailable: true },
      { onSuccess: () => { toast.success(`${noun(bulkBack.length)} back in stock`); setSelected(new Set()) }, onError: (e) => toast.error(e.message) }
    )
  }

  return (
    <div data-cy="availability-page">
      <PageHeader title="Availability" description="Sold-out toggles reach open storefronts within seconds and warn customers who already have the item in their bag." actions={<BranchSelect value={branchId} onChange={setStored} />} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}><TabsList><TabsTrigger value="items" data-cy="tab-items">Items</TabsTrigger><TabsTrigger value="options" data-cy="tab-options">Options</TabsTrigger></TabsList></Tabs>
        <SearchInput value={search} onChange={setSearch} className="order-last w-full sm:order-none sm:w-64" dataCy="availability-search" />
        <Badge variant={soldOut?.length ? "danger" : "neutral"} className="ml-auto">{soldOut?.length ?? 0} sold out at this branch</Badge>
      </div>
      {filtered.length === 0 ? <EmptyState title="Nothing to show" /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {canToggle ? (
            <li className="flex items-center gap-3 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label={`Select all ${filtered.length} shown`} data-cy="avail-select-all" />
              <span>{someSelected ? `${selectedRows.length} of ${filtered.length} selected` : `Select all ${filtered.length}`}</span>
              <span className="ml-auto hidden sm:inline">Shift-click to select a range</span>
            </li>
          ) : null}
          {filtered.map((r, index) => {
            const out = isOut(r)
            const restore = out ? restoreFor(r.id) : null
            const checked = selected.has(r.id)
            return (
              <li key={r.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${checked ? "bg-primary/5" : ""}`} data-cy={`avail-${r.id}`}>
                {canToggle ? <Checkbox checked={checked} onClick={(e) => clickRow(index, e.shiftKey)} aria-label={`Select ${r.name}`} data-cy="avail-select" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.sub}{restore ? ` · back ${format(new Date(restore), "d MMM HH:mm")}` : ""}</p>
                </div>
                {out ? <Badge variant="danger">Sold out</Badge> : <Badge variant="success">Available</Badge>}
                <Switch checked={!out} disabled={!canToggle || busy} onCheckedChange={(v) => toggle(r, v)} aria-label={`Toggle ${r.name}`} data-cy="avail-switch" />
              </li>
            )
          })}
        </ul>
      )}
      {selected.size > 0 ? (
        <div className="sticky bottom-4 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 pl-4 shadow-lg" data-cy="bulk-bar">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} data-cy="bulk-clear">Clear</Button>
            <Button variant="outline" size="sm" disabled={busy || bulkBack.length === 0} loading={setMany.isPending && !pending} onClick={bulkAvailable} data-cy="bulk-available">Mark available ({bulkBack.length})</Button>
            <Button variant="destructive" size="sm" disabled={busy || bulkOut.length === 0} onClick={bulkSoldOut} data-cy="bulk-sold-out">Mark sold out ({bulkOut.length})</Button>
          </div>
        </div>
      ) : null}
      <Dialog open={Boolean(pending)} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{pending?.multi ? `Mark ${pending.label} sold out` : `Mark “${pending?.label}” sold out`}</DialogTitle></DialogHeader>
          <Field label="Automatically restore at (optional)"><Input type="datetime-local" value={restoreAt} onChange={(e) => setRestoreAt(e.target.value)} data-cy="restore-at" /></Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="destructive" loading={busy} onClick={confirmSoldOut} data-cy="sold-out-confirm">Sold out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
