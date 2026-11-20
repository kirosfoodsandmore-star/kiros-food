import { ChevronDown, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { ErrorState } from "@/components/shared/States"
import { CategoryTabs } from "@/components/store/CategoryTabs"
import { ItemCard } from "@/components/store/ItemCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useStore } from "@/contexts/StoreContext"
import { useCart } from "@/hooks/useCart"
import { useBranchMenus, useStoreBranches, useStoreMenu } from "@/hooks/useStore"
import { cn } from "@/lib/utils"
import { useStoreSession } from "@/stores/storeSession"

export default function MenuPage() {
  const { slug, fmt } = useStore()
  const location = useLocation()
  const { branchId, menuId, setMenu, open } = useStoreSession()
  const { data: branches } = useStoreBranches(slug)
  const branch = branches?.find((b) => b.id === branchId)
  const { data: menus } = useBranchMenus(slug, branchId)
  const activeMenuId = menuId && menus?.some((m) => m.id === menuId) ? menuId : (menus?.[0]?.id ?? null)
  useEffect(() => {
    if (activeMenuId && activeMenuId !== menuId) setMenu(activeMenuId)
  }, [activeMenuId, menuId, setMenu])
  const { data: menu, isLoading, error, refetch } = useStoreMenu(slug, activeMenuId, branchId)
  const { cart, clear } = useCart()
  // Categories whose items are all hidden in admin (e.g. one waiting on a recipe) stay off the storefront.
  const categories = (menu?.categories ?? []).filter((c) => c.items.length > 0)
  const [clearOpen, setClearOpen] = useState(false)

  useEffect(() => {
    if (menu && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [menu, location.hash])


  if (!branchId) {
    return (
      <div className="py-12 text-center" data-cy="menu-no-branch">
        <p className="text-muted-foreground">Choose a branch to see its menu.</p>
        <Button className="mt-3" onClick={() => open("branch")} data-cy="menu-choose-branch">
          Choose a branch
        </Button>
      </div>
    )
  }

  return (
    <div className="py-4" data-cy="menu-page">
      <section className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-4">
        {/* The min-width makes the controls wrap onto their own row on phones instead of crushing the branch name. */}
        <div className="min-w-[min(100%,16rem)] flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Ordering from</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{branch?.name ?? "…"}</h1>
            {branch ? <span className={cn("text-xs font-medium", branch.isOpen ? "text-success" : "text-destructive")}>{branch.isOpen ? `Open till ${branch.closesAt}` : "Closed · scheduled orders only"}</span> : null}
            <button type="button" onClick={() => open("branch")} className="text-sm text-primary hover:underline" data-cy="menu-change-branch">
              Change branch
            </button>
          </div>
        </div>
        {menus && menus.length > 1 ? (
          <button type="button" onClick={() => open("menu")} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted" data-cy="menu-pill">
            {menu?.name ?? "Menu"} <ChevronDown className="size-4" />
          </button>
        ) : null}
        {/* Secondary actions travel together and stay right-aligned when the row wraps. */}
        <div className="ml-auto flex items-center gap-1">
          {cart && cart.lines.length > 0 ? (
            <Button variant="ghost" size="icon-sm" onClick={() => setClearOpen(true)} aria-label="Clear bag" data-cy="menu-clear-cart">
              <Trash2 />
            </Button>
          ) : null}
        </div>
      </section>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : error || !menu ? (
        <ErrorState message="The menu could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <CategoryTabs categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
          <div className="space-y-10 pt-4">
            {categories.length === 0 ? <p className="text-sm text-muted-foreground">Nothing on this menu right now.</p> : null}
            {categories.map((c) => (
              <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-28" data-cy={`category-section-${c.id}`}>
                <h2 className="text-xl font-semibold">{c.name}</h2>
                {c.description ? <p className="text-sm text-muted-foreground">{c.description}</p> : null}
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {c.items.map((item) => (
                    <ItemCard key={item.id} item={item} slug={slug} fmt={fmt} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      <ConfirmDialog open={clearOpen} onOpenChange={setClearOpen} title="Clear your bag?" description="Everything in your bag will be removed." confirmLabel="Clear" loading={clear.isPending} onConfirm={async () => { await clear.mutateAsync(); setClearOpen(false); toast.success("Bag cleared") }} />
    </div>
  )
}
