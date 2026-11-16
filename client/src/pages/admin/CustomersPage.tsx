import { format } from "date-fns"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/PageHeader"
import { Money } from "@/components/shared/Money"
import { Pagination } from "@/components/shared/Pagination"
import { SearchInput } from "@/components/shared/SearchInput"
import { EmptyState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { useCustomerMutations, useCustomers } from "@/hooks/useAdminMisc"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { useAdminCurrency } from "@/hooks/useFormatters"

export default function CustomersPage() {
  const fmt = useAdminCurrency()
  const { can } = useAuth()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const term = useDebouncedSearch(search)
  useEffect(() => setPage(1), [term])
  const { data, isLoading } = useCustomers({ page, search: term || undefined })
  const { block, unblock } = useCustomerMutations()
  const [blockId, setBlockId] = useState<string | null>(null)
  const [reason, setReason] = useState("")

  return (
    <div data-cy="customers-page">
      <PageHeader title="Customers" description={can("customers.view_contact") ? undefined : "Contact details are masked for your role."} />
      <SearchInput value={search} onChange={setSearch} placeholder="Phone, name or email" className="mb-4 w-72" dataCy="customers-search" />
      {isLoading ? <Skeleton className="h-64" /> : !data || data.data.length === 0 ? <EmptyState title="No customers yet" /> : (
        <>
          <Table>
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Orders</TableHead><TableHead>Total spend</TableHead><TableHead>Last order</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {data.data.map((c) => (
                <TableRow key={c.id} data-cy={`customer-${c.id}`}>
                  <TableCell><p className="font-medium">{c.name ?? "—"}</p><p className="text-xs text-muted-foreground">{c.phone ?? "—"}{c.email ? ` · ${c.email}` : ""}</p></TableCell>
                  <TableCell>{c.orderCount}</TableCell>
                  <TableCell><Money value={c.totalSpend} fmt={fmt} /></TableCell>
                  <TableCell className="text-muted-foreground">{c.lastOrderAt ? format(new Date(c.lastOrderAt), "d MMM yyyy") : "—"}</TableCell>
                  <TableCell>{c.isBlocked ? <Badge variant="danger">Blocked{c.blockReason ? ` · ${c.blockReason}` : ""}</Badge> : <Badge variant="success">Active</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {can("customers.block") ? (c.isBlocked ? <Button size="sm" variant="outline" onClick={() => unblock.mutate(c.id, { onError: (e) => toast.error(e.message) })} data-cy="customer-unblock">Unblock</Button> : <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setBlockId(c.id)} data-cy="customer-block">Block</Button>) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      )}
      <Dialog open={Boolean(blockId)} onOpenChange={(o) => !o && setBlockId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Block this customer</DialogTitle></DialogHeader>
          <Field label="Reason (internal)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} data-cy="block-reason" /></Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlockId(null)}>Cancel</Button>
            <Button variant="destructive" loading={block.isPending} onClick={() => block.mutate({ id: blockId!, reason: reason || undefined }, { onSuccess: () => { setBlockId(null); setReason("") }, onError: (e) => toast.error(e.message) })} data-cy="block-confirm">Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
