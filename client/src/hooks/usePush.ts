import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { disablePush, enablePush, pushState, STAFF_PUSH, type PushState, type PushTarget } from "@/lib/push"

/** This device's notification state (for staff by default, or for a customer's reply alerts), plus the two ways to change it. `null` while it's being worked out. */
export function usePush(target: PushTarget = STAFF_PUSH) {
  const slug = target.kind === "customer" ? target.slug : ""
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the target is described by its kind and slug
  const check = useCallback(() => void pushState(target).then(setState), [target.kind, slug])
  useEffect(check, [check])

  const turnOn = async () => {
    setBusy(true)
    try {
      await enablePush(target)
      toast.success(target.kind === "customer" ? "We'll alert you when the branch replies" : "Notifications are on for this device")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
      check()
    }
  }
  const turnOff = async () => {
    setBusy(true)
    try {
      await disablePush(false, target)
    } finally {
      setBusy(false)
      check()
    }
  }
  return { state, busy, turnOn, turnOff, recheck: check }
}
