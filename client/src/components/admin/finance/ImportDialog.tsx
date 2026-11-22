// Back-fill history in one go: paste or upload a CSV (from Excel / Google Sheets), preview, then import the valid rows.
import { format } from "date-fns"
import { Download, FileUp } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Money } from "@/components/shared/Money"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useBranches } from "@/hooks/useAdminBranches"
import { useFinanceCatalog, useFinanceMutations } from "@/hooks/useFinance"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { buildImport, IMPORT_TEMPLATE, KIND_LABELS } from "@/lib/finance"

const MAX_ROWS = 1000

function saveTemplate() {
  const blob = new Blob([`﻿${IMPORT_TEMPLATE}\n`], { type: "text/csv;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "kiros-finance-template.csv"
  a.click()
  URL.revokeObjectURL(a.href)
}

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const fmt = useAdminCurrency()
  const catalog = useFinanceCatalog()
  const { data: branches } = useBranches()
  const m = useFinanceMutations()
  const [text, setText] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => (text.trim() ? buildImport(text, catalog.data?.categories ?? [], branches ?? [], format(new Date(), "yyyy-MM-dd")) : null), [text, catalog.data, branches])
  const good = parsed?.rows.filter((r) => r.entry) ?? []
  const bad = parsed?.rows.filter((r) => r.error) ?? []
  const total = good.reduce((s, r) => s + (r.entry?.amount ?? 0), 0)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (f.size > 2_000_000) return toast.error("That file is over 2 MB; split it into smaller files")
    setText(await f.text())
  }

  const submit = async () => {
    if (!good.length) return
    if (good.length > MAX_ROWS) return toast.error(`Import at most ${MAX_ROWS} rows at a time`)
    try {
      const res = await m.importMany.mutateAsync(good.map((r) => r.entry!))
      toast.success(`Imported ${res.imported} entr${res.imported === 1 ? "y" : "ies"}`)
      setText("")
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" data-cy="finance-import-dialog">
        <DialogHeader>
          <DialogTitle>Import past records</DialogTitle>
          <DialogDescription>Bring in capital, expenses and sales from before the app (or from a spreadsheet you already keep). Amounts in naira; dates as 2025-02-01 or 01/02/2025.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={saveTemplate}><Download /> Template</Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileUp /> Choose CSV file</Button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = "" }} />
        </div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={"…or paste rows here, with a header line:\ndate,kind,category,title,amount,vendor,method,reference,notes,branch"} className="font-mono text-xs" data-cy="import-text" />
        <p className="text-xs text-muted-foreground">Needed: <b>date</b>, <b>category</b> (name or key, e.g. "Rent" or "ingredients") and <b>amount</b>. Kind is worked out from the category when left blank. Leave branch empty for the whole business.</p>
        {parsed?.missing.length ? <p className="text-sm text-destructive">The header row is missing: {parsed.missing.join(", ")}.</p> : null}
        {parsed && !parsed.missing.length ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="success">{good.length} ready</Badge>
              {bad.length ? <Badge variant="danger">{bad.length} with problems (skipped)</Badge> : null}
              <span className="text-muted-foreground">Total <Money value={total} fmt={fmt} /></span>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>Line</TableHead><TableHead>Date</TableHead><TableHead>Kind</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...bad, ...good].slice(0, 200).map((r) => (
                    <TableRow key={r.line}>
                      <TableCell className="text-muted-foreground">{r.line}</TableCell>
                      {r.entry ? (
                        <>
                          <TableCell className="whitespace-nowrap">{r.entry.entryDate}</TableCell>
                          <TableCell>{KIND_LABELS[r.entry.kind]}</TableCell>
                          <TableCell>{catalog.label(r.entry.category)}</TableCell>
                          <TableCell className="max-w-48 truncate">{r.entry.title}</TableCell>
                          <TableCell className="text-right tabular-nums"><Money value={r.entry.amount} fmt={fmt} /></TableCell>
                        </>
                      ) : <TableCell colSpan={5} className="text-destructive">{r.error}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!good.length} loading={m.importMany.isPending} data-cy="import-submit">Import {good.length || ""} {good.length === 1 ? "row" : "rows"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
