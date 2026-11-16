// Full-screen branch picker: list grouped by city on the left, Mapbox pins on the right.
import { LocateFixed, MapPin } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { MapView } from "@/components/shared/MapView"
import { SearchInput } from "@/components/shared/SearchInput"
import { EmptyState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useStore } from "@/contexts/StoreContext"
import { useCart } from "@/hooks/useCart"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { useStoreBranches } from "@/hooks/useStore"
import { useStoreSession } from "@/stores/storeSession"
import type { StoreBranch } from "@/types/store.types"

export function BranchPicker() {
  const { slug } = useStore()
  const { overlay, close, open, branchId } = useStoreSession()
  const { switchBranch } = useCart()
  const [q, setQ] = useState("")
  const [at, setAt] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const search = useDebouncedSearch(q)
  const { data: branches, isLoading } = useStoreBranches(slug, at, search)

  const groups = useMemo(() => {
    const map = new Map<string, StoreBranch[]>()
    for (const b of branches ?? []) map.set(b.city, [...(map.get(b.city) ?? []), b])
    return [...map.entries()]
  }, [branches])

  const locate = () => {
    if (!navigator.geolocation) return toast.error("Location is not available in this browser")
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAt({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        toast.error("Could not read your location")
        setLocating(false)
      },
      { timeout: 10_000 }
    )
  }

  const choose = (b: StoreBranch) => {
    switchBranch.mutate({ branchId: b.id, menuId: b.menus[0]?.id ?? null }, { onSuccess: () => toast.success(`Ordering from ${b.name}`) })
    close()
  }

  return (
    <Sheet open={overlay === "branch"} onOpenChange={(o) => (o ? open("branch") : close())}>
      <SheetContent side="full" className="p-0" data-cy="branch-picker">
        <SheetHeader className="shrink-0">
          <SheetTitle>Find a branch</SheetTitle>
          <p className="text-sm text-muted-foreground">Choose where to order from. Opening hours and delivery areas differ per branch.</p>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 md:grid-cols-[minmax(0,26rem)_1fr]">
          <div className="flex min-h-0 flex-col border-r">
            <div className="flex gap-2 p-3">
              <SearchInput value={q} onChange={setQ} placeholder="Search by area or branch" className="flex-1" dataCy="branch-search" />
              <Button variant="outline" onClick={locate} loading={locating} aria-label="Use my current location" data-cy="branch-locate">
                <LocateFixed />
                <span className="hidden sm:inline">Near me</span>
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : groups.length === 0 ? (
                <EmptyState title="No branches found" description="Try another area or clear the search." icon={<MapPin className="size-8" />} />
              ) : (
                groups.map(([city, list]) => (
                  <section key={city} className="mb-4">
                    <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{city}</h3>
                    <ul className="space-y-2">
                      {list.map((b) => (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => choose(b)}
                            className={`w-full rounded-xl border p-3 text-left transition hover:border-primary ${b.id === branchId ? "border-primary bg-secondary/40" : ""}`}
                            data-cy={`branch-row-${b.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium">{b.name}</p>
                                <p className="truncate text-sm text-muted-foreground">{b.address}</p>
                              </div>
                              <Badge variant={b.isOpen ? "success" : "danger"}>{b.isOpen ? `Open · till ${b.closesAt}` : b.isPaused ? "Paused" : "Closed"}</Badge>
                            </div>
                            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                              {b.distanceKm !== null ? <span>{b.distanceKm} km away</span> : null}
                              <span>{[b.deliveryEnabled && "Delivery", b.pickupEnabled && "Pickup"].filter(Boolean).join(" · ")}</span>
                              {!b.isOpen && b.nextOpenAt ? <span>Opens {new Date(b.nextOpenAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span> : null}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </div>
          <div className="hidden min-h-0 p-3 md:block">
            <MapView
              className="h-full"
              pins={(branches ?? []).filter((b) => b.lat !== null && b.lng !== null).map((b) => ({ id: b.id, lat: b.lat!, lng: b.lng!, label: b.name, selected: b.id === branchId, muted: !b.isOpen }))}
              onPinClick={(id) => {
                const b = branches?.find((x) => x.id === id)
                if (b) choose(b)
              }}
              center={at ?? undefined}
              zoom={at ? 12 : 10}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
