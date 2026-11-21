import { format } from "date-fns"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { BranchSelect } from "@/components/admin/BranchSelect"
import { PageHeader } from "@/components/layout/PageHeader"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { Money } from "@/components/shared/Money"
import { Pagination } from "@/components/shared/Pagination"
import { SearchInput } from "@/components/shared/SearchInput"
import { EmptyState, ErrorState } from "@/components/shared/States"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAdminOrders, useLiveOrderInvalidation } from "@/hooks/useAdminOrders"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { useAdminBranch } from "@/hooks/useAdminBranch"
import { usePersistedState } from "@/hooks/usePersistedState"
import { ORDER_STATUS_LABELS } from "@/lib/enums"
import type { OrderStatus } from "@/types/store.types"

export default function OrdersPage() {
  const fmt = useAdminCurrency()
  useLiveOrderInvalidation()
  const [branchId, setBranchId] = useAdminBranch()
  const [status, setStatus] = usePersistedState<string>("kiros.admin.orders.status", "")
  const [range, setRange] = useState({ from: "", to: "" })
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const term = useDebouncedSearch(search)
  useEffect(() => setPage(1), [term, status, branchId, range])
  const { data, isLoading, error, refetch } = useAdminOrders({ page, search: term || undefined, branchId: branchId || undefined, status: status || undefined, from: range.from || undefined, to: range.to || undefined })

  return (
    <div data-cy="orders-page">
      <PageHeader title="Orders" />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Order number, phone, name" className="col-span-2 sm:w-64" dataCy="orders-search" />
        <BranchSelect value={branchId} onChange={setBranchId} allowAll className="w-full sm:w-44" />
        <Select value={status || "__all"} onValueChange={(v) => setStatus(v === "__all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-48" data-cy="orders-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All statuses</SelectItem>
            {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="col-span-2 sm:contents"><DateRangeFilter from={range.from} to={range.to} onChange={setRange} /></div>
      </div>
      {isLoading ? <Skeleton className="h-64" /> : error || !data ? <ErrorState message="Orders could not be loaded." onRetry={() => void refetch()} /> : data.data.length === 0 ? <EmptyState title="No orders match" /> : (
        <>
          {/* Phones and tablets: one tappable card per order. lg+ (sidebar layout): the full table. */}
          <ul className="divide-y overflow-hidden rounded-xl border bg-card lg:hidden" data-cy="orders-cards">
            {data.data.map((o) => (
              <li key={o.id}>
                <Link to={`/admin/orders/${o.id}`} className="block space-y-1 p-3 hover:bg-muted/40" data-cy={`order-card-${o.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{o.number}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{o.customerName ?? "—"} <span className="text-muted-foreground">{o.customerPhone}</span></span>
                    <Money value={o.total} fmt={fmt} className="shrink-0 font-medium" />
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(o.createdAt), "d MMM, HH:mm")} · {o.branchName} · <span className="capitalize">{o.fulfilment}</span></p>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">
          <Table>
            <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Placed</TableHead><TableHead>Branch</TableHead><TableHead>Customer</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.data.map((o) => (
                <TableRow key={o.id} data-cy={`order-row-${o.id}`}>
                  <TableCell className="whitespace-nowrap"><Link to={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.number}</Link></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(o.createdAt), "d MMM, HH:mm")}</TableCell>
                  <TableCell>{o.branchName}</TableCell>
                  <TableCell>{o.customerName ?? "—"}<span className="block text-xs text-muted-foreground">{o.customerPhone}</span></TableCell>
                  <TableCell className="capitalize">{o.fulfilment}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-right"><Money value={o.total} fmt={fmt} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
