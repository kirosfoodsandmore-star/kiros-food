// Email log (platform admins only): every email the platform sent, tried to send or skipped, newest first. One row per
// recipient with the restaurant, what kind of email it was, the subject and how it went. Message text is never stored.
// The period filter ("last 24 hours", a day, a range) is in the admin's own time zone (see lib/emailLogPeriod).
import { format } from "date-fns"
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Pagination } from "@/components/shared/Pagination"
import { SearchInput } from "@/components/shared/SearchInput"
import { EmptyState, ErrorState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import { usePlatformEmailLogs, usePlatformEmailSummary } from "@/hooks/useAdminMisc"
import { DEFAULT_PERIOD, describePeriod, PERIOD_LABELS, type Period, type PeriodPreset } from "@/lib/emailLogPeriod"
import { cn } from "@/lib/utils"
import type { EmailStatus } from "@/types/admin.types"

const KIND_LABELS: Record<string, string> = {
  welcome: "Welcome",
  staff_invite: "Staff invite",
  password_reset: "Password reset",
  password_changed: "Password changed",
  access_removed: "Access removed",
  contact_message: "Contact form",
  sign_in_code: "Sign-in code",
  transfer_instructions: "Transfer instructions",
  order_received: "Order received",
  order_status: "Order update",
  payment_rejected: "Payment rejected",
  new_order_staff: "New order (staff)",
}
const PROVIDER_LABELS: Record<string, string> = { gmail: "Gmail", apps_script: "Apps Script" }
const STATUS_LABELS: Record<EmailStatus, string> = { sent: "Sent", failed: "Failed", skipped: "Skipped" }
const STATUS_VARIANT = { sent: "success", failed: "danger", skipped: "neutral" } as const
const PRESETS = Object.keys(PERIOD_LABELS) as PeriodPreset[]
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

export default function EmailLogPage() {
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD)
  const [status, setStatus] = useState<EmailStatus | "all">("all")
  const [kind, setKind] = useState("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const term = useDebouncedSearch(search)
  useEffect(() => setPage(1), [term, status, kind, period.preset, period.fromDate, period.toDate])
  const filters = { kind: kind === "all" ? undefined : kind, search: term || undefined }
  const { data, isLoading, isError, error, refetch } = usePlatformEmailLogs({ page, status: status === "all" ? undefined : status, ...filters }, period)
  const { data: summary } = usePlatformEmailSummary(filters, period)
  const today = format(new Date(), "yyyy-MM-dd")
  const tiles: EmailStatus[] = ["sent", "failed", "skipped"]

  return (
    <div data-cy="email-log-page">
      <PageHeader title="Email log" description="Every email the platform sent, tried to send or skipped, newest first. Only platform admins can see this. Message text is never stored, and old entries are removed automatically." />

      <div className="flex flex-wrap items-end gap-2" data-cy="email-period">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          When
          <Select value={period.preset} onValueChange={(v) => setPeriod({ ...period, preset: v as PeriodPreset })}>
            <SelectTrigger className="w-44 text-foreground" data-cy="email-filter-period"><SelectValue /></SelectTrigger>
            <SelectContent>{PRESETS.map((p) => <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        {period.preset === "custom" ? (
          <>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              From
              <Input type="date" value={period.fromDate} max={period.toDate || today} onChange={(e) => setPeriod({ ...period, fromDate: e.target.value })} className="w-40 text-foreground" data-cy="email-from" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              To (included)
              <Input type="date" value={period.toDate} min={period.fromDate || undefined} max={today} onChange={(e) => setPeriod({ ...period, toDate: e.target.value })} className="w-40 text-foreground" data-cy="email-to" />
            </label>
          </>
        ) : null}
        <p className="pb-2 text-xs text-muted-foreground" data-cy="email-period-note">
          Showing: <span className="font-medium text-foreground">{describePeriod(period)}</span> · times in {TIME_ZONE}
          {period.preset === "custom" ? " · choose the same date twice to see a single day" : ""}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {tiles.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(status === s ? "all" : s)}
            aria-pressed={status === s}
            className={cn("rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/50", status === s && "border-primary ring-2 ring-primary/30")}
            data-cy={`email-tile-button-${s}`}
          >
            <p className="text-xs text-muted-foreground">{STATUS_LABELS[s]} in this period{status === s ? " · tap to clear" : ""}</p>
            <p className="font-display text-2xl font-semibold" data-cy={`email-tile-${s}`}>{summary ? summary[s] : "—"}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Recipient or subject" className="w-72" dataCy="email-search" />
        <Select value={status} onValueChange={(v) => setStatus(v as EmailStatus | "all")}>
          <SelectTrigger className="w-40" data-cy="email-filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as EmailStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-52" data-cy="email-filter-kind"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(KIND_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-3">
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : isError ? (
          <ErrorState message={`The email log could not be loaded.${error instanceof Error && error.message ? ` ${error.message}` : ""}`} onRetry={() => void refetch()} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            title="No emails match"
            description={period.preset === "all" ? "Emails appear here as the platform sends them." : "Nothing was sent in this period with these filters. Try a longer period or clear the filters."}
            action={period.preset !== "all" ? <Button variant="outline" size="sm" onClick={() => setPeriod({ ...period, preset: "all" })} data-cy="email-show-all">Show all time</Button> : undefined}
          />
        ) : (
          <>
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>To</TableHead><TableHead>Subject</TableHead><TableHead>Restaurant</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.data.map((r) => (
                  <TableRow key={r.id} data-cy="email-row" data-status={r.status}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(r.createdAt), "d MMM yyyy, HH:mm:ss")}</TableCell>
                    <TableCell className="text-sm">{r.to}</TableCell>
                    <TableCell className="max-w-xs text-sm"><span className="line-clamp-2" title={r.subject}>{r.subject}</span></TableCell>
                    <TableCell className="text-sm">{r.restaurantName ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.kind ? (KIND_LABELS[r.kind] ?? r.kind) : "—"}</TableCell>
                    <TableCell className="max-w-xs">
                      <Badge variant={STATUS_VARIANT[r.status]} title={r.status === "sent" ? "Accepted by the mail provider. This does not confirm it reached an inbox." : undefined}>{STATUS_LABELS[r.status]}</Badge>
                      {r.provider ? <span className="ml-2 text-xs text-muted-foreground">via {PROVIDER_LABELS[r.provider] ?? r.provider}</span> : null}
                      {r.note ? <p className="mt-1 line-clamp-3 break-words text-xs text-muted-foreground" title={r.note} data-cy="email-note">{r.note}</p> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
