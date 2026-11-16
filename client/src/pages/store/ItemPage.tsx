import { ChevronRight, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Money } from "@/components/shared/Money"
import { QuantityStepper } from "@/components/shared/QuantityStepper"
import { ErrorState } from "@/components/shared/States"
import { ItemCard } from "@/components/store/ItemCard"
import { OptionGroupPanel } from "@/components/store/OptionGroupPanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/contexts/StoreContext"
import { useCart } from "@/hooks/useCart"
import { useStoreItem } from "@/hooks/useStore"
import { cn } from "@/lib/utils"
import { useStoreSession } from "@/stores/storeSession"
import { ItemGallery } from "@/components/store/ItemGallery"

export default function ItemPage() {
  const { slug, fmt } = useStore()
  const { itemId } = useParams()
  const [params] = useSearchParams()
  const editingLineId = params.get("line")
  const navigate = useNavigate()
  const { branchId, open } = useStoreSession()
  const { data: item, isLoading, error, refetch } = useStoreItem(slug, itemId ?? null, branchId)
  const { cart, addLine, updateLine } = useCart()
  const editingLine = editingLineId ? cart?.lines.find((l) => l.id === editingLineId) : undefined

  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState("")
  const [showErrors, setShowErrors] = useState(false)

  // Preselect: the line being edited. Otherwise customers make every choice themselves (a salad's base and
  // dressing must be picked, not defaulted); only a required single choice with one available option is filled in.
  useEffect(() => {
    if (!item) return
    const next: Record<string, string[]> = {}
    for (const g of item.optionGroups) {
      if (editingLine) next[g.id] = editingLine.options.filter((o) => o.groupId === g.id).map((o) => o.optionId)
      else {
        const available = g.options.filter((o) => o.isAvailable)
        next[g.id] = g.required && g.maxSelect === 1 && available.length === 1 ? [available[0].id] : []
      }
    }
    setSelected(next)
    if (editingLine) {
      setQty(editingLine.quantity)
      setNote(editingLine.note ?? "")
    }
  }, [item, editingLine])

  const { total, ok, missing } = useMemo(() => {
    if (!item) return { total: 0, ok: false, missing: [] as string[] }
    let delta = 0
    let valid = true
    const missing: string[] = []
    for (const g of item.optionGroups) {
      const ids = selected[g.id] ?? []
      if (ids.length < g.minSelect || ids.length > g.maxSelect) valid = false
      if (ids.length < g.minSelect) missing.push(g.minSelect - ids.length === g.minSelect ? g.name : `${g.minSelect - ids.length} more ${g.name.toLowerCase()}`)
      for (const id of ids) {
        const o = g.options.find((x) => x.id === id)
        if (!o || !o.isAvailable) valid = false
        delta += o?.priceDelta ?? 0
      }
    }
    return { total: Math.max(0, item.basePrice + delta) * qty, ok: valid && item.isAvailable, missing }
  }, [item, selected, qty])

  const submit = () => {
    if (!item) return
    if (!ok) return setShowErrors(true)
    if (!branchId) return open("branch")
    const selectedOptionIds = Object.values(selected).flat()
    const done = () => {
      toast.success(editingLine ? "Bag updated" : `${item.name} added to your bag`)
      open("cart")
      navigate(`/${slug}/menu`)
    }
    if (editingLine) updateLine.mutate({ lineId: editingLine.id, quantity: qty, note: note || null, selectedOptionIds }, { onSuccess: done, onError: (e) => toast.error(e.message) })
    else addLine.mutate({ itemId: item.id, quantity: qty, note: note || null, selectedOptionIds }, { onSuccess: done, onError: (e) => toast.error(e.message) })
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 py-6 md:grid-cols-2">
        <Skeleton className="aspect-square" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-20" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }
  if (error || !item) return <div className="py-8"><ErrorState message="This item could not be loaded." onRetry={() => void refetch()} /></div>

  return (
    <div className="relative grid gap-6 py-6 md:grid-cols-2" data-cy="item-page">
      <Button variant="outline" size="icon" className="absolute right-0 top-6 z-10 rounded-full" onClick={() => navigate(`/${slug}/menu`)} aria-label="Back to menu" data-cy="item-close">
        <X />
      </Button>
      <ItemGallery key={item.id} name={item.name} hint={item.categoryName} images={item.images ?? []} fallbackUrl={item.imageUrl} />
      <div className="space-y-5 pb-28 md:pb-0">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link to={`/${slug}/menu`} className="hover:underline">{item.menuName}</Link>
          <ChevronRight className="size-3" />
          <Link to={`/${slug}/menu#cat-${item.categoryId}`} className="hover:underline">{item.categoryName}</Link>
        </nav>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold sm:text-3xl">{item.name}</h1>
            {!item.isAvailable ? <Badge variant="danger">Sold out</Badge> : null}
          </div>
          <p className="mt-1 text-lg"><Money value={item.basePrice} fmt={fmt} /></p>
          {item.description ? <p className="mt-2 text-muted-foreground">{item.description}</p> : null}
        </div>
        <div className="space-y-3">
          {item.optionGroups.map((g) => (
            <OptionGroupPanel key={g.id} group={g} selected={selected[g.id] ?? []} onChange={(ids) => setSelected((s) => ({ ...s, [g.id]: ids }))} fmt={fmt} showError={showErrors} />
          ))}
        </div>
        <div>
          <label htmlFor="item-note" className="text-sm font-medium">Note for the kitchen (optional)</label>
          <Textarea id="item-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="No onions, dressing on the side…" maxLength={255} className="mt-1" data-cy="item-note" />
          <p className="mt-1 text-xs text-muted-foreground">We'll pass this on and do our best, but we can't always promise every change.</p>
        </div>
        {item.recommendations.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold">Goes well with</h2>
            <div className="mt-2 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {item.recommendations.map((r) => (
                <div key={r.id} className="w-44 shrink-0">
                  <ItemCard item={r} slug={slug} fmt={fmt} />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 p-3 backdrop-blur safe-bottom md:sticky md:col-span-2 md:rounded-xl md:border" data-cy="item-footer">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <QuantityStepper value={qty} onChange={setQty} />
          <Button className="flex-1" size="lg" variant="accent" disabled={!item.isAvailable} loading={addLine.isPending || updateLine.isPending} onClick={submit} data-cy="add-to-bag">
            {editingLine ? "Update bag" : "Add to bag"} · <Money value={total} fmt={fmt} />
          </Button>
        </div>
        {!ok && item.isAvailable ? (
          <p className={cn("mt-1 text-center text-xs", showErrors ? "text-destructive" : "text-muted-foreground")} data-cy="item-missing">
            {missing.length > 0 ? `Still to choose: ${missing.join(", ")}.` : "Some choices are no longer available. Please change them to continue."}
          </p>
        ) : null}
      </div>
    </div>
  )
}
