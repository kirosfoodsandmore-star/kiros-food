import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { playChime } from "@/lib/chime"
import { ADMIN_ORDERS_KEY } from "./useAdminOrders"
import { useSocketEvent } from "./useSocketEvent"

/**
 * The moments a delivery needs this person's attention, each as a chime and a toast. The server sends them to one
 * person only, on whichever device they're using:
 *  - a delivery was assigned to them (a rider is asked to accept or decline)
 *  - the food they're carrying is ready to collect
 *  - a rider handed one back, or didn't answer in time and it was passed on (managers who can reassign it)
 *  - one they were given was passed to someone else because they didn't answer (the rider who missed it)
 * When the app is closed the same moments arrive as push notifications instead (see lib/push.ts).
 */
export function useDeliveryAlerts(soundOn: boolean, openPath: string) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const sound = useRef(soundOn)
  sound.current = soundOn
  const refresh = useCallback(() => void qc.invalidateQueries({ queryKey: [ADMIN_ORDERS_KEY] }), [qc])

  const onAssigned = useCallback(
    (d: { number: string; branchName: string; address: string | null; status?: string; riderResponse?: "pending" | "accepted" | null }) => {
      if (sound.current) playChime()
      const ask = d.riderResponse === "pending"
      toast.success(`New delivery ${d.number}`, {
        description: `${d.address ?? d.branchName}${ask ? " · Accept or decline" : ""}`,
        duration: 12_000,
        action: { label: "Open", onClick: () => navigate(openPath) },
      })
      refresh()
    },
    [navigate, openPath, refresh]
  )
  useSocketEvent("staff", "delivery:assigned", onAssigned)

  const onReady = useCallback(
    (d: { number: string; branchName: string; address: string | null }) => {
      if (sound.current) playChime()
      toast.success(`${d.number} is ready for pickup`, { description: `${d.branchName}${d.address ? ` · ${d.address}` : ""}`, duration: 12_000, action: { label: "Open", onClick: () => navigate(openPath) } })
      refresh()
    },
    [navigate, openPath, refresh]
  )
  useSocketEvent("staff", "delivery:ready", onReady)

  const onDeclined = useCallback(
    (d: { id: string; number: string; branchName: string; riderName: string; reason: string | null }) => {
      if (sound.current) playChime()
      toast.warning(`${d.riderName} can't take ${d.number}`, {
        description: `${d.reason ? `“${d.reason}” · ` : ""}${d.branchName}. Choose another rider.`,
        duration: 20_000,
        action: { label: "Open", onClick: () => navigate(`/admin/orders/${d.id}`) },
      })
      refresh()
    },
    [navigate, refresh]
  )
  useSocketEvent("staff", "delivery:declined", onDeclined)

  const onPassed = useCallback(
    (d: { id: string; number: string; branchName: string; riderName: string; nextRiderName: string | null }) => {
      if (sound.current) playChime()
      const action = { label: "Open", onClick: () => navigate(`/admin/orders/${d.id}`) }
      if (d.nextRiderName) toast.info(`${d.riderName} didn't answer ${d.number}`, { description: `Passed to ${d.nextRiderName}.`, duration: 15_000, action })
      else toast.warning(`No rider for ${d.number}`, { description: `${d.riderName} didn't answer and nobody else is on duty at ${d.branchName}. Assign a rider.`, duration: 20_000, action })
      refresh()
    },
    [navigate, refresh]
  )
  useSocketEvent("staff", "delivery:passed", onPassed)

  const onExpired = useCallback(
    (d: { number: string }) => {
      toast.info(`${d.number} was passed to another rider`, { description: "You didn't answer in time.", duration: 10_000 })
      refresh()
    },
    [refresh]
  )
  useSocketEvent("staff", "delivery:expired", onExpired)
}
