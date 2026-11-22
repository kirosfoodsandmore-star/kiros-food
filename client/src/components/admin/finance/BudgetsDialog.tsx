// Monthly spending budgets per expense category, compared against actual spending on the analytics page.
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Money } from "@/components/shared/Money"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useFinanceBudgets, useFinanceCatalog, useFinanceMutations } from "@/hooks/useFinance"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { toMajor, toMinor } from "@/lib/money"

export function BudgetsDialog({ open, onOpenChange, readOnly = false }: { open: boolean; onOpenChange: (o: boolean) => void; readOnly?: boolean }) {
  const fmt = useAdminCurrency()
  const catalog = useFinanceCatalog()
  const { data: budgets } = useFinanceBudgets()
  const m = useFinanceMutations()
  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => {
    if (open) setValues(Object.fromEntries((budgets ?? []).map((b) => [b.category, toMajor(b.monthlyAmount)])))
  }, [open, budgets])
  const expenseCats = (catalog.data?.categories ?? []).filter((c) => c.kind === "expense")
  const total = Object.values(values).reduce((s, v) => s + toMinor(v || "0"), 0)

  const save = async () => {
    try {
      await m.setBudgets.mutateAsync(expenseCats.map((c) => ({ category: c.key, monthlyAmount: Math.max(0, toMinor(values[c.key] || "0")) })).filter((b) => b.monthlyAmount > 0))
      toast.success("Budgets saved")
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Monthly budgets</DialogTitle>
          <DialogDescription>Set what you plan to spend each month. Analytics flags categories that run over. Leave blank for no budget.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {(catalog.data?.groups ?? []).map((g) => (
            <div key={g.key}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
              <div className="space-y-2">
                {expenseCats.filter((c) => c.group === g.key).map((c) => (
                  <label key={c.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{c.label}</span>
                    <Input className="w-36 text-right" inputMode="decimal" placeholder="₦ / month" value={values[c.key] ?? ""} disabled={readOnly} onChange={(e) => setValues((s) => ({ ...s, [c.key]: e.target.value }))} aria-label={`${c.label} monthly budget`} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Total planned: <Money value={total} fmt={fmt} className="font-medium text-foreground" /> a month</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{readOnly ? "Close" : "Cancel"}</Button>
          {!readOnly ? <Button onClick={() => void save()} loading={m.setBudgets.isPending}>Save budgets</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
