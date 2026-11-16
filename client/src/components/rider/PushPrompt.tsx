// A nudge on the deliveries screen: without notifications a rider only hears about a new delivery while this screen
// is open. Shown until they turn it on (or the restaurant hasn't set notifications up, or the browser can't).
import { BellRing } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePush } from "@/hooks/usePush"

export function PushPrompt() {
  const { state, busy, turnOn } = usePush()
  if (state !== "off") return null
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4" data-cy="push-prompt">
      <BellRing className="size-5 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">
        <span className="block font-medium">Get an alert for every new delivery</span>
        <span className="text-muted-foreground">Even when your phone is locked or this app is closed.</span>
      </p>
      <Button size="sm" onClick={() => void turnOn()} loading={busy} data-cy="push-enable">Turn on alerts</Button>
    </div>
  )
}
