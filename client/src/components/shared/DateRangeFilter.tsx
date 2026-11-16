import { Input } from "@/components/ui/input"

export function DateRangeFilter({ from, to, onChange }: { from: string; to: string; onChange: (next: { from: string; to: string }) => void }) {
  return (
    // Full width on phones (inputs share the row), fixed width from sm up.
    <div className="flex w-full items-center gap-2 sm:w-auto" data-cy="date-range">
      <Input type="date" value={from} onChange={(e) => onChange({ from: e.target.value, to })} aria-label="From date" className="min-w-0 flex-1 px-2 sm:w-[9.5rem] sm:flex-none sm:px-3" data-cy="date-from" />
      <span className="text-muted-foreground">–</span>
      <Input type="date" value={to} onChange={(e) => onChange({ from, to: e.target.value })} aria-label="To date" className="min-w-0 flex-1 px-2 sm:w-[9.5rem] sm:flex-none sm:px-3" data-cy="date-to" />
    </div>
  )
}
