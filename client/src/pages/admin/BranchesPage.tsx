import { Pause, Play, Plus, Star } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { SimpleFormDialog, type FieldDef } from "@/components/admin/SimpleFormDialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { MapView } from "@/components/shared/MapView"
import { PageLoader } from "@/components/shared/PageLoader"
import { EmptyState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

  if (isLoading) return <PageLoader />
  return (
    <div data-cy="branches-page">
      <PageHeader title="Branches" description="Locations, hours, delivery zones and the menus each one serves." actions={can("branches.edit") ? <Button onClick={() => setCreateOpen(true)} data-cy="branch-new"><Plus /> New branch</Button> : null} />
      {!branches || branches.length === 0 ? <EmptyState title="No branches yet" description="Add your first branch to start taking orders." /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
          <ul className="space-y-2">
            {branches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4" data-cy={`branch-${b.id}`}>
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
          <MapView className="h-80 lg:h-auto" pins={branches.filter((b) => b.lat !== null && b.lng !== null).map((b) => ({ id: b.id, lat: b.lat!, lng: b.lng!, label: b.name, muted: !b.isActive || b.isPaused }))} />
        </div>
      )}
      <SimpleFormDialog open={createOpen} onOpenChange={setCreateOpen} title="New branch" fields={branchFields} onSubmit={async (v) => { await m.create.mutateAsync({ ...v, menuIds: menus?.map((x) => x.id) ?? [] }) }} />
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
