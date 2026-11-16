import { format, formatDistanceToNow } from "date-fns"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/PageHeader"
import { Money } from "@/components/shared/Money"
import { Pagination } from "@/components/shared/Pagination"
import { SearchInput } from "@/components/shared/SearchInput"
import { EmptyState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { usePlatformMutations, usePlatformOnline, usePlatformOverview, usePlatformRestaurants } from "@/hooks/useAdminMisc"
import { useDebouncedSearch } from "@/hooks/useDebounce"

export default function PlatformPage() {
  const { data: overview } = usePlatformOverview()
  const { data: online } = usePlatformOnline()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const term = useDebouncedSearch(search)
  useEffect(() => setPage(1), [term])
  const { data, isLoading } = usePlatformRestaurants({ page, search: term || undefined })
  const m = usePlatformMutations()
  const tiles: Array<[string, number]> = overview ? [["Restaurants", overview.restaurants], ["New this week", overview.newThisWeek], ["Active staff", overview.staff], ["Customers", overview.customers], ["Orders (24h)", overview.ordersLast24h]] : []
  return (
    <div data-cy="platform-page">
      <PageHeader title="Platform" description="Every restaurant on Kiros, sign-ups and who is online." />
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([l, v]) => <Card key={l}><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{l}</p><p className="font-display text-2xl font-semibold">{v}</p></CardContent></Card>)}
        {overview ? <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Revenue (24h)</p><p className="font-display text-2xl font-semibold"><Money value={overview.revenueLast24h} /></p></CardContent></Card> : null}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <SearchInput value={search} onChange={setSearch} placeholder="Restaurant, slug or email" className="mb-3 w-72" dataCy="platform-search" />
          {isLoading ? <Skeleton className="h-64" /> : !data || data.data.length === 0 ? <EmptyState title="No restaurants" /> : (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Restaurant</TableHead><TableHead>Owner</TableHead><TableHead>Branches</TableHead><TableHead>Orders</TableHead><TableHead>Paid revenue</TableHead><TableHead>Joined</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {data.data.map((r) => (
                    <TableRow key={r.id} data-cy={`restaurant-${r.id}`}>
                      <TableCell><p className="font-medium">{r.name}</p><a href={`/${r.slug}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">/{r.slug}</a>{r.isSuspended ? <Badge variant="danger" className="ml-2">Suspended</Badge> : null}</TableCell>
                      <TableCell className="text-sm">{r.ownerName ?? "—"}<span className="block text-xs text-muted-foreground">{r.ownerEmail}</span></TableCell>
                      <TableCell>{r.branchCount}</TableCell>
                      <TableCell>{r.orderCount}</TableCell>
                      <TableCell><Money value={r.paidRevenue} /></TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(r.createdAt), "d MMM yyyy")}</TableCell>
                      <TableCell className="text-right">{r.isSuspended ? <Button size="sm" variant="outline" onClick={() => m.unsuspend.mutate(r.id, { onError: (e) => toast.error(e.message) })} data-cy="unsuspend">Reinstate</Button> : <Button size="sm" variant="ghost" className="text-destructive" onClick={() => m.suspend.mutate(r.id, { onError: (e) => toast.error(e.message) })} data-cy="suspend">Suspend</Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination meta={data.meta} onPageChange={setPage} />
            </>
          )}
        </div>
        <Card>
          <CardHeader><CardTitle>Online now ({online?.length ?? 0})</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(online ?? []).map((u) => <li key={u.userId}><p className="font-medium">{u.name} <span className="text-xs text-muted-foreground">· {u.roleName}</span></p><p className="text-xs text-muted-foreground">{u.restaurantName} · {u.device} · active {formatDistanceToNow(new Date(u.lastActiveAt), { addSuffix: true })}</p></li>)}
              {(online ?? []).length === 0 ? <li className="text-muted-foreground">Nobody is online.</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
