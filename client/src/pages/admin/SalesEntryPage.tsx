// Record sales: the screen for staff who may only record sales (finance.record_sales), e.g. a cashier entering the
// day's walk-in and catering sales. They see every sale at their branches (so what a manager recorded shows too),
// and can correct only the ones they recorded themselves, until the sales day rolls over (6am).
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
import { Badge } from "@/components/ui/badge"
import { itemsSummary, salesDay } from "@/lib/finance"
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
  // Newest entered first, whatever date each sale carries: a sale just recorded must appear at the top.
  const { data: res, isLoading } = useFinanceEntries({ kind: "income", page, sort: "recorded" })
  const [dialog, setDialog] = useState<{ open: boolean; entry?: FinanceEntry }>({ open: false })
  const [del, setDel] = useState<FinanceEntry | null>(null)

  const entries = res?.data ?? []
  // The sales day rolls over at 6am (not midnight): a late-night sale still counts for the evening it belongs to.
  const tz = session?.restaurant.timezone ?? "Africa/Lagos"
  const startsHour = catalog.data?.salesDayStartsHour ?? 6
  const currentDay = salesDay(new Date(), tz, startsHour)
  const inCurrentDay = (e: FinanceEntry) => salesDay(e.createdAt, tz, startsHour) === currentDay
  const rollover = `${startsHour % 12 || 12}${startsHour < 12 ? "am" : "pm"}`
  // Today's figures come from the server (the list below is paged, so adding up the visible rows could miss sales).
  const { data: todayRes } = useFinanceEntries({ kind: "income", from: currentDay, to: currentDay, limit: 1 })
  const todayTotal = todayRes?.sum ?? 0
  const todayCount = todayRes?.meta?.total ?? 0
  // Mirrors the server rule: managers can change anything; others only their own sales, until the sales day rolls over.
  const mayChange = (e: FinanceEntry) => manager || (e.createdBy === session?.user.id && inCurrentDay(e))
  // Group by the sales day each sale was entered on: Today, Yesterday, then dates.
  const dayHeading = (day: string) => {
    if (day === currentDay) return "Today"
    const prev = new Date(`${currentDay}T12:00:00`)
    prev.setDate(prev.getDate() - 1)
    return day === format(prev, "yyyy-MM-dd") ? "Yesterday" : format(parseISO(day), "EEEE d MMM yyyy")
  }
  const groups = entries.reduce<Array<{ day: string; rows: FinanceEntry[] }>>((acc, e) => {
    const day = salesDay(e.createdAt, tz, startsHour)
    const last = acc[acc.length - 1]
    if (last && last.day === day) last.rows.push(e)
    else acc.push({ day, rows: [e] })
    return acc
  }, [])
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
            <p className="text-sm text-muted-foreground">Sales today</p>
            <p className="mt-1 font-display text-2xl font-semibold"><Money value={todayTotal} fmt={fmt} /></p>
            <p className="text-xs text-muted-foreground">{todayCount} {todayCount === 1 ? "sale" : "sales"}{!manager ? ` · you can correct the ones you recorded until ${rollover} tomorrow; ask a manager about the rest` : ""}</p>
          </div>
          <HandCoins className="size-10 text-primary/60" aria-hidden />
        </CardContent>
      </Card>

      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Recent sales <span className="font-normal">· newest first</span></h2>
      {isLoading ? <PageLoader /> : entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <p className="font-medium">No sales recorded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Use <b>Record a sale</b> for each sale or for the day's total. One entry can be split between several customers.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5" data-cy="sales-list">
          {groups.map((g) => (
            <section key={g.day} aria-label={dayHeading(g.day)}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground" data-cy="sales-day">{dayHeading(g.day)}</h3>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {g.rows.map((e) => {
                  // Dated on neither the day it was entered nor that day's calendar date: it counts in another period.
                  const backDated = e.entryDate !== salesDay(e.createdAt, tz, 0) && e.entryDate !== g.day
                  return (
                    <li key={e.id} className="p-3 sm:p-4" data-cy="sale-row">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium break-words">{e.title}</p>
                          <p className="text-xs text-muted-foreground break-words">{[e.title !== catalog.label(e.category) ? catalog.label(e.category) : null, e.branchId || manager ? branchName(e.branchId) : null].filter(Boolean).join(" · ")}</p>
                          {e.items.length ? <p className="mt-0.5 text-xs break-words" data-cy="entry-items-summary">{itemsSummary(e.items)}</p> : null}
                        </div>
                        <Money value={e.amount} fmt={fmt} className="shrink-0 font-semibold tabular-nums" />
                      </div>
                      {e.parties.length ? (
                        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {e.parties.map((pt) => <li key={pt.partyId}>{pt.name}{e.parties.length > 1 ? <> · <Money value={pt.amount} fmt={fmt} /></> : null}</li>)}
                        </ul>
                      ) : null}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>{format(new Date(e.createdAt), "h:mm a")}{e.createdBy === session?.user.id ? " · by you" : e.createdByName ? ` · by ${e.createdByName}` : ""}</span>
                          {backDated ? (
                            <Badge variant="warning" title="Counted in the period of this date, not in today's totals or this month's analytics" data-cy="sale-backdated">Dated {format(parseISO(e.entryDate), "d MMM yyyy")}</Badge>
                          ) : null}
                        </span>
                        {mayChange(e) ? (
                          <div className="flex shrink-0">
                            <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ open: true, entry: e })} aria-label="Edit sale"><Pencil /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setDel(e)} aria-label="Delete sale"><Trash2 className="text-destructive" /></Button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
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
