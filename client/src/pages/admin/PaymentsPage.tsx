import { format, formatDistanceToNow } from "date-fns"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { BranchSelect } from "@/components/admin/BranchSelect"
import { PageHeader } from "@/components/layout/PageHeader"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { Pagination } from "@/components/shared/Pagination"
import { EmptyState } from "@/components/shared/States"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { useLiveOrderInvalidation, usePaymentMutations, usePaymentQueue } from "@/hooks/useAdminOrders"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { usePersistedState } from "@/hooks/usePersistedState"

export default function PaymentsPage() {
  const fmt = useAdminCurrency()
  const { can } = useAuth()
  useLiveOrderInvalidation()
  const [branchId, setBranchId] = usePersistedState<string>("kiros.admin.branch", "")
  const [status, setStatus] = useState<"claimed" | "pending" | "all">("claimed")
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [branchId, status])
  const { data: res, isLoading } = usePaymentQueue({ branchId: branchId || undefined, status, page })
  const data = res?.data
  const { confirm, reject } = usePaymentMutations()
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reason, setReason] = useState("")

  return (
    <div data-cy="payments-page">
      <PageHeader title="Payments to confirm" description="Bank transfers customers say they have sent. Check your bank before confirming." actions={<BranchSelect value={branchId} onChange={setBranchId} allowAll />} />
      <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
        <TabsList><TabsTrigger value="claimed" data-cy="tab-claimed">Claimed</TabsTrigger><TabsTrigger value="pending" data-cy="tab-pending">Awaiting transfer</TabsTrigger><TabsTrigger value="all">All open</TabsTrigger></TabsList>
      </Tabs>
      <div className="mt-4">
        {isLoading ? <PageLoader /> : !data || data.length === 0 ? <EmptyState title="Nothing waiting" description="Transfer claims appear here as soon as a customer taps “I have paid”." /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Branch</TableHead><TableHead>Customer</TableHead><TableHead>Amount</TableHead><TableHead>Claimed</TableHead><TableHead>Time left</TableHead><TableHead>Receipt</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id} data-cy={`payment-row-${p.id}`}>
                  <TableCell><Link to={`/admin/orders/${p.orderId}`} className="font-medium hover:underline">{p.orderNumber}</Link></TableCell>
                  <TableCell>{p.branchName}</TableCell>
                  <TableCell>{p.customerName ?? "—"}<span className="block text-xs text-muted-foreground">{p.customerPhone}</span></TableCell>
                  <TableCell><Money value={p.amount} fmt={fmt} className="font-medium" /></TableCell>
                  <TableCell className="text-muted-foreground">{p.claimedAt ? format(new Date(p.claimedAt), "d MMM, HH:mm") : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.expiresAt ? formatDistanceToNow(new Date(p.expiresAt), { addSuffix: true }) : "—"}</TableCell>
                  <TableCell>{p.proofUrl ? <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">View</a> : <span className="text-muted-foreground">None</span>}{p.claimNote ? <span className="block text-xs text-muted-foreground">{p.claimNote}</span> : null}</TableCell>
                  <TableCell className="text-right">
                    {can("payments.confirm") ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" onClick={() => confirm.mutate(p.id, { onSuccess: () => toast.success(`${p.orderNumber} confirmed`), onError: (e) => toast.error(e.message) })} loading={confirm.isPending && confirm.variables === p.id} data-cy="payment-confirm">Confirm</Button>
                        <Button size="sm" variant="outline" onClick={() => setRejectId(p.id)} data-cy="payment-reject">Reject</Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination meta={res?.meta} onPageChange={setPage} />
      </div>
      <Dialog open={Boolean(rejectId)} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reject this payment</DialogTitle></DialogHeader>
          <Field label="Reason (emailed to the customer)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} data-cy="payment-reject-reason" /></Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!reason.trim()} loading={reject.isPending} onClick={() => reject.mutate({ id: rejectId!, reason }, { onSuccess: () => { setRejectId(null); setReason("") }, onError: (e) => toast.error(e.message) })} data-cy="payment-reject-confirm">Reject & cancel order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
