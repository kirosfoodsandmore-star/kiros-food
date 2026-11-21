// Under the chat on a customer's order page: opt in to an alert when the branch replies, even after they've left the
// site or locked their phone. Shown until they turn it on; once on, a quiet line lets them turn it off. Nothing is shown
// when the restaurant hasn't set up notifications, the browser can't receive them, or the customer blocked them (a
// nagging card they can't act on would only be noise).
import { Bell, BellRing } from "lucide-react"
import { useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { useCustomer } from "@/contexts/CustomerContext"
import { usePush } from "@/hooks/usePush"
import { refreshPush, type PushTarget } from "@/lib/push"

export function ReplyAlerts({ slug }: { slug: string }) {
  const target = useMemo<PushTarget>(() => ({ kind: "customer", slug }), [slug])
  const { state, busy, turnOn, turnOff, recheck } = usePush(target)
  const { session } = useCustomer()
  const customerId = session?.customer.id
  // Already allowed on this device: make sure the server has this device under the customer who is signed in now (a guest
  // who later verifies an email becomes a different record). Then show where things stand.
  useEffect(() => {
    if (customerId) void refreshPush(target).then(recheck)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recheck only changes with the target
  }, [target, customerId])

  if (state === "off") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3" data-cy="reply-alerts-prompt">
        <BellRing className="size-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-sm">
          <span className="block font-medium">Get an alert when the branch replies</span>
          <span className="text-muted-foreground">Even if you've left this page.</span>
        </p>
        <Button size="sm" onClick={() => void turnOn()} loading={busy} data-cy="reply-alerts-enable">Turn on</Button>
      </div>
    )
  }
  if (state === "on") {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted-foreground" data-cy="reply-alerts-on">
        <Bell className="size-3.5 text-success" aria-hidden /> Reply alerts are on for this device.
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void turnOff()} loading={busy} data-cy="reply-alerts-disable">Turn off</Button>
      </p>
    )
  }
  return null
}
