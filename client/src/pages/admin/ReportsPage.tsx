import { Download } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { BranchSelect } from "@/components/admin/BranchSelect"
import { PageHeader } from "@/components/layout/PageHeader"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { EmptyState } from "@/components/shared/States"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { ReportEndpoints } from "@/endpoints/admin.endpoints"
import { useSalesReport } from "@/hooks/useAdminMisc"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { useAdminBranch } from "@/hooks/useAdminBranch"

const GROUPS = [["day", "By day"], ["branch", "By branch"], ["menu", "By menu"], ["item", "By item"], ["option", "By option"]] as const
type Grouping = (typeof GROUPS)[number][0]

export default function ReportsPage() {
  const fmt = useAdminCurrency()
  const { can } = useAuth()
  const [branchId, setBranchId] = useAdminBranch()
  const [groupBy, setGroupBy] = useState<Grouping>("day")
  const [range, setRange] = useState({ from: "", to: "" })
  const params = { groupBy, branchId: branchId || undefined, from: range.from || undefined, to: range.to || undefined }
  const { data, isLoading } = useSalesReport(params)

  return (
    <div data-cy="reports-page">
      <PageHeader
        title="Sales reports"
        actions={
          <>
            <BranchSelect value={branchId} onChange={setBranchId} allowAll className="w-full sm:w-44" />
            <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
            {can("reports.export") ? <Button variant="outline" onClick={() => ReportEndpoints.exportSales(params, `sales-by-${groupBy}.csv`).catch(() => toast.error("Export failed"))} data-cy="report-export"><Download /> CSV</Button> : null}
          </>
        }
      />
      <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as Grouping)}>
        <TabsList>{GROUPS.map(([k, l]) => <TabsTrigger key={k} value={k} data-cy={`report-${k}`}>{l}</TabsTrigger>)}</TabsList>
      </Tabs>
      {isLoading || !data ? <PageLoader /> : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card><CardContent className="p-4 sm:p-5"><p className="text-sm text-muted-foreground">Orders</p><p className="mt-1 truncate font-display text-xl font-semibold sm:text-2xl">{data.totals.orders}</p></CardContent></Card>
            <Card><CardContent className="p-4 sm:p-5"><p className="text-sm text-muted-foreground">Revenue</p><p className="mt-1 truncate font-display text-xl font-semibold sm:text-2xl"><Money value={data.totals.revenue} fmt={fmt} /></p></CardContent></Card>
            <Card><CardContent className="p-4 sm:p-5"><p className="text-sm text-muted-foreground">Average order</p><p className="mt-1 truncate font-display text-xl font-semibold sm:text-2xl"><Money value={data.totals.averageOrderValue} fmt={fmt} /></p></CardContent></Card>
            <Card><CardContent className="p-4 sm:p-5"><p className="text-sm text-muted-foreground">Items</p><p className="mt-1 truncate font-display text-xl font-semibold sm:text-2xl">{data.totals.items}</p></CardContent></Card>
          </div>
          <p className="text-xs text-muted-foreground">{data.from} → {data.to} · {data.timezone} · paid orders only (cancelled and refunded excluded)</p>
          {data.rows.length === 0 ? <EmptyState title="No sales in this range" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>{GROUPS.find(([k]) => k === groupBy)?.[1].replace("By ", "")}</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">Delivery</TableHead><TableHead className="text-right">Discounts</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="text-right">{r.orders}</TableCell>
                    <TableCell className="text-right">{r.items}</TableCell>
                    <TableCell className="text-right"><Money value={r.subtotal} fmt={fmt} /></TableCell>
                    <TableCell className="text-right"><Money value={r.deliveryFees} fmt={fmt} /></TableCell>
                    <TableCell className="text-right"><Money value={r.discounts} fmt={fmt} /></TableCell>
                    <TableCell className="text-right font-medium"><Money value={r.revenue} fmt={fmt} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}
