// "Build your own" showcase: a live preview of the most configurable dish. It loads the dish's real
// option groups and cycles through choices, updating the price as it goes, so customers see the
// configurator before they ever open it.
import { ArrowRight, Check } from "lucide-react"
import { useState, type CSSProperties } from "react"
import { Link } from "react-router-dom"
import { Money } from "@/components/shared/Money"
import { Button } from "@/components/ui/button"
import { useInterval, usePrefersReducedMotion, useReveal } from "@/hooks/useMotion"
import { useStoreItem } from "@/hooks/useStore"
import type { CurrencyFormat } from "@/lib/money"
import { ruleLabel } from "@/lib/optionRules"
import { cn, plural } from "@/lib/utils"
import type { StoreItemCard } from "@/types/store.types"
import { FoodArt } from "../FoodArt"

interface Props {
  slug: string
  branchId: string | null
  fmt: CurrencyFormat
  items: StoreItemCard[]
  categoryName: (id: string) => string | undefined
  /** Restaurant-specific intro (e.g. how the salad builder works). */
  intro?: string
}

export function BuildYourOwn({ slug, branchId, fmt, items, categoryName, intro }: Props) {
  const [ref, visible] = useReveal<HTMLElement>(0.2)
  const reduced = usePrefersReducedMotion()
  const [active, setActive] = useState(0)
  const pick = items[active] ?? items[0]
  const { data: item } = useStoreItem(slug, pick?.id ?? null, branchId)
  const [tick, setTick] = useState(0)
  useInterval(() => setTick((t) => t + 1), 1500, visible && !reduced)
  if (!pick) return null

  const groups = (item?.optionGroups ?? []).filter((g) => g.options.some((o) => o.isAvailable)).slice(0, 5)
  // Each group advances on its own beat so the preview feels like someone is choosing. Multi-choice groups
  // pick as many as their rule asks for (e.g. exactly 2 cravings), capped at 3 so the preview stays readable.
  const chosen = groups.map((g, gi) => {
    const opts = g.options.filter((o) => o.isAvailable).slice(0, 6)
    const want = Math.max(1, Math.min(g.minSelect === g.maxSelect ? g.minSelect : 3, g.maxSelect, opts.length))
    const start = Math.floor((tick + gi * 2) / (gi + 1))
    const selected = Array.from({ length: want }, (_, k) => opts[(start + k * 2) % opts.length])
    return { group: g, opts, selected: [...new Set(selected)] }
  })
  const total = (item?.basePrice ?? pick.fromPrice) + chosen.reduce((sum, c) => sum + c.selected.reduce((s, o) => s + o.priceDelta, 0), 0)

  return (
    <section ref={ref} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2" data-cy="build-your-own">
      <div>
        <p className="reveal text-xs font-semibold uppercase tracking-[0.25em] text-[color-mix(in_srgb,var(--accent)_72%,black)] dark:text-accent">Build your own</p>
        <h2 className="reveal mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl" style={{ "--i": 1 } as CSSProperties}>
          Your order, <span className="italic text-primary">your way.</span>
        </h2>
        <p className="reveal mt-3 max-w-md text-muted-foreground" style={{ "--i": 2 } as CSSProperties}>
          {intro ?? "Pick a base, choose every option, and watch the price update as you build."}{items.length > 1 ? " Pick one to start:" : ""}
        </p>
        <ol className="mt-6 space-y-3">
          {items.map((it, i) => (
            <li key={it.id} className="reveal" style={{ "--i": i + 3 } as CSSProperties}>
              <button
                type="button"
                onClick={() => setActive(i)}
                className={cn("flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition", i === active ? "border-primary bg-secondary/60 shadow-sm" : "bg-card hover:border-primary/40")}
                aria-pressed={i === active}
                data-cy={`byo-${it.id}`}
              >
                <span className="size-14 shrink-0 overflow-hidden rounded-xl"><FoodArt name={it.name} hint={categoryName(it.categoryId)} imageUrl={it.imageUrl} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{it.name}</span>
                  <span className="text-sm text-muted-foreground">{plural(it.optionGroupCount, "choice")} to make</span>
                </span>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-semibold", i === active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{i + 1}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* Live preview */}
      <div className="reveal relative" style={{ "--i": 2 } as CSSProperties}>
        <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/20 via-gold/15 to-accent/20 blur-2xl" />
        <div className="overflow-hidden rounded-[2rem] border bg-card shadow-2xl">
          <div className="relative h-44 sm:h-52">
            <FoodArt name={pick.name} hint={categoryName(pick.categoryId)} imageUrl={pick.imageUrl} iconClassName="size-1/3" />
            <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              <span className="size-1.5 animate-pulse rounded-full bg-success" /> Live preview
            </span>
          </div>
          <div className="space-y-4 p-5 sm:p-6" aria-live="off">
            <p className="font-display text-xl font-semibold">{pick.name}</p>
            {chosen.length === 0 ? (
              <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />)}</div>
            ) : (
              chosen.map(({ group, opts, selected }) => (
                <div key={group.id}>
                  <p className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.name}
                    <span className={cn("normal-case tracking-normal", group.required && "text-[color-mix(in_srgb,var(--accent)_72%,black)] dark:text-accent")}>{ruleLabel(group)}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {opts.map((o) => {
                      const on = selected.some((s) => s.id === o.id)
                      return (
                        <span key={o.id} className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-all duration-300", on ? "scale-105 border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30" : "bg-card text-muted-foreground")}>
                          {on ? <Check className="size-3.5" /> : null}
                          {o.name}
                          {o.priceDelta > 0 ? <span className={cn("text-xs", on ? "opacity-80" : "opacity-60")}>+<Money value={o.priceDelta} fmt={fmt} /></span> : null}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Your price</p>
                <Money key={total} value={total} fmt={fmt} className="animate-card-in inline-block font-display text-2xl font-semibold tabular-nums" />
              </div>
              <Button variant="accent" size="lg" className="rounded-full" asChild>
                <Link to={`/${slug}/item/${pick.id}`}>
                  Build yours <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
