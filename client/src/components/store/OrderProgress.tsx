import { Check } from "lucide-react"
import { PROGRESS_STEPS } from "@/lib/enums"
import { cn } from "@/lib/utils"
import type { Fulfilment, OrderStatus } from "@/types/store.types"

export function OrderProgress({ status, fulfilment }: { status: OrderStatus; fulfilment: Fulfilment }) {
  const steps = PROGRESS_STEPS.filter((s) => fulfilment === "delivery" || s.status !== "out_for_delivery")
  const idx = steps.findIndex((s) => s.status === status)
  const terminal = status === "cancelled" || status === "refunded"
  if (terminal) return null
  return (
    <ol className="flex items-start" data-cy="order-progress">
      {steps.map((s, i) => {
        const done = idx >= i
        return (
          // The connector runs from this step centre to the next one, drawn behind the circles.
          <li key={s.status} className={cn("relative flex flex-1 flex-col items-center gap-1 text-center", i < steps.length - 1 && "after:absolute after:left-1/2 after:top-3 after:h-0.5 after:w-full after:-translate-y-1/2", i < steps.length - 1 && (idx > i ? "after:bg-primary" : "after:bg-border"))}>
            <span className={cn("relative z-10 grid size-6 place-items-center rounded-full border text-xs font-semibold", done ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")} aria-current={idx === i ? "step" : undefined}>{done && idx > i ? <Check className="size-3.5" /> : i + 1}</span>
            <span className={cn("text-[11px] leading-tight", done ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
