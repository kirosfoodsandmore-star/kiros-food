import { Loader2 } from "lucide-react"

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 text-muted-foreground" role="status" data-cy="page-loader">
      <Loader2 className="size-6 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  )
}
