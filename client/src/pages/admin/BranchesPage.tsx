import { Pause, Play, Plus, Star, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { SimpleFormDialog, type FieldDef } from "@/components/admin/SimpleFormDialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { MapView } from "@/components/shared/MapView"
import { PageLoader } from "@/components/shared/PageLoader"
import { EmptyState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { useBranchMutations, useBranches } from "@/hooks/useAdminBranches"
import { useMenus } from "@/hooks/useAdminMenu"
import { useRestaurantSettings, useSettingsMutations } from "@/hooks/useAdminSettings"
import type { Branch } from "@/types/admin.types"

export const branchFields: FieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true },
  // Search an address or drop a pin: fills in the address, city and map position below, so nobody types coordinates.
  { name: "location", label: "Location", type: "location" },
  { name: "lat", label: "Latitude", type: "number", hidden: true },
  { name: "lng", label: "Longitude", type: "number", hidden: true },
  { name: "address", label: "Address", type: "textarea", required: true },
  { name: "city", label: "City", type: "text", required: true },
  { name: "phone", label: "Phone", type: "phone" },
  { name: "prepTimeMinutes", label: "Prep time (minutes)", type: "number", default: 20, half: true },
  { name: "slotIntervalMinutes", label: "Slot interval (minutes)", type: "number", default: 15, half: true },
  { name: "deliveryEnabled", label: "Offers delivery", type: "switch", default: true, half: true },
  { name: "pickupEnabled", label: "Offers pickup", type: "switch", default: true, half: true },
  { name: "paymentMethodOverride", label: "Payment method override", type: "select", options: [{ value: "paystack", label: "Paystack only" }, { value: "transfer", label: "Bank transfer only" }], hint: "Leave blank to use the restaurant's payment settings." },
  { name: "isActive", label: "Active", type: "switch", default: true },
]

export default function BranchesPage() {
  const { can } = useAuth()
  const { data: branches, isLoading } = useBranches()
  const { data: menus } = useMenus()
  const m = useBranchMutations()
  const { data: settings } = useRestaurantSettings()
  const settingsM = useSettingsMutations()
  const [createOpen, setCreateOpen] = useState(false)
  const [pauseTarget, setPauseTarget] = useState<Branch | null>(null)
  const [reason, setReason] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const lastClicked = useRef<number | null>(null)
  const canDelete = can("branches.edit")

  if (isLoading) return <PageLoader />

  // Selection ────────────────────────────────────────────────────────────────
  const list = branches ?? []
  const picked = list.filter((b) => selected.has(b.id))
  const allSelected = list.length > 0 && picked.length === list.length
  // The server insists on one active branch; say so here instead of letting the delete fail.
  const wouldLeaveNone = picked.length > 0 && list.every((b) => !b.isActive || selected.has(b.id))
  const clear = () => {
    setSelected(new Set())
    lastClicked.current = null
  }
  const toggleAll = () => (allSelected ? clear() : setSelected(new Set(list.map((b) => b.id))))
  const clickRow = (index: number, shift: boolean) => {
    const anchor = lastClicked.current // read before the updater runs
    lastClicked.current = index
    setSelected((prev) => {
      const next = new Set(prev)
      const turnOn = !prev.has(list[index].id)
      const [from, to] = shift && anchor !== null ? [Math.min(anchor, index), Math.max(anchor, index)] : [index, index]
      for (let i = from; i <= to; i++) {
        if (turnOn) next.add(list[i].id)
        else next.delete(list[i].id)
      }
      return next
    })
  }
  const deleteSelected = async () => {
    try {
      const count = picked.length
      await m.removeMany.mutateAsync(picked.map((b) => b.id))
      toast.success(`${count} ${count === 1 ? "branch" : "branches"} deleted`)
      setDeleteOpen(false)
      clear()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div data-cy="branches-page">
      <PageHeader title="Branches" description="Locations, hours, delivery zones and the menus each one serves." actions={can("branches.edit") ? <Button onClick={() => setCreateOpen(true)} data-cy="branch-new"><Plus /> New branch</Button> : null} />
      {!branches || branches.length === 0 ? <EmptyState title="No branches yet" description="Add your first branch to start taking orders." /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
          <div>
          {canDelete ? (
            <div className="mb-2 flex items-center gap-3 px-1 text-xs text-muted-foreground">
              <Checkbox checked={allSelected ? true : picked.length > 0 ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label={`Select all ${branches.length} branches`} data-cy="branch-select-all" />
              <span>{picked.length > 0 ? `${picked.length} of ${branches.length} selected` : `Select all ${branches.length}`}</span>
              <span className="ml-auto hidden sm:inline">Shift-click to select a range</span>
            </div>
          ) : null}
          <ul className="space-y-2">
            {branches.map((b, index) => (
              <li key={b.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${selected.has(b.id) ? "border-primary/40 bg-primary/5" : "bg-card"}`} data-cy={`branch-${b.id}`}>
                {canDelete ? <Checkbox checked={selected.has(b.id)} onClick={(e) => clickRow(index, e.shiftKey)} aria-label={`Select ${b.name}`} data-cy="branch-select" /> : null}
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/branches/${b.id}`} className="font-semibold hover:underline">{b.name}</Link>
                  <p className="text-sm text-muted-foreground">{b.city} · {b.address}</p>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs">
                    {settings?.defaultBranchId === b.id ? <Badge variant="success" data-cy="branch-default-badge">Shown first to new visitors</Badge> : null}
                    {!b.isActive ? <Badge variant="neutral">Inactive</Badge> : null}
                    {b.isPaused ? <Badge variant="warning">Paused{b.pauseReason ? ` · ${b.pauseReason}` : ""}</Badge> : null}
                    <Badge variant="outline">{[b.deliveryEnabled && "Delivery", b.pickupEnabled && "Pickup"].filter(Boolean).join(" · ") || "No fulfilment"}</Badge>
                    <Badge variant="outline">{b.menuIds.map((id) => menus?.find((x) => x.id === id)?.name).filter(Boolean).join(", ") || "No menus"}</Badge>
                    {b.lat === null ? <Badge variant="danger">No map pin</Badge> : null}
                  </div>
                </div>
                {can("settings.manage") && settings && b.isActive && settings.defaultBranchId !== b.id ? (
                  <Button variant="ghost" size="sm" loading={settingsM.update.isPending && settingsM.update.variables?.defaultBranchId === b.id} onClick={() => settingsM.update.mutate({ defaultBranchId: b.id }, { onSuccess: () => toast.success(`New visitors will see ${b.name} first`), onError: (e) => toast.error(e.message) })} data-cy="branch-make-default">
                    <Star /> Show first
                  </Button>
                ) : null}
                {can("branches.pause") ? (
                  <Button variant={b.isPaused ? "default" : "outline"} size="sm" onClick={() => (b.isPaused ? m.pause.mutate({ id: b.id, paused: false }, { onError: (e) => toast.error(e.message) }) : setPauseTarget(b))} data-cy="branch-pause">
                    {b.isPaused ? <><Play /> Resume</> : <><Pause /> Pause</>}
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" asChild><Link to={`/admin/branches/${b.id}`}>Manage</Link></Button>
              </li>
            ))}
          </ul>
          {picked.length > 0 ? (
            <div className="sticky bottom-4 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 pl-4 shadow-lg" data-cy="bulk-bar">
              <span className="text-sm font-medium">{picked.length} selected</span>
              {wouldLeaveNone ? <span className="text-xs text-muted-foreground">Keep at least one active branch.</span> : null}
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" size="sm" onClick={clear} data-cy="bulk-clear">Clear</Button>
                <Button variant="destructive" size="sm" disabled={wouldLeaveNone} onClick={() => setDeleteOpen(true)} data-cy="bulk-delete"><Trash2 /> Delete ({picked.length})</Button>
              </div>
            </div>
          ) : null}
          </div>
          <MapView className="h-80 lg:h-auto" pins={branches.filter((b) => b.lat !== null && b.lng !== null).map((b) => ({ id: b.id, lat: b.lat!, lng: b.lng!, label: b.name, muted: !b.isActive || b.isPaused }))} />
        </div>
      )}
      <SimpleFormDialog open={createOpen} onOpenChange={setCreateOpen} title="New branch" fields={branchFields} onSubmit={async (v) => { await m.create.mutateAsync({ ...v, menuIds: menus?.map((x) => x.id) ?? [] }) }} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${picked.length} ${picked.length === 1 ? "branch" : "branches"}?`}
        description={`${picked.slice(0, 5).map((b) => b.name).join(", ")}${picked.length > 5 ? ` and ${picked.length - 5} more` : ""}. Past orders are kept; these branches disappear from the storefront.`}
        confirmLabel="Delete"
        loading={m.removeMany.isPending}
        onConfirm={deleteSelected}
      />
      <Dialog open={Boolean(pauseTarget)} onOpenChange={(o) => !o && setPauseTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Pause ordering at {pauseTarget?.name}</DialogTitle></DialogHeader>
          <Field label="Reason shown to customers (optional)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} data-cy="pause-reason" /></Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPauseTarget(null)}>Cancel</Button>
            <Button variant="destructive" loading={m.pause.isPending} onClick={() => m.pause.mutate({ id: pauseTarget!.id, paused: true, reason: reason || null }, { onSuccess: () => { setPauseTarget(null); setReason("") }, onError: (e) => toast.error(e.message) })} data-cy="pause-confirm">Pause</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
