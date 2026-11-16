import { AlertTriangle, Inbox } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function EmptyState({ title, description, action, icon, className }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center", className)} data-cy="empty-state">
      <div className="text-muted-foreground">{icon ?? <Inbox className="size-8" />}</div>
      <h3 className="font-display font-semibold">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center", className)} role="alert" data-cy="error-state">
      <AlertTriangle className="size-8 text-destructive" />
      <p className="text-sm">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} data-cy="retry">
          Try again
        </Button>
      ) : null}
    </div>
  )
}
