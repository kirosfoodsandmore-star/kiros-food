// "I can't take this one": the rider gives a delivery back. The manager is told straight away (and gets the reason),
// and the order goes back to "unassigned" so it can be handed to someone else.
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const REASONS = ["Too far", "Vehicle problem", "Not available now", "Other"]

interface Props {
  /** The delivery being given back; null keeps the dialog closed. */
  order: { id: string; number: string } | null
  busy: boolean
  onConfirm: (reason: string) => void
  onOpenChange: (open: boolean) => void
}

export function DeclineDialog({ order, busy, onConfirm, onOpenChange }: Props) {
  const [reason, setReason] = useState("")
  useEffect(() => setReason(""), [order?.id])

  return (
    <Dialog open={Boolean(order)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-cy="decline-dialog">
        <DialogHeader>
          <DialogTitle>Can't take {order?.number}?</DialogTitle>
          <DialogDescription>It goes back to the manager, who'll give it to another rider. Tell them why so they can plan.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", reason === r ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
              data-cy={`decline-reason-${r.toLowerCase().replace(/\W+/g, "-")}`}
            >
              {r}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Keep it</Button>
          <Button variant="destructive" onClick={() => onConfirm(reason)} loading={busy} disabled={!reason} data-cy="decline-confirm">Give it back</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
