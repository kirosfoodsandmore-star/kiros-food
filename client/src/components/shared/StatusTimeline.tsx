import { format } from "date-fns"
import { ORDER_STATUS_LABELS } from "@/lib/enums"
import type { OrderEvent } from "@/types/store.types"

export function StatusTimeline({ events }: { events: OrderEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No history yet.</p>
  return (
    <ol className="relative space-y-4 border-l pl-5" data-cy="status-timeline">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[1.6rem] top-1 size-3 rounded-full border-2 border-card bg-primary" />
          <p className="text-sm font-medium">{ORDER_STATUS_LABELS[e.toStatus]}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(e.createdAt), "d MMM yyyy, HH:mm")}
            {e.actorName ? ` · ${e.actorName}` : e.actorType === "system" ? " · System" : ""}
          </p>
          {e.note ? <p className="mt-1 text-sm">{e.note}</p> : null}
        </li>
      ))}
    </ol>
  )
}
