import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push"

/** This device's notification state, plus the two ways to change it. `null` while it's being worked out. */
export function usePush() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const check = useCallback(() => void pushState().then(setState), [])
  useEffect(check, [check])

  const turnOn = async () => {
    setBusy(true)
    try {
      await enablePush()
      toast.success("Notifications are on for this device")
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
      await disablePush()
    } finally {
      setBusy(false)
      check()
    }
  }
  return { state, busy, turnOn, turnOff }
}
