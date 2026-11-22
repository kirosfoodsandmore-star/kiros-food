// Capital & expenses: the business's own books, next to the storefront's sales. Record what was put in, what's
// been spent, sales made off-app and money taken out, including everything from before the app existed.
import { format, parseISO } from "date-fns"
import { ArrowDownRight, ArrowUpRight, FileSpreadsheet, FileUp, Landmark, Pencil, PiggyBank, Plus, Receipt, Target, Trash2, Users, Wallet } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { BudgetsDialog } from "@/components/admin/finance/BudgetsDialog"
import { PartiesDialog } from "@/components/admin/finance/PartiesDialog"
import { EntryDialog } from "@/components/admin/finance/EntryDialog"
import { ImportDialog } from "@/components/admin/finance/ImportDialog"
import { BranchSelect } from "@/components/admin/BranchSelect"
import { PageHeader } from "@/components/layout/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { Pagination } from "@/components/shared/Pagination"
import { SearchInput } from "@/components/shared/SearchInput"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { FinanceEndpoints } from "@/endpoints/admin.endpoints"
import { useBranches } from "@/hooks/useAdminBranches"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { useFinanceAnalytics, useFinanceCatalog, useFinanceEntries, useFinanceMutations } from "@/hooks/useFinance"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { KIND_LABELS, KIND_SIGN, PAYMENT_METHOD_LABELS } from "@/lib/finance"
import type { FinanceEntry, FinanceKind } from "@/types/finance.types"

type Tab = "all" | FinanceKind
const TABS: Array<[Tab, string]> = [["all", "Everything"], ["expense", "Expenses"], ["capital", "Capital in"], ["income", "Other income"], ["withdrawal", "Money out"]]
const KIND_BADGE: Record<FinanceKind, "danger" | "success" | "info" | "warning"> = { expense: "danger", capital: "info", income: "success", withdrawal: "warning" }

export default function FinancePage() {
  const fmt = useAdminCurrency()
  const { can } = useAuth()
  const manage = can("finance.manage")
  const catalog = useFinanceCatalog()
  const { data: branches } = useBranches()
  const m = useFinanceMutations()

  const [tab, setTab] = useState<Tab>("all")
  const [category, setCategory] = useState("")
  const [branchId, setBranchId] = useState("")
  const [range, setRange] = useState({ from: "", to: "" })
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const term = useDebouncedSearch(search)
  useEffect(() => setPage(1), [term, tab, category, branchId, range.from, range.to])
  useEffect(() => setCategory(""), [tab])

  const params = { page, kind: tab === "all" ? undefined : tab, category: category || undefined, branchId: branchId || undefined, from: range.from || undefined, to: range.to || undefined, search: term || undefined }
  const { data: res, isLoading } = useFinanceEntries(params)
  const { data: life } = useFinanceAnalytics({ allTime: true, branchId: branchId || undefined, granularity: "month" })

  const [dialog, setDialog] = useState<{ open: boolean; entry?: FinanceEntry; kind?: FinanceKind }>({ open: false })
  const [importing, setImporting] = useState(false)
  const [budgets, setBudgets] = useState(false)
  const [partiesOpen, setPartiesOpen] = useState(false)
  const [del, setDel] = useState<FinanceEntry | null>(null)

  const cats = useMemo(() => (catalog.data?.categories ?? []).filter((c) => tab === "all" || c.kind === tab), [catalog.data, tab])
  const branchName = (id: string | null) => (id ? branches?.find((b) => b.id === id)?.name ?? "â€”" : "Whole business")
  const entries = res?.data ?? []
  const empty = !isLoading && entries.length === 0 && !term && tab === "all" && !category && !range.from && !range.to

  const tiles = life?.lifetime
    ? [
        { label: "Capital put in", value: life.lifetime.capitalInvested, icon: Landmark, hint: life.lifetime.withdrawals ? <>Net of money out: <Money value={life.lifetime.netCapital} fmt={fmt} /></> : "Since the start" },
        { label: "Spent to date", value: life.lifetime.expenses, icon: Receipt, hint: <>incl. <Money value={life.lifetime.assets} fmt={fmt} /> on assets</> },
        { label: "Revenue to date", value: life.lifetime.revenue, icon: ArrowUpRight, hint: "App orders + other income" },
        { label: "Estimated cash", value: life.lifetime.cashPosition, icon: Wallet, hint: "Capital + revenue âˆ’ spending âˆ’ money out" },
      ]
    : null

  return (
    <div data-cy="finance-page">
      <PageHeader
        title="Capital & expenses"
        description="Your own books: what went in, what's been spent, and sales the app didn't take."
        actions={
          <>
            <Button variant="outline" onClick={() => setPartiesOpen(true)} data-cy="finance-parties"><Users /> Vendors & customers</Button>
            <Button variant="outline" onClick={() => setBudgets(true)} data-cy="finance-budgets"><Target /> Budgets</Button>
            {can("reports.export") ? <Button variant="outline" onClick={() => FinanceEndpoints.exportEntries(params, `kiros-books-${format(new Date(), "yyyy-MM-dd")}.xlsx`).catch(() => toast.error("Download failed"))} data-cy="finance-export"><FileSpreadsheet /> Excel</Button> : null}
            {manage ? <Button variant="outline" onClick={() => setImporting(true)} data-cy="finance-import"><FileUp /> Import</Button> : null}
            {manage ? <Button onClick={() => setDialog({ open: true, kind: tab === "all" ? "expense" : tab })} data-cy="finance-new"><Plus /> Record</Button> : null}
          </>
        }
      />

      {tiles ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <Card key={t.label}>
              <CardContent className="p-4 sm:p-5">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><t.icon className="size-4" />{t.label}</p>
                <p className="mt-1 break-all font-display text-lg font-semibold sm:text-2xl"><Money value={t.value} fmt={fmt} /></p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {empty ? (
        <Card className="mb-5 border-dashed">
          <CardContent className="grid gap-5 p-6 md:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><PiggyBank className="size-5 text-primary" /> Start your books</h2>
              <p className="mt-2 text-sm text-muted-foreground">The business was running before the app. Add that history so profit, payback and cash make sense:</p>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
                <li><b>Capital</b>: what you (and any partners or lenders) put in, on the dates it came in.</li>
                <li><b>Set-up costs</b>: equipment, fit-out, licences: the one-off spend to open.</li>
                <li><b>Running costs</b>: rent, salaries, stock, fuel, month by month.</li>
                <li><b>Walk-in sales</b>: what you sold outside the app, as monthly totals if that's all you have.</li>
              </ol>
            </div>
            {manage ? (
              <div className="flex flex-col justify-center gap-2">
                <Button onClick={() => setDialog({ open: true, kind: "capital" })}><Landmark /> Record starting capital</Button>
                <Button variant="outline" onClick={() => setDialog({ open: true, kind: "expense" })}><Receipt /> Record an expense</Button>
                <Button variant="outline" onClick={() => setImporting(true)}><FileUp /> Import from Excel</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>{TABS.map(([k, l]) => <TabsTrigger key={k} value={k} data-cy={`finance-tab-${k}`}>{l}</TabsTrigger>)}</TabsList>
      </Tabs>
      <div className="mt-3 mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search description, vendor, ref" className="w-full sm:w-64" dataCy="finance-search" />
        <Select value={category || "__all"} onValueChange={(v) => setCategory(v === "__all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-52" data-cy="finance-category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All categories</SelectItem>
            {cats.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <BranchSelect value={branchId} onChange={setBranchId} allowAll className="w-full sm:w-44" />
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
      </div>

      {isLoading ? <PageLoader /> : entries.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">{empty ? "Nothing recorded yet." : "Nothing matches these filters."}</p>
      ) : (
        <>
          {/* Phones: one card per entry, so the amount and the edit/delete buttons never scroll out of view. */}
          <ul className="divide-y divide-border rounded-xl border border-border bg-card md:hidden" data-cy="finance-list-mobile">
            {entries.map((e) => (
              <li key={e.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{e.title}</p>
                    {e.party || e.reference ? <p className="text-xs text-muted-foreground break-words">{[e.party, e.reference].filter(Boolean).join(" Â· ")}</p> : null}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 font-medium tabular-nums">
                    {KIND_SIGN[e.kind] > 0 ? <ArrowUpRight className="size-3.5 text-success" aria-label="Money in" /> : <ArrowDownRight className="size-3.5 text-destructive" aria-label="Money out" />}
                    <Money value={e.amount} fmt={fmt} />
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{format(parseISO(e.entryDate), "d MMM yyyy")}</span>
                    <Badge variant={KIND_BADGE[e.kind]}>{KIND_LABELS[e.kind]}</Badge>
                    <span>{catalog.label(e.category)}</span>
                    <span>Â· {branchName(e.branchId)}</span>
                  </div>
                  {manage ? (
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ open: true, entry: e })} aria-label="Edit"><Pencil /></Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDel(e)} aria-label="Delete"><Trash2 className="text-destructive" /></Button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead className="hidden md:table-cell">Branch</TableHead><TableHead className="hidden lg:table-cell">Paid by</TableHead><TableHead className="text-right">Amount</TableHead>{manage ? <TableHead /> : null}</TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id} data-cy={`finance-row-${e.id}`}>
                  <TableCell className="whitespace-nowrap text-sm">{format(parseISO(e.entryDate), "d MMM yyyy")}</TableCell>
                  <TableCell>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{[e.party, e.reference].filter(Boolean).join(" Â· ") || null}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={KIND_BADGE[e.kind]}>{KIND_LABELS[e.kind]}</Badge>
                      <span className="text-sm">{catalog.label(e.category)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{branchName(e.branchId)}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{e.paymentMethod ? PAYMENT_METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod : "â€”"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap font-medium tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {KIND_SIGN[e.kind] > 0 ? <ArrowUpRight className="size-3.5 text-success" aria-label="Money in" /> : <ArrowDownRight className="size-3.5 text-destructive" aria-label="Money out" />}
                      <Money value={e.amount} fmt={fmt} />
                    </span>
                  </TableCell>
                  {manage ? (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ open: true, entry: e })} aria-label="Edit"><Pencil /></Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDel(e)} aria-label="Delete"><Trash2 className="text-destructive" /></Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>{res?.meta?.total ?? 0} entries Â· total <Money value={res?.sum ?? 0} fmt={fmt} className="font-medium text-foreground" />{tab === "all" ? " (money in and out combined; filter by kind for a meaningful total)" : ""}</span>
            {can("finance.view") ? <Link to="/admin/analytics" className="text-primary hover:underline">See the analytics â†’</Link> : null}
          </div>
        </>
      )}
      <Pagination meta={res?.meta} onPageChange={setPage} />

      <EntryDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} entry={dialog.entry} defaultKind={dialog.kind} />
      <ImportDialog open={importing} onOpenChange={setImporting} />
      <BudgetsDialog open={budgets} onOpenChange={setBudgets} readOnly={!manage} />
      <PartiesDialog open={partiesOpen} onOpenChange={setPartiesOpen} manage={manage} />
      <ConfirmDialog
        open={Boolean(del)}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete "${del?.title}"?`}
        description="It stops counting towards totals and analytics. The audit log keeps a record."
        confirmLabel="Delete"
        loading={m.remove.isPending}
        onConfirm={async () => { await m.remove.mutateAsync(del!.id).then(() => toast.success("Deleted")).catch((e) => toast.error(e.message)); setDel(null) }}
      />
    </div>
  )
}
