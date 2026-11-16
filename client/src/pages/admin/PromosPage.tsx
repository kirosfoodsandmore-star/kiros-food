import { format } from "date-fns"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { SimpleFormDialog, type FieldDef } from "@/components/admin/SimpleFormDialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Money } from "@/components/shared/Money"
import { PageLoader } from "@/components/shared/PageLoader"
import { Pagination } from "@/components/shared/Pagination"
import { SearchInput } from "@/components/shared/SearchInput"
import { EmptyState } from "@/components/shared/States"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import { useBranches } from "@/hooks/useAdminBranches"
import { useMenus } from "@/hooks/useAdminMenu"
import { usePromoMutations, usePromos } from "@/hooks/useAdminMisc"
import { useAdminCurrency } from "@/hooks/useFormatters"
import { useDebouncedSearch } from "@/hooks/useDebounce"
import type { PromoCode } from "@/types/admin.types"

export default function PromosPage() {
  const fmt = useAdminCurrency()
  const { can } = useAuth()
  const manage = can("promos.manage")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const term = useDebouncedSearch(search)
  useEffect(() => setPage(1), [term])
  const { data: res, isLoading } = usePromos({ page, search: term || undefined })
  const promos = res?.data
  const { data: branches } = useBranches()
  const { data: menus } = useMenus()
  const m = usePromoMutations()
  const [dialog, setDialog] = useState<{ open: boolean; promo?: PromoCode }>({ open: false })
  const [del, setDel] = useState<PromoCode | null>(null)

  const fields = useMemo<FieldDef[]>(() => [
    { name: "code", label: "Code", type: "text", required: true, placeholder: "WELCOME10" },
    { name: "type", label: "Type", type: "select", required: true, options: [{ value: "percent", label: "Percentage off" }, { value: "fixed", label: "Fixed amount off" }], default: "percent" },
    { name: "value", label: "Value (percent, or amount in kobo for fixed)", type: "number", required: true, hint: "For fixed discounts enter kobo, e.g. 50000 = ₦500." },
    { name: "minSpend", label: "Minimum spend", type: "money", default: "0" },
    { name: "startsAt", label: "Starts", type: "datetime" },
    { name: "endsAt", label: "Ends", type: "datetime" },
    { name: "maxUses", label: "Max total uses", type: "number" },
    { name: "maxUsesPerCustomer", label: "Max uses per customer", type: "number" },
    { name: "branchId", label: "Restrict to branch", type: "select", options: (branches ?? []).map((b) => ({ value: b.id, label: b.name })) },
    { name: "menuId", label: "Restrict to menu", type: "select", options: (menus ?? []).map((x) => ({ value: x.id, label: x.name })) },
    { name: "isActive", label: "Active", type: "switch", default: true },
  ], [branches, menus])

  return (
    <div data-cy="promos-page">
      <PageHeader title="Promo codes" actions={manage ? <Button onClick={() => setDialog({ open: true })} data-cy="promo-new"><Plus /> New code</Button> : null} />
      <SearchInput value={search} onChange={setSearch} placeholder="Search codes" className="mb-4 w-72" dataCy="promos-search" />
      {isLoading ? <PageLoader /> : !promos || promos.length === 0 ? <EmptyState title={term ? "No codes match your search" : "No promo codes yet"} /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Discount</TableHead><TableHead>Min spend</TableHead><TableHead>Valid</TableHead><TableHead>Uses</TableHead><TableHead>Scope</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {promos.map((p) => (
              <TableRow key={p.id} data-cy={`promo-${p.id}`}>
                <TableCell><span className="font-mono font-semibold">{p.code}</span>{!p.isActive ? <Badge variant="neutral" className="ml-2">Off</Badge> : null}</TableCell>
                <TableCell>{p.type === "percent" ? `${p.value}%` : <Money value={p.value} fmt={fmt} />}</TableCell>
                <TableCell><Money value={p.minSpend} fmt={fmt} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.startsAt ? format(new Date(p.startsAt), "d MMM") : "now"} → {p.endsAt ? format(new Date(p.endsAt), "d MMM yyyy") : "no end"}</TableCell>
                <TableCell>{p.usedCount}{p.maxUses ? ` / ${p.maxUses}` : ""}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{[p.branchId && branches?.find((b) => b.id === p.branchId)?.name, p.menuId && menus?.find((x) => x.id === p.menuId)?.name].filter(Boolean).join(" · ") || "Everywhere"}</TableCell>
                <TableCell className="text-right">{manage ? <><Button variant="ghost" size="icon-sm" onClick={() => setDialog({ open: true, promo: p })} aria-label="Edit"><Pencil /></Button><Button variant="ghost" size="icon-sm" onClick={() => setDel(p)} aria-label="Delete"><Trash2 className="text-destructive" /></Button></> : null}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pagination meta={res?.meta} onPageChange={setPage} />
      <SimpleFormDialog open={dialog.open} onOpenChange={(o) => setDialog({ open: o })} title={dialog.promo ? "Edit promo code" : "New promo code"} fields={fields} initial={dialog.promo as unknown as Record<string, unknown> | undefined} onSubmit={async (v) => { if (dialog.promo) await m.update.mutateAsync({ id: dialog.promo.id, body: v }); else await m.create.mutateAsync(v) }} />
      <ConfirmDialog open={Boolean(del)} onOpenChange={(o) => !o && setDel(null)} title={`Delete ${del?.code}?`} confirmLabel="Delete" loading={m.remove.isPending} onConfirm={async () => { await m.remove.mutateAsync(del!.id).catch((e) => toast.error(e.message)); setDel(null) }} />
    </div>
  )
}
