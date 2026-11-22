// A headline number with its change against the previous period and a small trend line. Used by Analytics and Sales reports.
import { ArrowDown, ArrowUp, Minus } from "lucide-react"
import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { change, pct } from "@/lib/finance"
import { cn } from "@/lib/utils"
import { Sparkline } from "./Charts"

export function StatTile({ label, value, now, before, upIsGood, spark, ratio, note }: { label: string; value: ReactNode; now: number; before: number; upIsGood: boolean; spark: number[]; ratio?: boolean; note?: ReactNode }) {
  const delta = ratio ? (before === 0 && now === 0 ? null : now - before) : change(now, before)
  const up = (delta ?? 0) > 0
  const good = delta === null || delta === 0 ? null : up === upIsGood
  const Icon = delta === null || delta === 0 ? Minus : up ? ArrowUp : ArrowDown
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 break-all font-display text-lg font-semibold sm:text-xl">{value}</p>
        {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
        <div className="mt-1 flex items-end justify-between gap-2">
          <span className={cn("flex items-center gap-0.5 text-xs", good === null ? "text-muted-foreground" : good ? "text-success" : "text-destructive")}>
            <Icon className="size-3" aria-hidden />
            {delta === null ? "no earlier data" : ratio ? `${delta >= 0 ? "+" : "−"}${Math.abs(delta * 100).toFixed(1)} pts` : `${pct(Math.abs(delta))}`}
          </span>
          <Sparkline values={spark} />
        </div>
      </CardContent>
    </Card>
  )
}
