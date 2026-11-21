import { format } from "date-fns"
import { useEffect, useState } from "react"
import { BranchSelect } from "@/components/admin/BranchSelect"
import { PageHeader } from "@/components/layout/PageHeader"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { Pagination } from "@/components/shared/Pagination"
import { SearchInput } from "@/components/shared/SearchInput"
import { EmptyState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuditLog } from "@/hooks/useAdminMisc"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { useAdminBranch } from "@/hooks/useAdminBranch"

export default function AuditLogPage() {
  const [branchId, setBranchId] = useAdminBranch()
  const [search, setSearch] = useState("")
  const [range, setRange] = useState({ from: "", to: "" })
  const [page, setPage] = useState(1)
  const term = useDebouncedSearch(search)
  useEffect(() => setPage(1), [term, branchId, range])
  const { data, isLoading } = useAuditLog({ page, search: term || undefined, branchId: branchId || undefined, from: range.from || undefined, to: range.to || undefined })
  return (
    <div data-cy="audit-page">
      <PageHeader title="Audit log" description="Who changed prices, availability, order status, settings and staff — and when." />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Summary or staff name" className="w-full sm:w-64" dataCy="audit-search" />
        <BranchSelect value={branchId} onChange={setBranchId} allowAll className="w-full sm:w-44" />
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
      </div>
      {isLoading ? <Skeleton className="h-64" /> : !data || data.data.length === 0 ? <EmptyState title="No entries" /> : (
        <>
          {/* Phones/small tablets: the summary gets the full width. md+: the full table. */}
          <ul className="divide-y rounded-xl border bg-card md:hidden" data-cy="audit-cards">
            {data.data.map((a) => (
              <li key={a.id} className="space-y-1 p-3" data-cy={`audit-card-${a.id}`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <Badge variant="outline">{a.action}</Badge>
                  <span>{a.entityType}</span>
                  <span className="ml-auto whitespace-nowrap">{format(new Date(a.createdAt), "d MMM, HH:mm:ss")}</span>
                </div>
                <p className="text-sm wrap-break-word">{a.summary}</p>
                <p className="text-xs text-muted-foreground">{a.userName ?? "System"}</p>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Summary</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.data.map((a) => (
                <TableRow key={a.id} data-cy={`audit-${a.id}`}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(a.createdAt), "d MMM, HH:mm:ss")}</TableCell>
                  <TableCell>{a.userName ?? "System"}</TableCell>
                  <TableCell><Badge variant="outline">{a.action}</Badge> <span className="text-xs text-muted-foreground">{a.entityType}</span></TableCell>
                  <TableCell className="min-w-56">{a.summary}</TableCell>
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
