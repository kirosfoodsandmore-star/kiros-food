// "Which collection?" — shown when a branch serves more than one menu. Each option is a card with its artwork,
// name and description; the active one is checked.
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useStore } from "@/contexts/StoreContext"
import { useBranchMenus } from "@/hooks/useStore"
import { useStoreSession } from "@/stores/storeSession"
import { COLLECTION_PALETTES, FoodArt } from "./FoodArt"

export function MenuSwitcher() {
  const { slug } = useStore()
  const { overlay, close, open, branchId, menuId, setMenu } = useStoreSession()
  const { data: menus } = useBranchMenus(slug, branchId)
  // Until someone picks, the first collection is the one on screen.
  const active = menuId && menus?.some((m) => m.id === menuId) ? menuId : menus?.[0]?.id
  return (
    <Dialog open={overlay === "menu"} onOpenChange={(o) => (o ? open("menu") : close())}>
      <DialogContent className="sm:max-w-md" data-cy="menu-switcher">
        <DialogHeader>
          <DialogTitle>Choose a collection</DialogTitle>
          <DialogDescription>Your branch serves more than one. Whatever you add goes in the same order.</DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={active}
          className="gap-2.5"
          onValueChange={(v) => {
            setMenu(v)
            close()
          }}
        >
          {(menus ?? []).map((m, i) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-4 rounded-2xl border p-3 transition-all hover:border-primary/50 hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-secondary/50 has-[[data-state=checked]]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
              data-cy={`menu-option-${m.id}`}
            >
              <span className="block size-14 shrink-0 overflow-hidden rounded-xl">
                <FoodArt name={m.name} hint={m.description} imageUrl={m.imageUrl} palette={COLLECTION_PALETTES[i % COLLECTION_PALETTES.length]} iconClassName="size-1/2" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display font-semibold leading-tight">{m.name}</span>
                {m.description ? <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{m.description}</span> : null}
              </span>
              <RadioGroupItem value={m.id} className="shrink-0" />
            </label>
          ))}
        </RadioGroup>
      </DialogContent>
    </Dialog>
  )
}
