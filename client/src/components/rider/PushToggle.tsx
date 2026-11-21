// "Notifications on this device", for the account page: the full on/off switch with the reason when it can't be used.
import { Bell } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/contexts/AuthContext"
import { usePush } from "@/hooks/usePush"

const ORDER_STAFF_TEXT = "New orders, payments to confirm, and anything a rider hands back, even when this app is closed."
const RIDER_TEXT = "New deliveries, orders that are ready to collect, and anything handed back, even when this app is closed."

const UNAVAILABLE: Record<string, string> = {
  unconfigured: "Notifications haven't been set up for this restaurant yet.",
  unsupported: "This browser can't receive notifications. On an iPhone, add this app to your Home Screen first (Share → Add to Home Screen), then open it from there.",
  blocked: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back here.",
}

export function PushToggle() {
  const { state, busy, turnOn, turnOff } = usePush()
  const { canAny } = useAuth()
  const handlesOrders = canAny("orders.update_status", "orders.reject", "payments.confirm")
  if (state === null) return null
  const usable = state === "on" || state === "off"
  return (
    <div className="flex items-start gap-3" data-cy="push-toggle">
      <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Notifications on this device</p>
        <p className="text-sm text-muted-foreground">{usable ? (handlesOrders ? ORDER_STAFF_TEXT : RIDER_TEXT) : UNAVAILABLE[state]}</p>
      </div>
      {usable ? <Switch checked={state === "on"} onCheckedChange={(on) => void (on ? turnOn() : turnOff())} disabled={busy} aria-label="Notifications on this device" data-cy="push-switch" /> : null}
    </div>
  )
}
