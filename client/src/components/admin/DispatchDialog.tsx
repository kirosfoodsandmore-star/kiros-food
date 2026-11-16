// Shown before a delivery order goes out with nobody assigned. It asks who's taking it, because an order sent out
// without a rider never appears on any rider's phone and only a manager can mark it delivered. Sending it out
// without a rider is still possible (some restaurants deliver themselves), but it takes a deliberate click.
import { Info } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useOrderMutations, useRiders } from "@/hooks/useAdminOrders"

interface Props {
  /** The delivery about to go out; null keeps the dialog closed. */
  order: { id: string; number: string; branchName: string } | null
  onOpenChange: (open: boolean) => void
}

export function DispatchDialog({ order, onOpenChange }: Props) {
  const { data: riders, isLoading } = useRiders(order?.id, Boolean(order))
  const { assignRider, changeStatus } = useOrderMutations()
  const [riderId, setRiderId] = useState("")
  const [busy, setBusy] = useState<"assign" | "skip" | null>(null)

  useEffect(() => {
    setRiderId("")
  }, [order?.id])
  const available = (riders ?? []).filter((r) => r.onDuty)
  // One rider on duty: no need to make anyone pick. If the chosen one switches off meanwhile, the choice is dropped.
  useEffect(() => {
    if (available.length === 1) setRiderId(available[0].id)
    else setRiderId((cur) => (available.some((r) => r.id === cur) ? cur : ""))
  }, [riders]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendOut = async (withRider: boolean) => {
    if (!order) return
    setBusy(withRider ? "assign" : "skip")
    try {
      if (withRider) await assignRider.mutateAsync({ id: order.id, riderId })
      await changeStatus.mutateAsync({ id: order.id, status: "out_for_delivery" })
      const rider = riders?.find((r) => r.id === riderId)
      toast.success(withRider && rider ? `${order.number} is on its way with ${rider.name}` : `${order.number} is out for delivery`)
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const none = !isLoading && (riders?.length ?? 0) === 0

  return (
    <Dialog open={Boolean(order)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-cy="dispatch-dialog">
        <DialogHeader>
          <DialogTitle>Who's delivering {order?.number}?</DialogTitle>
          <DialogDescription>The rider sees it under My deliveries and gets an alert straight away.</DialogDescription>
        </DialogHeader>

        {isLoading ? <p className="text-sm text-muted-foreground">Finding riders…</p> : null}

        {none ? (
          <div className="flex gap-2.5 rounded-lg bg-muted/60 p-3 text-sm" data-cy="dispatch-no-riders">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p>
              No riders are set up for {order?.branchName} yet. Add one in{" "}
              <Link to="/admin/staff" className="font-medium text-primary hover:underline" onClick={() => onOpenChange(false)}>Staff & roles</Link>, giving them the Rider role and this branch, and they'll appear here.
            </p>
          </div>
        ) : null}

        {!none && !isLoading && available.length === 0 ? (
          <div className="flex gap-2.5 rounded-lg bg-muted/60 p-3 text-sm" data-cy="dispatch-all-off">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p>Every rider for {order?.branchName} is off duty right now. They switch themselves on in their app when they're available, and will show up here.</p>
          </div>
        ) : null}

        {(riders?.length ?? 0) > 0 ? (
          <Field label="Rider">
            <Select value={riderId} onValueChange={setRiderId}>
              <SelectTrigger data-cy="dispatch-rider"><SelectValue placeholder="Choose a rider" /></SelectTrigger>
              <SelectContent>
                {(riders ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id} disabled={!r.onDuty}>
                    {r.name}{r.phone ? ` · ${r.phone}` : ""}{r.onDuty ? "" : " · Off duty"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <DialogFooter className="sm:flex-col sm:items-stretch sm:gap-2">
          {available.length > 0 ? (
            <Button onClick={() => void sendOut(true)} disabled={!riderId || busy !== null} loading={busy === "assign"} data-cy="dispatch-assign">Assign and send out</Button>
          ) : null}
          <Button variant="ghost" className="text-muted-foreground" onClick={() => void sendOut(false)} disabled={busy !== null} loading={busy === "skip"} data-cy="dispatch-skip">
            Send out without a rider
          </Button>
        </DialogFooter>
        <p className="-mt-2 text-center text-xs text-muted-foreground">Without a rider, it won't show on anyone's phone, and only a manager can mark it delivered.</p>
      </DialogContent>
    </Dialog>
  )
}
