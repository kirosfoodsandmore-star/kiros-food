// Collapsible option group with its rule in plain words ("Pick 2", "Pick up to 10"), a live "{n} of {max} chosen"
// counter and, after a failed add, what is still missing. max 1 → radios; otherwise checkboxes that block
// selection past the max.
import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { Money } from "@/components/shared/Money"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { CurrencyFormat } from "@/lib/money"
import { ruleLabel, ruleShortfall } from "@/lib/optionRules"
import { cn } from "@/lib/utils"
import type { StoreOptionGroup } from "@/types/store.types"

interface Props {
  group: StoreOptionGroup
  selected: string[]
  onChange: (ids: string[]) => void
  fmt: CurrencyFormat
  showError?: boolean
}

export function OptionGroupPanel({ group, selected, onChange, fmt, showError }: Props) {
  const [openPanel, setOpenPanel] = useState(true)
  const count = selected.length
  const satisfied = count >= group.minSelect && count <= group.maxSelect
  const single = group.maxSelect === 1
  const shortfall = ruleShortfall(group, count)

  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      if (count >= group.maxSelect) return
      onChange([...selected, id])
    } else onChange(selected.filter((s) => s !== id))
  }

  return (
    <section className={cn("rounded-xl border bg-card", showError && !satisfied && "border-destructive")} data-cy={`option-group-${group.id}`}>
      <button type="button" className="flex w-full items-center justify-between gap-2 p-4 text-left" onClick={() => setOpenPanel((o) => !o)} aria-expanded={openPanel} data-cy="option-group-toggle">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-semibold">{group.name}</h3>
            <Badge variant={group.required ? (satisfied ? "success" : "warning") : "neutral"}>{group.required ? "Required" : "Optional"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground" data-cy="option-group-rule">
            {ruleLabel(group)}
            {group.helpText ? ` · ${group.helpText}` : ""}
          </p>
          {showError && shortfall ? <p className="text-sm font-medium text-destructive">Please {shortfall}.</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          <span aria-live="polite" data-cy="option-group-counter">
            {count} of {group.maxSelect} chosen
          </span>
          <ChevronDown className={cn("size-4 transition", openPanel && "rotate-180")} />
        </div>
      </button>
      {openPanel ? (
        <div className="border-t px-2 pb-2">
          {single ? (
            <RadioGroup value={selected[0] ?? (group.required ? "" : NONE)} onValueChange={(v) => onChange(v === NONE ? [] : [v])} className="gap-0">
              {/* Optional single choice (e.g. a protein add-on): a radio cannot be unticked, so offer "None". */}
              {!group.required ? (
                <label className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted" data-cy="option-none">
                  <RadioGroupItem value={NONE} />
                  <span className="flex-1 text-muted-foreground">None</span>
                </label>
              ) : null}
              {group.options.map((o) => (
                <label key={o.id} className={cn("flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted", !o.isAvailable && "opacity-50")} data-cy={`option-${o.id}`}>
                  <RadioGroupItem value={o.id} disabled={!o.isAvailable} />
                  <span className="flex-1">{o.name}</span>
                  <OptionPrice delta={o.priceDelta} available={o.isAvailable} fmt={fmt} />
                </label>
              ))}
            </RadioGroup>
          ) : (
            group.options.map((o) => {
              const checked = selected.includes(o.id)
              const blocked = !checked && count >= group.maxSelect
              return (
                <label key={o.id} className={cn("flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted", (!o.isAvailable || blocked) && "opacity-50")} data-cy={`option-${o.id}`}>
                  <Checkbox checked={checked} disabled={!o.isAvailable || blocked} onCheckedChange={(v) => toggle(o.id, v === true)} />
                  <span className="flex-1">{o.name}</span>
                  <OptionPrice delta={o.priceDelta} available={o.isAvailable} fmt={fmt} />
                </label>
              )
            })
          )}
        </div>
      ) : null}
    </section>
  )
}

const NONE = "__none__"

function OptionPrice({ delta, available, fmt }: { delta: number; available: boolean; fmt: CurrencyFormat }) {
  if (!available) return <span className="text-xs text-destructive">Sold out</span>
  if (delta === 0) return null
  return (
    <span className="text-sm text-muted-foreground">
      {delta > 0 ? "+" : "−"}
      <Money value={Math.abs(delta)} fmt={fmt} />
    </span>
  )
}
