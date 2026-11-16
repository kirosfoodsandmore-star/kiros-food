import { Minus, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Props {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  /** Show a trash icon instead of minus when at min (cart lines). */
  removeAtMin?: boolean
  size?: "sm" | "default"
  className?: string
  disabled?: boolean
}

export function QuantityStepper({ value, onChange, min = 1, max = 99, removeAtMin = false, size = "default", className, disabled }: Props) {
  const atMin = value <= min
  return (
    <div className={cn("inline-flex items-center rounded-lg border bg-card", className)} data-cy="qty-stepper">
      <Button type="button" variant="ghost" size={size === "sm" ? "icon-sm" : "icon"} disabled={disabled || (atMin && !removeAtMin)} onClick={() => onChange(atMin ? min - 1 : value - 1)} aria-label={atMin && removeAtMin ? "Remove" : "Decrease"} data-cy="qty-minus">
        {atMin && removeAtMin ? <Trash2 className="text-destructive" /> : <Minus />}
      </Button>
      <span className={cn("min-w-8 text-center font-medium tabular-nums", size === "sm" ? "text-sm" : "text-base")} aria-live="polite" data-cy="qty-value">
        {value}
      </span>
      <Button type="button" variant="ghost" size={size === "sm" ? "icon-sm" : "icon"} disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label="Increase" data-cy="qty-plus">
        <Plus />
      </Button>
    </div>
  )
}
