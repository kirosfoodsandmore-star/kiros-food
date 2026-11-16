import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useBranches } from "@/hooks/useAdminBranches"

export function BranchSelect({ value, onChange, allowAll = false, className }: { value: string; onChange: (id: string) => void; allowAll?: boolean; className?: string }) {
  const { data } = useBranches()
  return (
    <Select value={value || (allowAll ? "__all" : "")} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger className={className ?? "w-56"} data-cy="branch-select"><SelectValue placeholder="Branch" /></SelectTrigger>
      <SelectContent>
        {allowAll ? <SelectItem value="__all">All branches</SelectItem> : null}
        {(data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
