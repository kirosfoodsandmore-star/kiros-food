// Menus → categories → items, with dialogs for each. Reordering uses up/down buttons.
import { ArrowDown, ArrowUp, Camera, ImagePlus, Pencil, Plus, Star, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ItemEditorDialog } from "@/components/admin/ItemEditorDialog"
import { ItemPhotosDialog } from "@/components/admin/ItemPhotos"
import { SimpleFormDialog, type FieldDef } from "@/components/admin/SimpleFormDialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { EmptyState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { useCategories, useItems, useMenuMutations, useMenus } from "@/hooks/useAdminMenu"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { usePersistedState } from "@/hooks/usePersistedState"
import { cn, plural } from "@/lib/utils"
import type { Category, Item, Menu } from "@/types/admin.types"

const menuFields: FieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  { name: "isActive", label: "Visible on the storefront", type: "switch", default: true },
]
const categoryFields: FieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
]

export default function MenusPage() {
  const fmt = useAdminCurrency()
  const { can } = useAuth()
  const edit = can("menu.edit")
  const m = useMenuMutations()
  const { data: menus, isLoading } = useMenus()
  const [menuId, setMenuId] = usePersistedState<string>("kiros.admin.menu", "")
  const activeMenu = menus?.find((x) => x.id === menuId) ?? menus?.[0]
  const { data: categories } = useCategories(activeMenu?.id)
  const { data: items } = useItems(activeMenu ? { menuId: activeMenu.id } : {})
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const activeCategory = categories?.find((c) => c.id === categoryId) ?? categories?.[0]
  const visibleItems = useMemo(() => (items ?? []).filter((i) => i.categoryId === activeCategory?.id), [items, activeCategory?.id])

  const [menuDialog, setMenuDialog] = useState<{ open: boolean; menu?: Menu }>({ open: false })
  const [catDialog, setCatDialog] = useState<{ open: boolean; category?: Category }>({ open: false })
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: Item }>({ open: false })
  const [del, setDel] = useState<{ kind: "menu" | "category" | "item"; id: string; name: string } | null>(null)
  const [photoItemId, setPhotoItemId] = useState<string | null>(null)
  const fail = (e: Error) => toast.error(e.message)

  const move = (list: { id: string }[], id: string, dir: -1 | 1, fn: (ids: string[]) => void) => {
    const ids = list.map((x) => x.id)
    const i = ids.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    fn(ids)
  }

  if (isLoading) return <PageLoader />
  return (
    <div data-cy="menus-page">
      <PageHeader title="Menus" description="Menus hold categories; categories hold items. Edits reach the storefront within a minute." actions={edit ? <Button onClick={() => setMenuDialog({ open: true })} data-cy="menu-new"><Plus /> New menu</Button> : null} />
      {!menus || menus.length === 0 ? <EmptyState title="No menus yet" description="Create your first menu to start adding items." /> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={activeMenu?.id} onValueChange={setMenuId}>
              <TabsList>{menus.map((x) => <TabsTrigger key={x.id} value={x.id} data-cy={`menu-tab-${x.id}`}>{x.name}{!x.isActive ? " (hidden)" : ""}</TabsTrigger>)}</TabsList>
            </Tabs>
            {activeMenu && edit ? (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => setMenuDialog({ open: true, menu: activeMenu })} aria-label="Edit menu" data-cy="menu-edit"><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setDel({ kind: "menu", id: activeMenu.id, name: activeMenu.name })} aria-label="Delete menu" data-cy="menu-delete"><Trash2 className="text-destructive" /></Button>
              </div>
            ) : null}
            {activeMenu ? <span className="ml-auto text-xs text-muted-foreground">{activeMenu.branchIds.length === 0 ? "Not available at any branch yet" : `Available at ${activeMenu.branchIds.length} ${activeMenu.branchIds.length === 1 ? "branch" : "branches"}`}</span> : null}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">Categories {edit ? <Button variant="ghost" size="icon-sm" onClick={() => setCatDialog({ open: true })} aria-label="Add category" data-cy="category-new"><Plus /></Button> : null}</div>
              <ul className="p-1">
                {(categories ?? []).map((c, i) => (
                  <li key={c.id} className={cn("group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm", activeCategory?.id === c.id && "bg-muted")}>
                    <button type="button" className="flex-1 truncate text-left" onClick={() => setCategoryId(c.id)} data-cy={`category-${c.id}`}>{c.name} <span className="text-xs text-muted-foreground">({c.itemCount})</span></button>
                    {edit ? (
                      <span className="hidden gap-0.5 group-hover:flex">
                        <button type="button" onClick={() => move(categories ?? [], c.id, -1, (ids) => m.reorderCategories.mutate(ids))} disabled={i === 0} aria-label="Move up"><ArrowUp className="size-3.5" /></button>
                        <button type="button" onClick={() => move(categories ?? [], c.id, 1, (ids) => m.reorderCategories.mutate(ids))} disabled={i === (categories?.length ?? 0) - 1} aria-label="Move down"><ArrowDown className="size-3.5" /></button>
                        <button type="button" onClick={() => setCatDialog({ open: true, category: c })} aria-label="Edit category"><Pencil className="size-3.5" /></button>
                        <button type="button" onClick={() => setDel({ kind: "category", id: c.id, name: c.name })} aria-label="Delete category"><Trash2 className="size-3.5 text-destructive" /></button>
                      </span>
                    ) : null}
                  </li>
                ))}
                {(categories ?? []).length === 0 ? <li className="p-3 text-xs text-muted-foreground">No categories yet.</li> : null}
              </ul>
            </aside>
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">{activeCategory?.name ?? "Items"}</h2>
                {edit && activeCategory ? <Button size="sm" onClick={() => setItemDialog({ open: true })} data-cy="item-new"><Plus /> New item</Button> : null}
              </div>
              {visibleItems.length === 0 ? <EmptyState title="No items in this category" /> : (
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleItems.map((it, i) => (
                    <li key={it.id} className="flex gap-3 rounded-xl border bg-card p-3" data-cy={`item-${it.id}`}>
                      <ItemThumb item={it} editable={edit} onClick={() => setPhotoItemId(it.id)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-medium leading-tight">{it.name}</p>
                          {it.isFeatured ? <Star className="size-4 shrink-0 fill-accent text-accent" /> : null}
                        </div>
                        <p className="text-sm"><Money value={it.basePrice} fmt={fmt} /></p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {!it.isActive ? <Badge variant="neutral">Hidden</Badge> : null}
                          {it.optionGroupIds.length > 0 ? <Badge variant="outline">{plural(it.optionGroupIds.length, "option group")}</Badge> : null}
                        </div>
                        {edit ? (
                          <div className="mt-2 flex gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => setItemDialog({ open: true, item: it })} aria-label="Edit item" data-cy="item-edit"><Pencil /></Button>
                            <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(visibleItems, it.id, -1, (ids) => m.reorderItems.mutate(ids))} aria-label="Move up"><ArrowUp /></Button>
                            <Button variant="ghost" size="icon-sm" disabled={i === visibleItems.length - 1} onClick={() => move(visibleItems, it.id, 1, (ids) => m.reorderItems.mutate(ids))} aria-label="Move down"><ArrowDown /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setDel({ kind: "item", id: it.id, name: it.name })} aria-label="Delete item" data-cy="item-delete"><Trash2 className="text-destructive" /></Button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      <ItemPhotosDialog item={items?.find((i) => i.id === photoItemId) ?? null} onOpenChange={(o) => !o && setPhotoItemId(null)} />
      <SimpleFormDialog open={menuDialog.open} onOpenChange={(o) => setMenuDialog({ open: o })} title={menuDialog.menu ? "Edit menu" : "New menu"} fields={menuFields} initial={menuDialog.menu as unknown as Record<string, unknown> | undefined} onSubmit={async (v) => { if (menuDialog.menu) await m.updateMenu.mutateAsync({ id: menuDialog.menu.id, body: v }); else { const created = (await m.createMenu.mutateAsync(v)) as Menu; setMenuId(created.id) } }} />
      <SimpleFormDialog open={catDialog.open} onOpenChange={(o) => setCatDialog({ open: o })} title={catDialog.category ? "Edit category" : "New category"} fields={categoryFields} initial={catDialog.category as unknown as Record<string, unknown> | undefined} onSubmit={async (v) => { if (catDialog.category) await m.updateCategory.mutateAsync({ id: catDialog.category.id, body: v }); else await m.createCategory.mutateAsync({ ...v, menuId: activeMenu!.id }) }} />
      {activeCategory ? <ItemEditorDialog open={itemDialog.open} onOpenChange={(o) => setItemDialog({ open: o })} item={itemDialog.item ? items?.find((i) => i.id === itemDialog.item?.id) ?? itemDialog.item : undefined} categories={categories ?? []} defaultCategoryId={activeCategory.id} /> : null}
      <ConfirmDialog open={Boolean(del)} onOpenChange={(o) => !o && setDel(null)} title={`Delete ${del?.kind} “${del?.name}”?`} description="It will be removed from the storefront." confirmLabel="Delete" loading={m.deleteMenu.isPending || m.deleteCategory.isPending || m.deleteItem.isPending} onConfirm={async () => { if (!del) return; const fn = del.kind === "menu" ? m.deleteMenu : del.kind === "category" ? m.deleteCategory : m.deleteItem; await fn.mutateAsync(del.id).catch(fail); setDel(null) }} />
    </div>
  )
}

/**
 * The item's picture, doubling as the way to manage its photos. It has to look clickable: an empty item shows a
 * dashed "Add photos" tile, and one with photos carries a camera badge (with the count when there are several).
 */
function ItemThumb({ item, editable, onClick }: { item: Item; editable: boolean; onClick: () => void }) {
  const cover = item.images[0]?.url ?? item.imageUrl
  const count = item.images.length
  const frame = "relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted"
  if (!editable) return <div className={frame}>{cover ? <img src={cover} alt="" className="size-full object-cover" /> : <ImagePlus className="m-auto mt-7 size-5 text-muted-foreground" />}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(frame, "transition hover:ring-2 hover:ring-primary/60", !cover && "border-2 border-dashed border-input hover:border-primary hover:text-primary")}
      aria-label={count > 0 ? `Manage photos (${count})` : "Add photos"}
      title={count > 0 ? "Add or change photos" : "Add photos"}
      data-cy="item-photo"
    >
      {cover ? (
        <>
          <img src={cover} alt="" className="size-full object-cover" />
          <span className="absolute bottom-1 right-1 flex items-center gap-1 rounded-full bg-background/90 px-1.5 py-1 text-[11px] font-medium leading-none shadow">
            <Camera className="size-3.5" aria-hidden />
            {count > 1 ? count : null}
          </span>
        </>
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground">
          <ImagePlus className="size-5" aria-hidden />
          Add photos
        </span>
      )}
    </button>
  )
}
