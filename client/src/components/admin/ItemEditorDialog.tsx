// Item create/edit: name, category, price, description, flags, and which option groups attach (ordered).
import { ArrowDown, ArrowUp, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ItemPhotosPanel } from "@/components/admin/ItemPhotos"
import { PhotoUploader, type PhotoEntry } from "@/components/admin/PhotoUploader"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { useMenuMutations, useOptionGroups } from "@/hooks/useAdminMenu"
import { toMajor, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { Category, Item } from "@/types/admin.types"

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  item?: Item
  categories: Category[]
  defaultCategoryId: string
}

const blank = (categoryId: string) => ({ name: "", categoryId, basePrice: "0", description: "", isFeatured: false, isActive: true, optionGroupIds: [] as string[], pairsWithCategoryIds: [] as string[] })

export function ItemEditorDialog({ open, onOpenChange, item, categories, defaultCategoryId }: Props) {
  const { can } = useAuth()
  const canPrice = can("menu.edit_prices")
  const { data: groups } = useOptionGroups()
  const { createItem, updateItem, addItemPhotos } = useMenuMutations()
  const [form, setForm] = useState(blank(defaultCategoryId))
  const [addGroup, setAddGroup] = useState("")
  // A new item has no id yet to upload against, so its photos wait here and go up right after it's created.
  const [staged, setStaged] = useState<Array<PhotoEntry & { file: File }>>([])

  const clearStaged = () =>
    setStaged((list) => {
      for (const s of list) URL.revokeObjectURL(s.url)
      return []
    })

  // Reset only when opening or switching item. `item` itself changes whenever a photo is added or removed
  // (its photo list refreshes), and that must not wipe what's been typed into the form.
  useEffect(() => {
    if (!open) return
    setForm(item ? { name: item.name, categoryId: item.categoryId, basePrice: toMajor(item.basePrice), description: item.description ?? "", isFeatured: item.isFeatured, isActive: item.isActive, optionGroupIds: item.optionGroupIds, pairsWithCategoryIds: item.pairsWithCategoryIds ?? [] } : blank(defaultCategoryId))
    clearStaged()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id, defaultCategoryId])

  const stage = (files: File[]) => setStaged((list) => [...list, ...files.map((file) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(file), file }))])
  const unstage = (id: string) =>
    setStaged((list) => {
      const gone = list.find((s) => s.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return list.filter((s) => s.id !== id)
    })
  const stagedCover = (id: string) => setStaged((list) => [...list.filter((s) => s.id === id), ...list.filter((s) => s.id !== id)])

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name is required")
    const body: Record<string, unknown> = { name: form.name.trim(), categoryId: form.categoryId, description: form.description || null, isFeatured: form.isFeatured, isActive: form.isActive, optionGroupIds: form.optionGroupIds, pairsWithCategoryIds: form.pairsWithCategoryIds.filter((id) => id !== form.categoryId) }
    if (canPrice || !item) body.basePrice = toMinor(form.basePrice)
    try {
      if (item) await updateItem.mutateAsync({ id: item.id, body })
      else {
        const created = await createItem.mutateAsync(body)
        if (staged.length > 0) {
          try {
            await addItemPhotos.mutateAsync({ id: (created as Item).id, files: staged.map((s) => s.file) })
          } catch (err) {
            // The item is saved; only the photos failed, so say that and let them retry from the item card.
            toast.error(`Item saved, but its photos didn't upload: ${(err as Error).message}. Add them from the item card.`)
            clearStaged()
            onOpenChange(false)
            return
          }
        }
      }
      clearStaged()
      toast.success("Saved")
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const moveGroup = (id: string, dir: -1 | 1) => {
    const ids = [...form.optionGroupIds]
    const i = ids.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    setForm((f) => ({ ...f, optionGroupIds: ids }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" data-cy="item-editor">
        <DialogHeader><DialogTitle>{item ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <Field label="Name" className="sm:col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-cy="item-name" /></Field>
          <Field label="Category">
            <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
              <SelectTrigger data-cy="item-category"><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Base price" hint={canPrice ? undefined : "You cannot change prices"}><Input inputMode="decimal" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} disabled={!canPrice && Boolean(item)} data-cy="item-price" /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-cy="item-description" /></Field>
          <Field label="Photos" hint={item ? "Photos save as soon as you add or remove them." : "Photos upload when you save the item."} className="sm:col-span-2">
            {item ? <ItemPhotosPanel item={item} /> : <PhotoUploader photos={staged} busy={createItem.isPending || addItemPhotos.isPending} onAdd={stage} onRemove={unstage} onMakeCover={stagedCover} />}
          </Field>
          <label className="flex items-center gap-3 text-sm"><Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} data-cy="item-featured" /> Featured on the home page</label>
          <label className="flex items-center gap-3 text-sm"><Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} data-cy="item-active" /> Visible on the storefront</label>
          <Field label="Option groups (in display order)" className="sm:col-span-2">
            <ul className="space-y-1">
              {form.optionGroupIds.map((id, i) => {
                const g = groups?.find((x) => x.id === id)
                return (
                  <li key={id} className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm" data-cy={`item-group-${id}`}>
                    <span className="flex-1">{g?.name ?? "…"} <span className="text-xs text-muted-foreground">{g ? `${g.minSelect}–${g.maxSelect}` : ""}</span></span>
                    <button type="button" onClick={() => moveGroup(id, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="size-4" /></button>
                    <button type="button" onClick={() => moveGroup(id, 1)} disabled={i === form.optionGroupIds.length - 1} aria-label="Move down"><ArrowDown className="size-4" /></button>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, optionGroupIds: f.optionGroupIds.filter((x) => x !== id) }))} aria-label="Remove group"><X className="size-4 text-destructive" /></button>
                  </li>
                )
              })}
            </ul>
            <div className="mt-2 flex gap-2">
              <Select value={addGroup} onValueChange={setAddGroup}>
                <SelectTrigger data-cy="item-add-group"><SelectValue placeholder="Attach an option group" /></SelectTrigger>
                <SelectContent>{(groups ?? []).filter((g) => !form.optionGroupIds.includes(g.id)).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="outline" disabled={!addGroup} onClick={() => { setForm((f) => ({ ...f, optionGroupIds: [...f.optionGroupIds, addGroup] })); setAddGroup("") }} data-cy="item-add-group-btn">Add</Button>
            </div>
          </Field>
          <Field label="Goes well with" hint="Customers see these under “Goes well with” on this item's page, e.g. Smoothies and Juices for a salad. Leave empty to suggest favourites from other categories." className="sm:col-span-2">
            {categories.filter((c) => c.id !== form.categoryId).length === 0 ? (
              <p className="text-sm text-muted-foreground">Add another category to suggest items from it.</p>
            ) : (
              <div className="flex flex-wrap gap-2" data-cy="item-pairs">
                {categories.filter((c) => c.id !== form.categoryId).map((c) => {
                  const on = form.pairsWithCategoryIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setForm((f) => ({ ...f, pairsWithCategoryIds: on ? f.pairsWithCategoryIds.filter((x) => x !== c.id) : [...f.pairsWithCategoryIds, c.id] }))}
                      className={cn("rounded-full border px-3 py-1 text-sm transition", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                      data-cy={`item-pairs-${c.id}`}
                    >
                      {c.name}
                    </button>
                  )
                })}
              </div>
            )}
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={createItem.isPending || updateItem.isPending} data-cy="item-save">Save item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
