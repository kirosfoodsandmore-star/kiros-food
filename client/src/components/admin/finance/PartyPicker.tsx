// Type-ahead for saved vendors & customers. Suggestions show inline under the box (a floating list would be clipped by
// the scrolling dialog); names already used with this kind of entry come first. Typing a new name is fine: it's saved
// as a new vendor / customer when the entry is recorded.
import { Plus } from "lucide-react"
import { useId, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { FinanceKind, FinanceParty } from "@/types/finance.types"

export interface PartyValue {
  partyId?: string
  name: string
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")

export function PartyPicker({ value, onChange, parties, kind, placeholder, ariaLabel, dataCy, autoFocus }: {
  value: PartyValue
  onChange: (v: PartyValue) => void
  parties: FinanceParty[]
  kind: FinanceKind
  placeholder?: string
  ariaLabel: string
  dataCy?: string
  autoFocus?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const blurTimer = useRef<number | undefined>(undefined)
  const q = norm(value.name)
  const exact = parties.find((p) => norm(p.name) === q)

  const suggestions = useMemo(() => {
    const matches = parties.filter((p) => !q || norm(p.name).includes(q))
    matches.sort((a, b) => Number(b.kinds.includes(kind)) - Number(a.kinds.includes(kind)) || Number(norm(b.name).startsWith(q)) - Number(norm(a.name).startsWith(q)) || b.entries - a.entries || a.name.localeCompare(b.name))
    return matches.slice(0, 6)
  }, [parties, q, kind])
  const showAdd = Boolean(q) && !exact
  const options: Array<{ party?: FinanceParty; add?: string }> = [...suggestions.map((party) => ({ party })), ...(showAdd ? [{ add: value.name.trim() }] : [])]

  const pick = (o: { party?: FinanceParty; add?: string }) => {
    if (o.party) onChange({ partyId: o.party.id, name: o.party.name })
    else onChange({ name: o.add ?? value.name })
    setOpen(false)
  }

  return (
    <div className="min-w-0">
      <Input
        value={value.name}
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
        onChange={(e) => {
          const name = e.target.value
          const match = parties.find((p) => norm(p.name) === norm(name))
          onChange({ name, partyId: match?.id })
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (!open || options.length === 0) return
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % options.length) }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length) }
          else if (e.key === "Enter") { e.preventDefault(); pick(options[active] ?? options[0]) }
          else if (e.key === "Escape") { e.stopPropagation(); setOpen(false) }
        }}
      />
      {open && options.length > 0 && (q || parties.length > 0) ? (
        <ul id={listId} role="listbox" className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card p-1 text-sm shadow-sm">
          {options.map((o, i) => (
            <li
              key={o.party?.id ?? `add-${o.add}`}
              role="option"
              aria-selected={i === active}
              className={cn("flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5", i === active && "bg-muted")}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
            >
              {o.party ? (
                <>
                  <span className="truncate">{o.party.name}</span>
                  {o.party.entries ? <span className="shrink-0 text-xs text-muted-foreground">{o.party.entries} {o.party.entries === 1 ? "entry" : "entries"}</span> : null}
                </>
              ) : (
                <span className="flex items-center gap-1.5 text-primary"><Plus className="size-3.5" />Add “{o.add}” as new</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
