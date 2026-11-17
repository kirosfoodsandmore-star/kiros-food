import { LocateFixed, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { SimpleFormDialog } from "@/components/admin/SimpleFormDialog"
import { ZoneDialog } from "@/components/admin/ZoneDialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { MapView } from "@/components/shared/MapView"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { ErrorState } from "@/components/shared/States"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { useBranch, useBranchMutations } from "@/hooks/useAdminBranches"
import { useMenus } from "@/hooks/useAdminMenu"
import { roundCoord, lowAccuracyNote, useCurrentPosition } from "@/hooks/useCurrentPosition"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { WEEKDAYS } from "@/lib/utils"
import type { DeliveryZone, OpeningHourRow } from "@/types/admin.types"
import { branchFields } from "./BranchesPage"

type DayHours = { closed: boolean; opensAt: string; closesAt: string }

export default function BranchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fmt = useAdminCurrency()
  const { can } = useAuth()
  const edit = can("branches.edit")
  const { data: branch, isLoading, error, refetch } = useBranch(id)
  const { data: menus } = useMenus()
  const m = useBranchMutations()
  const [editOpen, setEditOpen] = useState(false)
  const [zoneDialog, setZoneDialog] = useState<{ open: boolean; zone?: DeliveryZone }>({ open: false })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [hours, setHours] = useState<DayHours[]>([])
  // Days ticked for "set these together" (0 = Sunday), and the times to give them.
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [bulk, setBulk] = useState({ opensAt: "09:00", closesAt: "21:00" })
  const [closure, setClosure] = useState({ date: "", reason: "" })
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number }>()
  const { locate, locating } = useCurrentPosition()
  const fail = (e: Error) => toast.error(e.message)

  /** Pin the branch where this device is right now (for someone standing at the branch), and show it on the map. */
  const setToMyLocation = () =>
    locate((fix) => {
      if (!branch) return
      setFlyTo({ lat: fix.lat, lng: fix.lng, zoom: 16 })
      m.update.mutate(
        { id: branch.id, body: { lat: roundCoord(fix.lat), lng: roundCoord(fix.lng) } },
        {
          onSuccess: () => {
            toast.success("Location set to where you are")
            const note = lowAccuracyNote(fix)
            if (note) toast.warning(note)
          },
          onError: fail,
        }
      )
    })

  useEffect(() => {
    if (!branch) return
    setHours(WEEKDAYS.map((_, weekday) => {
      const row = branch.hours.find((h) => h.weekday === weekday)
      return row ? { closed: false, opensAt: row.opensAt, closesAt: row.closesAt } : { closed: true, opensAt: "09:00", closesAt: "21:00" }
    }))
    setPicked(new Set())
  }, [branch])

  if (isLoading) return <PageLoader />
  if (error || !branch) return <ErrorState message="Branch not found." onRetry={() => void refetch()} />

  const saveHours = () => {
    const rows: OpeningHourRow[] = hours.flatMap((h, weekday) => (h.closed ? [] : [{ weekday, opensAt: h.opensAt, closesAt: h.closesAt }]))
    m.setHours.mutate({ id: branch.id, hours: rows }, { onSuccess: () => toast.success("Opening hours saved"), onError: fail })
  }
  // Several days at once: tick them, then give them the same hours (or close them). The change lands in the form;
  // nothing is saved until "Save hours".
  const allDays = WEEKDAYS.map((_, i) => i)
  const pickDays = (days: number[]) => setPicked(new Set(days))
  const togglePick = (day: number) => setPicked((s) => { const next = new Set(s); if (next.has(day)) next.delete(day); else next.add(day); return next })
  const applyToPicked = (patch: Partial<DayHours>, message: string) => {
    setHours((s) => s.map((x, i) => (picked.has(i) ? { ...x, ...patch } : x)))
    toast.success(`${message} for ${picked.size} ${picked.size === 1 ? "day" : "days"}. Press Save hours to keep it.`)
  }
  const setPickedHours = () => {
    if (!bulk.opensAt || !bulk.closesAt) return toast.error("Choose an opening and a closing time")
    applyToPicked({ closed: false, opensAt: bulk.opensAt, closesAt: bulk.closesAt }, `Set ${bulk.opensAt}–${bulk.closesAt}`)
  }
  const toggleMenu = (menuId: string, on: boolean) => {
    const menuIds = on ? [...branch.menuIds, menuId] : branch.menuIds.filter((x) => x !== menuId)
    m.update.mutate({ id: branch.id, body: { menuIds } }, { onError: fail })
  }

  return (
    <div data-cy="branch-detail-page">
      <PageHeader title={branch.name} description={`${branch.city} · ${branch.address}`} actions={edit ? <><Button variant="outline" onClick={() => setEditOpen(true)} data-cy="branch-edit">Edit details</Button><Button variant="ghost" className="text-destructive" onClick={() => setDeleteOpen(true)} data-cy="branch-delete"><Trash2 /> Delete</Button></> : null} />
      <p className="mb-3 text-sm"><Link to="/admin/branches" className="text-primary hover:underline">← All branches</Link></p>
      <Tabs defaultValue="hours">
        <TabsList><TabsTrigger value="hours" data-cy="tab-hours">Opening hours</TabsTrigger><TabsTrigger value="location" data-cy="tab-location">Location</TabsTrigger><TabsTrigger value="zones" data-cy="tab-zones">Delivery zones</TabsTrigger><TabsTrigger value="menus" data-cy="tab-menus">Menus</TabsTrigger><TabsTrigger value="closures" data-cy="tab-closures">Closures</TabsTrigger></TabsList>

        <TabsContent value="hours">
          <Card>
            <CardContent className="space-y-2 pt-5">
              {edit ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2 text-xs text-muted-foreground">
                  <label className="flex items-center gap-2">
                    <Checkbox checked={picked.size === allDays.length ? true : picked.size > 0 ? "indeterminate" : false} onCheckedChange={() => pickDays(picked.size === allDays.length ? [] : allDays)} aria-label="Select all days" data-cy="hours-select-all" />
                    {picked.size > 0 ? `${picked.size} of ${allDays.length} days selected` : "Tick days to set them together"}
                  </label>
                  <span className="ml-auto flex gap-3">
                    <button type="button" className="text-primary hover:underline" onClick={() => pickDays([1, 2, 3, 4, 5])} data-cy="hours-pick-weekdays">Weekdays</button>
                    <button type="button" className="text-primary hover:underline" onClick={() => pickDays([0, 6])} data-cy="hours-pick-weekend">Weekends</button>
                  </span>
                </div>
              ) : null}
              {edit && picked.size > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm" data-cy="hours-bulk">
                  <Input type="time" value={bulk.opensAt} onChange={(e) => setBulk((b) => ({ ...b, opensAt: e.target.value }))} aria-label="Opens at, for the selected days" className="w-32" />
                  <span className="text-muted-foreground">to</span>
                  <Input type="time" value={bulk.closesAt} onChange={(e) => setBulk((b) => ({ ...b, closesAt: e.target.value }))} aria-label="Closes at, for the selected days" className="w-32" />
                  <Button size="sm" onClick={setPickedHours} data-cy="hours-bulk-apply">Set hours</Button>
                  <Button size="sm" variant="outline" onClick={() => applyToPicked({ closed: true }, "Marked closed")} data-cy="hours-bulk-close">Mark closed</Button>
                  <Button size="sm" variant="ghost" onClick={() => pickDays([])} data-cy="hours-bulk-clear">Clear</Button>
                  <p className="basis-full text-xs text-muted-foreground">Applies to the {picked.size === 1 ? "day" : `${picked.size} days`} ticked below. Press Save hours to keep the changes.</p>
                </div>
              ) : null}
              {hours.map((h, weekday) => (
                // Mobile: day + checkbox on one line, the time range on the next. sm+: a single row.
                <div key={weekday} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 border-b pb-2 text-sm last:border-0 sm:border-0 sm:pb-0 ${edit ? "sm:grid-cols-[8.5rem_auto_minmax(0,1fr)]" : "sm:grid-cols-[6rem_auto_minmax(0,1fr)]"} ${picked.has(weekday) ? "rounded-md bg-primary/5" : ""}`} data-cy={`hours-${weekday}`}>
                  {edit ? (
                    <label className="flex items-center gap-2 font-medium">
                      <Checkbox checked={picked.has(weekday)} onCheckedChange={() => togglePick(weekday)} aria-label={`Select ${WEEKDAYS[weekday]}`} data-cy="hours-select" />
                      {WEEKDAYS[weekday]}
                    </label>
                  ) : <span className="font-medium">{WEEKDAYS[weekday]}</span>}
                  <label className="flex items-center gap-2"><Checkbox checked={!h.closed} disabled={!edit} onCheckedChange={(v) => setHours((s) => s.map((x, i) => (i === weekday ? { ...x, closed: v !== true } : x)))} aria-label={`${WEEKDAYS[weekday]} open`} /> Open</label>
                  <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                    <Input type="time" value={h.opensAt} disabled={h.closed || !edit} onChange={(e) => setHours((s) => s.map((x, i) => (i === weekday ? { ...x, opensAt: e.target.value } : x)))} aria-label={`${WEEKDAYS[weekday]} opens at`} className="min-w-0 flex-1" />
                    <span className="text-muted-foreground">to</span>
                    <Input type="time" value={h.closesAt} disabled={h.closed || !edit} onChange={(e) => setHours((s) => s.map((x, i) => (i === weekday ? { ...x, closesAt: e.target.value } : x)))} aria-label={`${WEEKDAYS[weekday]} closes at`} className="min-w-0 flex-1" />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">A closing time earlier than the opening time means past midnight. Timezone: {branch.timezone}.</p>
              {edit ? <Button onClick={saveHours} loading={m.setHours.isPending} data-cy="hours-save">Save hours</Button> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="location">
          <Card>
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{edit ? "Click the map or drag the pin to set the exact location used for distance sorting and delivery zones." : "Branch location."}</p>
                {edit ? (
                  <Button variant="outline" size="sm" onClick={setToMyLocation} loading={locating || m.update.isPending} data-cy="location-current">
                    {locating || m.update.isPending ? null : <LocateFixed />} Use my current location
                  </Button>
                ) : null}
              </div>
              <MapView
                className="h-80"
                flyTo={flyTo}
                pins={branch.lat !== null && branch.lng !== null ? [{ id: branch.id, lat: branch.lat, lng: branch.lng, label: branch.name, selected: true }] : []}
                center={branch.lat !== null && branch.lng !== null ? { lat: branch.lat, lng: branch.lng } : undefined}
                zoom={branch.lat !== null ? 14 : 10}
                onPick={edit ? (pos) => m.update.mutate({ id: branch.id, body: { lat: pos.lat, lng: pos.lng } }, { onSuccess: () => toast.success("Location saved"), onError: fail }) : undefined}
              />
              <p className="text-xs text-muted-foreground">{branch.lat !== null ? `${branch.lat.toFixed(5)}, ${branch.lng?.toFixed(5)}` : "No location set"}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zones">
          <Card>
            <CardHeader className="flex-row items-center justify-between"><CardTitle>Delivery zones</CardTitle>{edit ? <Button size="sm" onClick={() => setZoneDialog({ open: true })} data-cy="zone-new"><Plus /> Add zone</Button> : null}</CardHeader>
            <CardContent className="space-y-3">
              {branch.lat === null ? <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning" role="status">Set this branch's location first (Location tab). Delivery distances are measured from its map pin, so zones can't work without it.</p> : null}
              {branch.zones.length === 0 ? (
                <div className="space-y-3 rounded-lg border border-dashed p-5 text-center">
                  <p className="text-sm text-muted-foreground">No zones yet, so customers can't order delivery from this branch. A zone says how far you deliver and what it costs.</p>
                  {edit ? <Button size="sm" onClick={() => setZoneDialog({ open: true })} data-cy="zone-first"><Plus /> Add your first zone</Button> : null}
                </div>
              ) : (
                <>
                <p className="text-xs text-muted-foreground">Each customer is matched to the smallest zone that covers their distance from the branch. Anyone beyond your largest zone can't order delivery.</p>
                <ul className="divide-y text-sm">
                  {[...branch.zones].sort((a, b) => a.maxDistanceKm - b.maxDistanceKm).map((z) => (
                    <li key={z.id} className="flex items-center gap-3 py-2" data-cy={`zone-${z.id}`}>
                      <div className="flex-1">
                        <p className="font-medium">{z.name}{!z.isActive ? " (off)" : ""}</p>
                        <p className="text-muted-foreground">≤ {z.maxDistanceKm} km · fee <Money value={z.fee} fmt={fmt} /> · min <Money value={z.minOrder} fmt={fmt} />{z.freeAboveAmount !== null ? <> · free above <Money value={z.freeAboveAmount} fmt={fmt} /></> : null}{z.extraMinutes ? ` · +${z.extraMinutes} min` : ""}</p>
                      </div>
                      {edit ? <><Button variant="ghost" size="sm" onClick={() => setZoneDialog({ open: true, zone: z })}>Edit</Button><Button variant="ghost" size="icon-sm" onClick={() => m.deleteZone.mutate({ id: branch.id, zoneId: z.id }, { onError: fail })} aria-label="Delete zone"><Trash2 className="text-destructive" /></Button></> : null}
                    </li>
                  ))}
                </ul>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menus">
          <Card>
            <CardHeader><CardTitle>Menus served here</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(menus ?? []).map((menu) => (
                <label key={menu.id} className="flex items-center gap-3 text-sm" data-cy={`serve-menu-${menu.id}`}>
                  <Checkbox checked={branch.menuIds.includes(menu.id)} disabled={!edit || m.update.isPending} onCheckedChange={(v) => toggleMenu(menu.id, v === true)} /> {menu.name}
                </label>
              ))}
              {(menus ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Create a menu first.</p> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="closures">
          <Card>
            <CardHeader><CardTitle>Holiday closures</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {edit ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Date"><Input type="date" value={closure.date} onChange={(e) => setClosure({ ...closure, date: e.target.value })} data-cy="closure-date" /></Field>
                  <Field label="Reason"><Input value={closure.reason} onChange={(e) => setClosure({ ...closure, reason: e.target.value })} placeholder="Public holiday" data-cy="closure-reason" /></Field>
                  <Button disabled={!closure.date} loading={m.addClosure.isPending} onClick={() => m.addClosure.mutate({ id: branch.id, date: closure.date, reason: closure.reason || null }, { onSuccess: () => setClosure({ date: "", reason: "" }), onError: fail })} data-cy="closure-add">Add</Button>
                </div>
              ) : null}
              <ul className="divide-y text-sm">
                {branch.closures.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2"><span className="flex-1">{c.date}{c.reason ? ` · ${c.reason}` : ""}</span>{edit ? <Button variant="ghost" size="icon-sm" onClick={() => m.removeClosure.mutate({ id: branch.id, closureId: c.id })} aria-label="Remove closure"><Trash2 className="text-destructive" /></Button> : null}</li>
                ))}
                {branch.closures.length === 0 ? <li className="py-2 text-muted-foreground">No upcoming closures.</li> : null}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SimpleFormDialog open={editOpen} onOpenChange={setEditOpen} title="Edit branch" fields={branchFields} initial={branch as unknown as Record<string, unknown>} onSubmit={async (v) => { await m.update.mutateAsync({ id: branch.id, body: v }) }} />
      <ZoneDialog
        open={zoneDialog.open}
        onOpenChange={(o) => setZoneDialog({ open: o })}
        zone={zoneDialog.zone}
        others={branch.zones.filter((z) => z.id !== zoneDialog.zone?.id)}
        onSubmit={async (body) => { if (zoneDialog.zone) await m.updateZone.mutateAsync({ id: branch.id, zoneId: zoneDialog.zone.id, body: { ...body } }); else await m.createZone.mutateAsync({ id: branch.id, body: { ...body } }) }}
      />
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={`Delete ${branch.name}?`} description="Past orders are kept; the branch disappears from the storefront." confirmLabel="Delete" loading={m.remove.isPending} onConfirm={async () => { try { await m.remove.mutateAsync(branch.id); navigate("/admin/branches") } catch (e) { fail(e as Error) } }} />
    </div>
  )
}
