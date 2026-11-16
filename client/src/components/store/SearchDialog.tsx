import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Money } from "@/components/shared/Money"
import { SearchInput } from "@/components/shared/SearchInput"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useStore } from "@/contexts/StoreContext"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { useStoreSearch } from "@/hooks/useStore"
import { useStoreSession } from "@/stores/storeSession"

export function SearchDialog() {
  const { slug, fmt } = useStore()
  const navigate = useNavigate()
  const { overlay, close, open, branchId, menuId } = useStoreSession()
  const [q, setQ] = useState("")
  const term = useDebouncedSearch(q)
  const { data, isLoading } = useStoreSearch(slug, branchId, term, menuId)
  return (
    <Dialog open={overlay === "search"} onOpenChange={(o) => (o ? open("search") : close())}>
      <DialogContent className="top-[10%] translate-y-0 sm:max-w-lg" data-cy="search-dialog">
        <DialogHeader>
          <DialogTitle>Search the menu</DialogTitle>
        </DialogHeader>
        {!branchId ? (
          <p className="text-sm text-muted-foreground">Choose a branch first.</p>
        ) : (
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search products…" autoFocus dataCy="menu-search" />
            <div className="max-h-[50dvh] overflow-y-auto">
              {isLoading && term ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : data && data.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nothing matches “{term}”.</p>
              ) : (
                <ul className="divide-y">
                  {(data ?? []).map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 py-2 text-left hover:bg-muted"
                        onClick={() => {
                          close()
                          navigate(`/${slug}/item/${item.id}`)
                        }}
                        data-cy={`search-result-${item.id}`}
                      >
                        <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">{item.imageUrl ? <img src={item.imageUrl} alt="" className="size-full object-cover" /> : null}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        <span className="text-sm font-medium">
                          {item.hasPricedVariants ? "From " : ""}
                          <Money value={item.fromPrice} fmt={fmt} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
