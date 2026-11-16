import { Badge } from "@/components/ui/badge"
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/lib/enums"
import type { OrderStatus } from "@/types/store.types"

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <Badge variant={ORDER_STATUS_TONE[status]} className={className} data-cy={`status-${status}`}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  )
}
