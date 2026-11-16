import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SearchInput({ value, onChange, placeholder = "Search…", className, autoFocus, dataCy = "search-input" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean; dataCy?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9 pr-9" autoFocus={autoFocus} aria-label={placeholder} data-cy={dataCy} />
      {value ? (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Clear search" data-cy={`${dataCy}-clear`}>
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
