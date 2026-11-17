import { Copy, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { SimpleFormDialog, type FieldDef } from "@/components/admin/SimpleFormDialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { EmptyState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { useMenuMutations, useOptionGroups } from "@/hooks/useAdminMenu"
import { useAdminCurrency } from "@/hooks/useFormatters"
import type { Option, OptionGroup } from "@/types/admin.types"
import { plural } from "@/lib/utils"

const groupFields: FieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "helpText", label: "Help text", type: "text", hint: "Shown under the group name, e.g. “Up to three”." },
  { name: "minSelect", label: "Minimum selections (0 = optional)", type: "number", default: 0 },
  { name: "maxSelect", label: "Maximum selections", type: "number", default: 1 },
]
const optionFields: FieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "priceDelta", label: "Price change (negative allowed)", type: "money", default: "0" },
  { name: "isActive", label: "Available", type: "switch", default: true },
]

export default function OptionGroupsPage() {
  const fmt = useAdminCurrency()
  const { can } = useAuth()
  const edit = can("menu.edit")
  const { data: groups, isLoading } = useOptionGroups()
  const m = useMenuMutations()
  const [groupDialog, setGroupDialog] = useState<{ open: boolean; group?: OptionGroup }>({ open: false })
  // `draft` is a copy of an existing option, opened as a new one to rename and save.
  const [optionDialog, setOptionDialog] = useState<{ open: boolean; groupId?: string; option?: Option; draft?: Record<string, unknown> }>({ open: false })
  const [del, setDel] = useState<{ kind: "group" | "option"; groupId: string; id: string; name: string } | null>(null)

  // Copies the group and all its options, then opens the copy so it can be renamed and adjusted straight away.
  const duplicateGroup = async (g: OptionGroup) => {
    try {
      const copy = (await m.duplicateGroup.mutateAsync(g.id)) as OptionGroup
      toast.success(`Copied as “${copy.name}”. Rename it or change its options.`)
      setGroupDialog({ open: true, group: copy })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (isLoading) return <PageLoader />
  return (
    <div data-cy="option-groups-page">
      <PageHeader title="Option groups" description="Reusable choices (size, sugar level, toppings…). Attach a group to many items from the item editor." actions={edit ? <Button onClick={() => setGroupDialog({ open: true })} data-cy="group-new"><Plus /> New group</Button> : null} />
      {!groups || groups.length === 0 ? <EmptyState title="No option groups yet" /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.id} data-cy={`group-${g.id}`}>
              <CardHeader className="flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle>{g.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{g.minSelect > 0 ? "Required" : "Optional"} · choose {g.minSelect === g.maxSelect ? g.maxSelect : `${g.minSelect}–${g.maxSelect}`} · used by {plural(g.itemCount ?? 0, "item")}</p>
                  {g.helpText ? <p className="text-xs text-muted-foreground">{g.helpText}</p> : null}
                </div>
                {edit ? (
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon-sm" onClick={() => setGroupDialog({ open: true, group: g })} aria-label="Edit group" title="Edit group" data-cy="group-edit"><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => void duplicateGroup(g)} disabled={m.duplicateGroup.isPending} aria-label="Duplicate group" title="Duplicate group (with all its options)" data-cy="group-duplicate"><Copy /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDel({ kind: "group", groupId: g.id, id: g.id, name: g.name })} aria-label="Delete group" title="Delete group" data-cy="group-delete"><Trash2 className="text-destructive" /></Button>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {g.options.map((o) => (
                    <li key={o.id} className="flex items-center gap-2 py-1.5" data-cy={`option-${o.id}`}>
                      <span className="flex-1">{o.name}{!o.isActive ? <Badge variant="neutral" className="ml-2">Off</Badge> : null}</span>
                      <span className="text-muted-foreground">{o.priceDelta === 0 ? "—" : <>{o.priceDelta > 0 ? "+" : "−"}<Money value={Math.abs(o.priceDelta)} fmt={fmt} /></>}</span>
                      {edit ? (
                        <>
                          <Button variant="ghost" size="icon-sm" onClick={() => setOptionDialog({ open: true, groupId: g.id, option: o })} aria-label="Edit option" title="Edit option"><Pencil /></Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setOptionDialog({ open: true, groupId: g.id, draft: { name: `${o.name} (copy)`, priceDelta: o.priceDelta, isActive: o.isActive } })} aria-label="Duplicate option" title="Duplicate option" data-cy="option-duplicate"><Copy /></Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setDel({ kind: "option", groupId: g.id, id: o.id, name: o.name })} aria-label="Delete option" title="Delete option"><Trash2 className="text-destructive" /></Button>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {edit ? <Button variant="outline" size="sm" className="mt-2" onClick={() => setOptionDialog({ open: true, groupId: g.id })} data-cy="option-new"><Plus /> Add option</Button> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <SimpleFormDialog open={groupDialog.open} onOpenChange={(o) => setGroupDialog({ open: o })} title={groupDialog.group ? "Edit option group" : "New option group"} fields={groupFields} initial={groupDialog.group as unknown as Record<string, unknown> | undefined} onSubmit={async (v) => { if (groupDialog.group) await m.updateGroup.mutateAsync({ id: groupDialog.group.id, body: v }); else await m.createGroup.mutateAsync(v) }} />
      <SimpleFormDialog open={optionDialog.open} onOpenChange={(o) => setOptionDialog({ open: o })} title={optionDialog.option ? "Edit option" : optionDialog.draft ? "Duplicate option" : "New option"} fields={optionFields} initial={(optionDialog.option as unknown as Record<string, unknown> | undefined) ?? optionDialog.draft} onSubmit={async (v) => { if (optionDialog.option) await m.updateOption.mutateAsync({ groupId: optionDialog.groupId!, optionId: optionDialog.option.id, body: v }); else await m.createOption.mutateAsync({ groupId: optionDialog.groupId!, body: v }) }} />
      <ConfirmDialog open={Boolean(del)} onOpenChange={(o) => !o && setDel(null)} title={`Delete “${del?.name}”?`} confirmLabel="Delete" loading={m.deleteGroup.isPending || m.deleteOption.isPending} onConfirm={async () => { if (!del) return; try { if (del.kind === "group") await m.deleteGroup.mutateAsync(del.id); else await m.deleteOption.mutateAsync({ groupId: del.groupId, optionId: del.id }) } catch (e) { toast.error((e as Error).message) } setDel(null) }} />
    </div>
  )
}
