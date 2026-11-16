// The rider's "I'm available" switch. On: managers can give them deliveries. Off: they drop out of the dispatch
// list (deliveries they already have stay theirs). `card` is the big version for the deliveries screen; the
// compact one sits in the sidebar so it's reachable from every rider page.
import { Switch } from "@/components/ui/switch"
import { useMyAvailability } from "@/hooks/useAdminOrders"
import { cn } from "@/lib/utils"

export function OnDutySwitch({ variant = "card", className }: { variant?: "card" | "compact"; className?: string }) {
  const { onDuty, loading, saving, set } = useMyAvailability()
  if (loading || onDuty === null) return null
  const on = onDuty

  if (variant === "compact") {
    return (
      <label className={cn("mx-2 mb-1 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5", on ? "border-success/40 bg-success/10" : "bg-muted/40", className)} data-cy="rider-onduty-compact">
        <span className={cn("size-2.5 shrink-0 rounded-full", on ? "bg-success" : "bg-muted-foreground/50")} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-tight">{on ? "Available" : "Off duty"}</span>
          <span className="block text-xs text-muted-foreground">{on ? "You can get deliveries" : "No new deliveries"}</span>
        </span>
        <Switch checked={on} onCheckedChange={set} disabled={saving} aria-label="Available to deliver" data-cy="rider-onduty-switch-compact" />
      </label>
    )
  }

  return (
    <label className={cn("mb-5 flex cursor-pointer items-center gap-4 rounded-xl border p-4", on ? "border-success/40 bg-success/10" : "bg-muted/40", className)} data-cy="rider-onduty">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-base font-semibold">
          <span className={cn("size-2.5 rounded-full", on ? "bg-success" : "bg-muted-foreground/50")} aria-hidden />
          {on ? "You're available" : "You're off duty"}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {on ? "Managers can give you deliveries. Switch off when you can't take any." : "You won't be offered new deliveries. Switch on when you're ready. Any you already have are still yours."}
        </span>
      </span>
      <Switch checked={on} onCheckedChange={set} disabled={saving} aria-label="Available to deliver" data-cy="rider-onduty-switch" />
    </label>
  )
}
