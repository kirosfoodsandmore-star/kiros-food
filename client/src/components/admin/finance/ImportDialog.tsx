// Back-fill history in one go: download the Excel template, fill it in, upload it (or paste rows copied from Excel),
// check the preview, then import the valid rows.
import { format } from "date-fns"
import { FileSpreadsheet, FileUp, X } from "lucide-react"
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
import { buildImport, buildImportFromTable, KIND_LABELS, parseCsv } from "@/lib/finance"

const MAX_ROWS = 1000
const MAX_FILE_BYTES = 5_000_000

function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

interface LoadedSheet {
  file: string
  sheet: string
  table: string[][]
  lines?: number[]
}

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const fmt = useAdminCurrency()
  const catalog = useFinanceCatalog()
  const { data: branches } = useBranches()
  const m = useFinanceMutations()
  const [text, setText] = useState("")
  const [loaded, setLoaded] = useState<LoadedSheet | null>(null)
  const [busy, setBusy] = useState<"template" | "file" | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd")
    const cats = (catalog.data?.categories ?? []).filter((c) => c.isActive)
    if (loaded) return buildImportFromTable(loaded.table, cats, branches ?? [], today, loaded.lines)
    return text.trim() ? buildImport(text, cats, branches ?? [], today) : null
  }, [text, loaded, catalog.data, branches])
  const good = parsed?.rows.filter((r) => r.entry) ?? []
  const bad = parsed?.rows.filter((r) => r.error) ?? []
  const total = good.reduce((s, r) => s + (r.entry?.amount ?? 0), 0)

  const downloadTemplate = async () => {
    if (!catalog.data) return
    setBusy("template")
    try {
      const { buildTemplate } = await import("@/lib/financeExcel")
      saveBlob(await buildTemplate({ ...catalog.data, categories: catalog.data.categories.filter((c) => c.isActive) }, branches ?? []), "kiros-finance-template.xlsx")
    } catch (err) {
      toast.error(`Couldn't make the template: ${(err as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    const ext = f.name.toLowerCase().split(".").pop() ?? ""
    if (ext === "xls") return toast.error("That's an old .xls file. In Excel choose File → Save As → Excel Workbook (.xlsx), then choose it again.")
    if (f.size > MAX_FILE_BYTES) return toast.error("That file is over 5 MB. Split it into one file per year.")
    setBusy("file")
    try {
      if (ext === "xlsx" || ext === "xlsm") {
        const { readWorkbook } = await import("@/lib/financeExcel")
        const book = await readWorkbook(await f.arrayBuffer())
        if (book.rows.length <= 1) return toast.error(`No entries found on the "${book.sheet || "first"}" sheet.`)
        setLoaded({ file: f.name, sheet: book.sheet, table: book.rows, lines: book.lines })
      } else {
        setLoaded({ file: f.name, sheet: "", table: parseCsv(await f.text()) })
      }
      setText("")
    } catch {
      toast.error("Couldn't read that file. Make sure it's an Excel workbook (.xlsx) and not open-protected.")
    } finally {
      setBusy(null)
    }
  }

  const submit = async () => {
    if (!good.length) return
    if (good.length > MAX_ROWS) return toast.error(`Import at most ${MAX_ROWS} rows at a time`)
    try {
      const res = await m.importMany.mutateAsync(good.map((r) => r.entry!))
      toast.success(`Imported ${res.imported} entr${res.imported === 1 ? "y" : "ies"}`)
      setText("")
      setLoaded(null)
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
          <DialogDescription>Bring in capital, expenses and sales from before the app, or from a spreadsheet you already keep.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-1 text-sm">
          <li><b>1.</b> Download the Excel template. It has dropdowns for category, payment method and branch, an example sheet and the full category list.</li>
          <li><b>2.</b> Fill in the <b>Entries</b> sheet: one row per entry, amounts in naira. Save it.</li>
          <li><b>3.</b> Choose the file here, check the preview, then import.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void downloadTemplate()} loading={busy === "template"} disabled={!catalog.data} data-cy="import-template"><FileSpreadsheet /> Download Excel template</Button>
          <Button onClick={() => fileRef.current?.click()} loading={busy === "file"} data-cy="import-choose"><FileUp /> Choose Excel file</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = "" }} data-cy="import-file" />
        </div>
        {loaded ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm" data-cy="import-loaded">
            <span className="flex min-w-0 items-center gap-2"><FileSpreadsheet className="size-4 shrink-0 text-success" /><span className="truncate"><b>{loaded.file}</b>{loaded.sheet ? ` · sheet "${loaded.sheet}"` : ""} · {Math.max(0, loaded.table.length - 1)} rows</span></span>
            <Button variant="ghost" size="icon-sm" onClick={() => setLoaded(null)} aria-label="Remove file"><X /></Button>
          </div>
        ) : (
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={"…or copy rows in Excel (with the header row) and paste them here"} className="font-mono text-xs" data-cy="import-text" />
        )}
        <p className="text-xs text-muted-foreground">Needed: <b>Date</b>, <b>Category</b> and <b>Amount</b>. The category decides whether it's capital in, an expense, other income or money out. Leave Branch blank for the whole business. Old .xls files: save as .xlsx first.</p>
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
                <TableHeader><TableRow><TableHead className="hidden sm:table-cell">Line</TableHead><TableHead>Date</TableHead><TableHead className="hidden sm:table-cell">Kind</TableHead><TableHead>Category</TableHead><TableHead className="hidden sm:table-cell">Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...bad, ...good].slice(0, 200).map((r) => (
                    <TableRow key={r.line}>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{r.line}</TableCell>
                      {r.entry ? (
                        <>
                          <TableCell className="whitespace-nowrap">{r.entry.entryDate}</TableCell>
                          <TableCell className="hidden sm:table-cell">{KIND_LABELS[r.entry.kind]}</TableCell>
                          <TableCell>{catalog.label(r.entry.category)}</TableCell>
                          <TableCell className="hidden max-w-48 truncate sm:table-cell">{r.entry.title}</TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums"><Money value={r.entry.amount} fmt={fmt} /></TableCell>
                        </>
                      ) : <TableCell colSpan={5} className="text-destructive"><span className="sm:hidden">Line {r.line}: </span>{r.error}</TableCell>}
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
