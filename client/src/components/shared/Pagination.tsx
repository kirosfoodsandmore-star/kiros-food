import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PaginationMeta } from "@/types/api.types"

export function Pagination({ meta, onPageChange }: { meta: PaginationMeta | undefined; onPageChange: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null
  const from = (meta.page - 1) * meta.limit + 1
  const to = Math.min(meta.page * meta.limit, meta.total)
  return (
    <div className="flex items-center justify-between gap-3 pt-3 text-sm text-muted-foreground" data-cy="pagination">
      <span>
        Showing {from}–{to} of {meta.total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={!meta.hasPrev} onClick={() => onPageChange(meta.page - 1)} aria-label="Previous page" data-cy="page-prev">
          <ChevronLeft />
        </Button>
        <span className="px-2">
          {meta.page} / {meta.totalPages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={!meta.hasNext} onClick={() => onPageChange(meta.page + 1)} aria-label="Next page" data-cy="page-next">
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
