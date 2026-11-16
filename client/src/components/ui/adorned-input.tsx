import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type AdornedInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Shown inside the box before the value, e.g. a currency symbol. */
  leading?: string
  /** Shown inside the box after the value, e.g. "km". */
  trailing?: string
}

/** An input with a unit or currency inside it, so nobody has to guess what a bare number means. */
export const AdornedInput = React.forwardRef<HTMLInputElement, AdornedInputProps>(({ leading, trailing, className, style, ...props }, ref) => (
  <div className="relative">
    {leading ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>{leading}</span> : null}
    <Input
      ref={ref}
      className={cn(className)}
      // Room for the adornment: roughly its width plus a gap.
      style={{ ...(leading ? { paddingLeft: `${0.75 + leading.length * 0.6 + 0.5}rem` } : null), ...(trailing ? { paddingRight: `${0.75 + trailing.length * 0.6 + 0.5}rem` } : null), ...style }}
      {...props}
    />
    {trailing ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>{trailing}</span> : null}
  </div>
))
AdornedInput.displayName = "AdornedInput"
