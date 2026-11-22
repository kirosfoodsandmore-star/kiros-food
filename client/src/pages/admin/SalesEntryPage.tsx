// Record sales: the screen for staff who may only record sales (finance.record_sales), e.g. a cashier entering the
// day's walk-in and catering sales. They see only the sales they recorded, and can correct them on the same day.
import { format, parseISO } from "date-fns"
import { HandCoins, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { EntryDialog } from "@/components/admin/finance/EntryDialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { Pagination } from "@/components/shared/Pagination"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { useBranches } from "@/hooks/useAdminBranches"
import { useFinanceCatalog, useFinanceEntries, useFinanceMutations } from "@/hooks/useFinance"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { salesDay } from "@/lib/finance"
import type { FinanceEntry, FinanceKind } from "@/types/finance.types"

const SALES_ONLY: FinanceKind[] = ["income"]

export default function SalesEntryPage() {
  const fmt = useAdminCurrency()
  const { session, can } = useAuth()
  const manager = can("finance.manage")
  const catalog = useFinanceCatalog()
  const { data: branches } = useBranches()
  const m = useFinanceMutations()
  const [page, setPage] = useState(1)
  const { data: res, isLoading } = useFinanceEntries({ kind: "income", page })
  const [dialog, setDialog] = useState<{ open: boolean; entry?: FinanceEntry }>({ open: false })
  const [del, setDel] = useState<FinanceEntry | null>(null)

  const entries = res?.data ?? []
  // The sales day rolls over at 6am (not midnight): a late-night sale still counts for the evening it belongs to.
  const tz = session?.restaurant.timezone ?? "Africa/Lagos"
  const startsHour = catalog.data?.salesDayStartsHour ?? 6
  const currentDay = salesDay(new Date(), tz, startsHour)
  const inCurrentDay = (e: FinanceEntry) => salesDay(e.createdAt, tz, startsHour) === currentDay
  const rollover = `${startsHour % 12 || 12}${startsHour < 12 ? "am" : "pm"}`
  const today = entries.filter(inCurrentDay)
  const todayTotal = today.reduce((s, e) => s + e.amount, 0)
  // Mirrors the server rule: managers can change anything; others only their own sales, until the sales day rolls over.
  const mayChange = (e: FinanceEntry) => manager || (e.createdBy === session?.user.id && inCurrentDay(e))
  const branchName = (id: string | null) => (id ? (branches?.find((b) => b.id === id)?.name ?? "") : "Whole business")

  return (
    <div data-cy="sales-entry-page">
      <PageHeader
        title="Record sales"
        description="Walk-in, catering and other sales the app didn't take."
        actions={<Button size="lg" onClick={() => setDialog({ open: true })} data-cy="sales-new"><Plus /> Record a sale</Button>}
      />

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <p className="text-sm text-muted-foreground">{manager ? "Recorded today (everyone)" : "You've recorded today"}</p>
            <p className="mt-1 font-display text-2xl font-semibold"><Money value={todayTotal} fmt={fmt} /></p>
            <p className="text-xs text-muted-foreground">{today.length} {today.length === 1 ? "sale" : "sales"}{!manager ? ` · you can correct these until ${rollover} tomorrow; ask a manager about older ones` : ""}</p>
          </div>
          <HandCoins className="size-10 text-primary/60" aria-hidden />
        </CardContent>
      </Card>

      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{manager ? "Recent sales" : "Your sales"}</h2>
      {isLoading ? <PageLoader /> : entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <p className="font-medium">No sales recorded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Use <b>Record a sale</b> for each sale or for the day's total. One entry can be split between several customers.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card" data-cy="sales-list">
          {entries.map((e) => (
            <li key={e.id} className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">{e.title}</p>
                  <p className="text-xs text-muted-foreground break-words">{[e.title !== catalog.label(e.category) ? catalog.label(e.category) : null, e.branchId || manager ? branchName(e.branchId) : null].filter(Boolean).join(" · ")}</p>
                </div>
                <Money value={e.amount} fmt={fmt} className="shrink-0 font-semibold tabular-nums" />
              </div>
              {e.parties.length ? (
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {e.parties.map((p) => <li key={p.partyId}>{p.name}{e.parties.length > 1 ? <> · <Money value={p.amount} fmt={fmt} /></> : null}</li>)}
                </ul>
              ) : null}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{format(parseISO(e.entryDate), "d MMM yyyy")} · recorded {format(new Date(e.createdAt), "d MMM, h:mm a")}{manager && e.createdByName ? ` by ${e.createdByName}` : ""}</span>
                {mayChange(e) ? (
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ open: true, entry: e })} aria-label="Edit sale"><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDel(e)} aria-label="Delete sale"><Trash2 className="text-destructive" /></Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination meta={res?.meta} onPageChange={setPage} />

      <EntryDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} entry={dialog.entry} defaultKind="income" kinds={SALES_ONLY} title={dialog.entry ? "Edit sale" : "Record a sale"} />
      <ConfirmDialog
        open={Boolean(del)}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete "${del?.title}"?`}
        description="It stops counting towards sales. The audit log keeps a record."
        confirmLabel="Delete"
        loading={m.remove.isPending}
        onConfirm={async () => { await m.remove.mutateAsync(del!.id).then(() => toast.success("Deleted")).catch((err) => toast.error(err.message)); setDel(null) }}
      />
    </div>
  )
}
