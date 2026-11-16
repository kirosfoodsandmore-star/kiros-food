// Proof of receipt. The customer reads out the 4-digit code from their order page (or email); the rider types it in
// to mark the delivery done. A wrong code is counted by the server, so guessing doesn't work.
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { plural } from "@/lib/utils"

interface Props {
  /** The delivery being finished; null keeps the dialog closed. */
  order: { id: string; number: string; attemptsLeft: number } | null
  busy: boolean
  /** Shown under the box when the last code was wrong. */
  error: string | null
  onSubmit: (code: string) => void
  onOpenChange: (open: boolean) => void
}

export function DeliveryCodeDialog({ order, busy, error, onSubmit, onOpenChange }: Props) {
  const [code, setCode] = useState("")
  useEffect(() => setCode(""), [order?.id])
  // A wrong code clears the box so the next try starts fresh.
  useEffect(() => {
    if (error) setCode("")
  }, [error])

  const locked = (order?.attemptsLeft ?? 1) <= 0

  return (
    <Dialog open={Boolean(order)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-cy="code-dialog">
        <DialogHeader>
          <DialogTitle>Ask the customer for their code</DialogTitle>
          <DialogDescription>
            {locked
              ? `Too many wrong codes for ${order?.number}. Ask the restaurant to complete this delivery.`
              : `Their 4-digit delivery code is on their order page. Enter it to finish ${order?.number}.`}
          </DialogDescription>
        </DialogHeader>
        {!locked ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.length === 4) onSubmit(code)
            }}
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={4}
              placeholder="0000"
              aria-label="Delivery code"
              className="h-14 text-center font-mono text-3xl tracking-[0.5em]"
              data-cy="code-input"
            />
            {error ? <p className="text-center text-sm text-destructive" role="alert" data-cy="code-error">{error}</p> : null}
            {order && order.attemptsLeft < 5 && !error ? <p className="text-center text-xs text-muted-foreground">{plural(order.attemptsLeft, "try", "tries")} left</p> : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" variant="accent" loading={busy} disabled={code.length !== 4} data-cy="code-submit">Confirm delivered</Button>
            </DialogFooter>
          </form>
        ) : (
          <DialogFooter><Button onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
