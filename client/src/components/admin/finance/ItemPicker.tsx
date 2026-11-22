// Type-ahead over the menu for "what was sold". Suggestions show inline (a floating list would be clipped by the
// scrolling dialog). Picking a menu item fills in its price; typing a name that isn't on the menu is allowed too.
import { Plus } from "lucide-react"
import { useId, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { SaleMenuItem } from "@/types/finance.types"

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")

export function ItemPicker({ value, menu, onType, onPick, formatPrice, placeholder, ariaLabel, dataCy, autoFocus }: {
  value: string
  menu: SaleMenuItem[]
  /** Typed text changed (no menu item chosen, or the choice no longer matches). */
  onType: (name: string, exact: SaleMenuItem | undefined) => void
  onPick: (item: SaleMenuItem) => void
  formatPrice: (kobo: number) => string
  placeholder?: string
  ariaLabel: string
  dataCy?: string
  autoFocus?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const blurTimer = useRef<number | undefined>(undefined)
  const q = norm(value)
  const exact = menu.find((m) => norm(m.name) === q)

  const matches = useMemo(() => {
    const list = q ? menu.filter((m) => norm(m.name).includes(q) || norm(m.category).includes(q)) : menu
    return [...list].sort((a, b) => Number(norm(b.name).startsWith(q)) - Number(norm(a.name).startsWith(q)))
  }, [menu, q])
  const showAdd = Boolean(q) && !exact
  const options: Array<{ item?: SaleMenuItem; add?: string }> = [...matches.map((item) => ({ item })), ...(showAdd ? [{ add: value.trim() }] : [])]

  const pick = (o: { item?: SaleMenuItem; add?: string }) => {
    if (o.item) onPick(o.item)
    else onType(o.add ?? value, undefined)
    setOpen(false)
  }

  return (
    <div className="min-w-0 flex-1">
      <Input
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        data-cy={dataCy}
        onFocus={() => { window.clearTimeout(blurTimer.current); setOpen(true) }}
        onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150) }}
        onChange={(e) => { onType(e.target.value, menu.find((m) => norm(m.name) === norm(e.target.value))); setActive(0); setOpen(true) }}
        onKeyDown={(e) => {
          if (!open || options.length === 0) return
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % options.length) }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length) }
          else if (e.key === "Enter") { e.preventDefault(); pick(options[active] ?? options[0]) }
          else if (e.key === "Escape") { e.stopPropagation(); setOpen(false) }
        }}
      />
      {open && options.length > 0 ? (
        <ul id={listId} role="listbox" className="mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-card p-1 text-sm shadow-sm">
          {options.map((o, i) => (
            <li
              key={o.item?.id ?? `add-${o.add}`}
              role="option"
              aria-selected={i === active}
              className={cn("flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5", i === active && "bg-muted")}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
            >
              {o.item ? (
                <>
                  <span className="min-w-0"><span className="block truncate">{o.item.name}</span><span className="block truncate text-xs text-muted-foreground">{o.item.category}</span></span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatPrice(o.item.price)}</span>
                </>
              ) : (
                <span className="flex items-center gap-1.5 text-primary"><Plus className="size-3.5" />Add “{o.add}” (not on the menu)</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
