// Staff (invite, edit role/branches, deactivate) and roles (permission matrix, custom roles).
import { format } from "date-fns"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { PageLoader } from "@/components/shared/PageLoader"
import { EmptyState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/shared/Pagination"
import { SearchInput } from "@/components/shared/SearchInput"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { Field } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { useBranches } from "@/hooks/useAdminBranches"
import { useInvites, usePermissions, useRoles, useStaffList, useStaffMutations } from "@/hooks/useStaff"
import type { PermissionDef, Role, Staff } from "@/types/admin.types"

type BranchOption = { id: string; name: string }

export default function StaffPage() {
  const { can, session } = useAuth()
  const manage = can("staff.manage")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const term = useDebouncedSearch(search)
  useEffect(() => setPage(1), [term])
  const { data: staff, isLoading } = useStaffList({ page, search: term || undefined })
  // Invitations and roles are for people who manage staff; everyone else only sees the staff list.
  const { data: invites } = useInvites(manage)
  const { data: roles } = useRoles(manage)
  const { data: branches } = useBranches()
  const { data: permissions } = usePermissions(manage)
  const m = useStaffMutations()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; role?: Role }>({ open: false })
  const [deactivate, setDeactivate] = useState<Staff | null>(null)
  const [deleteRole, setDeleteRole] = useState<Role | null>(null)
  const fail = (e: Error) => toast.error(e.message)
  const pendingInvites = invites?.filter((i) => i.status === "pending").length ?? 0

  if (isLoading) return <PageLoader />
  return (
    <div data-cy="staff-page">
      <PageHeader title={manage ? "Staff & roles" : "Staff"} description={manage ? "A person has one role and a list of branches (or all). Only an Owner can manage staff and payment settings." : "The people who work in your branches."} actions={manage ? <Button onClick={() => setInviteOpen(true)} data-cy="staff-invite"><Plus /> Invite staff</Button> : null} />
      <Tabs defaultValue="staff">
        <TabsList><TabsTrigger value="staff" data-cy="tab-staff">Staff</TabsTrigger>{manage ? <TabsTrigger value="invites" data-cy="tab-invites">Invites{pendingInvites ? ` (${pendingInvites})` : ""}</TabsTrigger> : null}{manage ? <TabsTrigger value="roles" data-cy="tab-roles">Roles</TabsTrigger> : null}</TabsList>

        <TabsContent value="staff">
          <SearchInput value={search} onChange={setSearch} placeholder="Name or email" className="mb-3 w-72" dataCy="staff-search" />
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Branches</TableHead><TableHead>Last seen</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(staff?.data ?? []).map((s) => (
                <TableRow key={s.id} data-cy={`staff-${s.id}`}>
                  <TableCell><p className="font-medium">{s.name}{s.id === session?.user.id ? " (you)" : ""}</p><p className="text-xs text-muted-foreground">{s.email}</p></TableCell>
                  <TableCell>{s.roleName}</TableCell>
                  <TableCell className="text-sm">{s.allBranches ? "All branches" : s.branchNames.join(", ") || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.lastSeenAt ? format(new Date(s.lastSeenAt), "d MMM, HH:mm") : "Never"}</TableCell>
                  <TableCell>{s.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Deactivated</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {manage && s.id !== session?.user.id ? (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(s)} aria-label="Edit"><Pencil /></Button>
                        {s.isActive ? <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeactivate(s)} data-cy="staff-deactivate">Deactivate</Button> : <Button variant="ghost" size="sm" onClick={() => m.activate.mutate(s.id, { onError: fail })} data-cy="staff-activate">Reactivate</Button>}
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && staff?.data.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{term ? "No staff match your search." : "No staff yet."}</p> : null}
          <Pagination meta={staff?.meta} onPageChange={setPage} />
        </TabsContent>

        {manage ? <TabsContent value="invites">
          {!invites || invites.length === 0 ? <EmptyState title="No invitations yet" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Invitee</TableHead><TableHead>Role</TableHead><TableHead>Sent by</TableHead><TableHead>Expires</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {invites.map((i) => (
                  <TableRow key={i.id} data-cy={`invite-${i.id}`}>
                    <TableCell><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{i.email}</p></TableCell>
                    <TableCell>{i.roleName}</TableCell>
                    <TableCell>{i.invitedByName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(i.expiresAt), "d MMM, HH:mm")}</TableCell>
                    <TableCell><Badge variant={i.status === "pending" ? "warning" : i.status === "accepted" ? "success" : "neutral"}>{i.status}</Badge></TableCell>
                    <TableCell className="text-right">{manage && i.status !== "accepted" ? <div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => m.resendInvite.mutate(i.id, { onSuccess: () => toast.success("Invitation resent"), onError: fail })} data-cy="invite-resend">Resend</Button>{i.status === "pending" ? <Button variant="ghost" size="sm" className="text-destructive" onClick={() => m.revokeInvite.mutate(i.id, { onError: fail })} data-cy="invite-revoke">Revoke</Button> : null}</div> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent> : null}

        {manage ? <TabsContent value="roles">
          <div className="mb-3 flex justify-end">{manage ? <Button variant="outline" onClick={() => setRoleDialog({ open: true })} data-cy="role-new"><Plus /> Custom role</Button> : null}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {(roles ?? []).map((r) => (
              <Card key={r.id} data-cy={`role-${r.id}`}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div><CardTitle>{r.name}{r.isLocked ? <Badge variant="primary" className="ml-2">Owner</Badge> : r.isPreset ? <Badge variant="outline" className="ml-2">Preset</Badge> : null}</CardTitle><p className="text-xs text-muted-foreground">{r.description} · {r.memberCount} member{r.memberCount === 1 ? "" : "s"}</p></div>
                  {manage && !r.isLocked ? <div className="flex gap-0.5"><Button variant="ghost" size="icon-sm" onClick={() => setRoleDialog({ open: true, role: r })} aria-label="Edit role"><Pencil /></Button>{!r.isPreset ? <Button variant="ghost" size="icon-sm" onClick={() => setDeleteRole(r)} aria-label="Delete role"><Trash2 className="text-destructive" /></Button> : null}</div> : null}
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1">
                  {r.permissions.includes("*") ? <Badge variant="primary">Every permission</Badge> : r.permissions.map((p) => <Badge key={p} variant="neutral">{p}</Badge>)}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent> : null}
      </Tabs>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} roles={roles ?? []} branches={branches ?? []} onSubmit={async (v) => { await m.invite.mutateAsync(v); toast.success("Invitation sent") }} />
      <EditStaffDialog staff={editing} onClose={() => setEditing(null)} roles={roles ?? []} branches={branches ?? []} onSubmit={async (v) => { await m.update.mutateAsync({ id: editing!.id, body: v }); toast.success("Saved") }} />
      <RoleDialog open={roleDialog.open} onOpenChange={(o) => setRoleDialog({ open: o })} role={roleDialog.role} permissions={permissions ?? []} grantable={session?.permissions ?? []} onSubmit={async (v) => { if (roleDialog.role) await m.updateRole.mutateAsync({ id: roleDialog.role.id, body: v }); else await m.createRole.mutateAsync(v) }} />
      <ConfirmDialog open={Boolean(deactivate)} onOpenChange={(o) => !o && setDeactivate(null)} title={`Deactivate ${deactivate?.name}?`} description="Their sessions end immediately; their history stays in the audit log." confirmLabel="Deactivate" loading={m.deactivate.isPending} onConfirm={async () => { await m.deactivate.mutateAsync(deactivate!.id).catch(fail); setDeactivate(null) }} />
      <ConfirmDialog open={Boolean(deleteRole)} onOpenChange={(o) => !o && setDeleteRole(null)} title={`Delete role ${deleteRole?.name}?`} confirmLabel="Delete" loading={m.deleteRole.isPending} onConfirm={async () => { await m.deleteRole.mutateAsync(deleteRole!.id).catch(fail); setDeleteRole(null) }} />
    </div>
  )
}

function BranchAssignment({ allBranches, branchIds, branches, onChange }: { allBranches: boolean; branchIds: string[]; branches: BranchOption[]; onChange: (v: { allBranches: boolean; branchIds: string[] }) => void }) {
  return (
    <Field label="Branches">
      <label className="flex items-center gap-2 text-sm"><Switch checked={allBranches} onCheckedChange={(v) => onChange({ allBranches: v, branchIds })} data-cy="all-branches" /> All branches</label>
      {!allBranches ? <div className="mt-2 grid gap-1 sm:grid-cols-2">{branches.map((b) => <label key={b.id} className="flex items-center gap-2 text-sm"><Checkbox checked={branchIds.includes(b.id)} onCheckedChange={(v) => onChange({ allBranches, branchIds: v === true ? [...branchIds, b.id] : branchIds.filter((x) => x !== b.id) })} data-cy={`branch-${b.id}`} /> {b.name}</label>)}</div> : null}
    </Field>
  )
}

function InviteDialog({ open, onOpenChange, roles, branches, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; roles: Role[]; branches: BranchOption[]; onSubmit: (v: Record<string, unknown>) => Promise<void> }) {
  const empty = { name: "", email: "", roleId: "", allBranches: false, branchIds: [] as string[] }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!form.name || !form.email || !form.roleId) return toast.error("Name, email and role are required")
    setBusy(true)
    try { await onSubmit(form); onOpenChange(false); setForm(empty) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-cy="invite-dialog">
        <DialogHeader><DialogTitle>Invite staff</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-cy="invite-name" /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-cy="invite-email" /></Field>
          <Field label="Role"><Select value={form.roleId} onValueChange={(v) => setForm({ ...form, roleId: v })}><SelectTrigger data-cy="invite-role"><SelectValue placeholder="Choose a role" /></SelectTrigger><SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></Field>
          <BranchAssignment allBranches={form.allBranches} branchIds={form.branchIds} branches={branches} onChange={(v) => setForm({ ...form, ...v })} />
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} loading={busy} data-cy="invite-send">Send invitation</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditStaffDialog({ staff, onClose, roles, branches, onSubmit }: { staff: Staff | null; onClose: () => void; roles: Role[]; branches: BranchOption[]; onSubmit: (v: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ name: "", roleId: "", allBranches: false, branchIds: [] as string[] })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (staff) setForm({ name: staff.name, roleId: staff.roleId, allBranches: staff.allBranches, branchIds: staff.branchIds })
  }, [staff])
  return (
    <Dialog open={Boolean(staff)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-cy="edit-staff-dialog">
        <DialogHeader><DialogTitle>Edit {staff?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Role"><Select value={form.roleId} onValueChange={(v) => setForm({ ...form, roleId: v })}><SelectTrigger data-cy="edit-role"><SelectValue /></SelectTrigger><SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></Field>
          <BranchAssignment allBranches={form.allBranches} branchIds={form.branchIds} branches={branches} onChange={(v) => setForm({ ...form, ...v })} />
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={async () => { setBusy(true); try { await onSubmit(form); onClose() } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) } }} data-cy="edit-staff-save">Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoleDialog({ open, onOpenChange, role, permissions, grantable, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; role?: Role; permissions: PermissionDef[]; grantable: string[]; onSubmit: (v: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setName(role?.name ?? "")
      setDescription(role?.description ?? "")
      setSelected(role?.permissions ?? [])
    }
  }, [open, role])
  const canGrant = (code: string) => grantable.includes("*") || grantable.includes(code)
  const categories = [...new Set(permissions.map((p) => p.category))]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-cy="role-dialog">
        <DialogHeader><DialogTitle>{role ? `Edit ${role.name}` : "New custom role"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} data-cy="role-name" /></Field>
          <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} data-cy="role-description" /></Field>
        </div>
        <div className="max-h-[50dvh] space-y-3 overflow-y-auto pr-1">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</p>
              {permissions.filter((p) => p.category === cat).map((p) => (
                <label key={p.code} className={`flex items-start gap-2 py-1 text-sm ${canGrant(p.code) ? "" : "opacity-50"}`} title={canGrant(p.code) ? undefined : "You cannot grant a permission you do not hold"}>
                  <Checkbox checked={selected.includes(p.code)} disabled={!canGrant(p.code)} onCheckedChange={(v) => setSelected((s) => (v === true ? [...s, p.code] : s.filter((x) => x !== p.code)))} data-cy={`perm-${p.code}`} />
                  <span><span className="font-mono text-xs">{p.code}</span><br /><span className="text-muted-foreground">{p.label}</span></span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={busy} disabled={!name.trim()} onClick={async () => { setBusy(true); try { await onSubmit({ name, description: description || null, permissions: selected }); onOpenChange(false); toast.success("Role saved") } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) } }} data-cy="role-save">Save role</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
