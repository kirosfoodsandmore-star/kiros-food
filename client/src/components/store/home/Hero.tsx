// Storefront hero: full-bleed ink stage with drifting aurora light, a word-by-word headline, live
// opening status, counting stats and an interactive 3D stack of the restaurant's real dishes.
import { ArrowRight, Bike, ChefHat, MapPin, MessageCircle, Plus, Store as StoreIcon } from "lucide-react"
import { Fragment, useRef, useState, type CSSProperties } from "react"
import { Link } from "react-router-dom"
import { Money } from "@/components/shared/Money"
import { Button } from "@/components/ui/button"
import { useCountUp, useInterval, usePrefersReducedMotion } from "@/hooks/useMotion"
import type { CurrencyFormat } from "@/lib/money"
import { storefrontExtras } from "@/lib/storefrontExtras"
import { cn, plural } from "@/lib/utils"
import type { StoreBranch, StoreItemCard } from "@/types/store.types"
import { BrandMark } from "../BrandMark"
import { FoodArt } from "../FoodArt"

interface HeroProps {
  slug: string
  name: string
  tagline: string | null
  logoUrl: string | null
  fmt: CurrencyFormat
  branches: StoreBranch[]
  branch: StoreBranch | undefined
  dishes: StoreItemCard[]
  /** Total dishes on offer (the showcase only holds a few). */
  dishCount: number
  categoryName: (categoryId: string) => string | undefined
  onFindBranch: () => void
}

/** "Two kitchens, one bag: café classics and bubble tea." → highlight what follows the colon (else the last two words). */
function splitHeadline(text: string): Array<{ word: string; highlight: boolean }> {
  const colon = text.indexOf(":")
  const words = text.split(/\s+/).filter(Boolean)
  if (colon > 0 && colon < text.length - 1) {
    const lead = text.slice(0, colon + 1).split(/\s+/).filter(Boolean)
    return words.map((word, i) => ({ word, highlight: i >= lead.length }))
  }
  return words.map((word, i) => ({ word, highlight: words.length > 3 && i >= words.length - 2 }))
}

export function Hero({ slug, name, tagline, logoUrl, fmt, branches, branch, dishes, dishCount, categoryName, onFindBranch }: HeroProps) {
  const headline = tagline || "Fresh from the farm, straight to you."
  const words = splitHeadline(headline)
  const copy = storefrontExtras(slug).home
  const openCount = branches.filter((b) => b.isOpen).length
  const cities = new Set(branches.map((b) => b.city)).size
  // Above the fold: count up as soon as the data is in.
  const nBranches = useCountUp(branches.length, branches.length > 0)
  const nCities = useCountUp(cities, cities > 0)
  const nDishes = useCountUp(dishCount, dishCount > 0)

  const status = branch
    ? branch.isOpen
      ? { live: true, text: <>Open now at <b className="font-semibold">{branch.name}</b>{branch.closesAt ? ` · till ${branch.closesAt}` : ""}</> }
      : { live: false, text: <><b className="font-semibold">{branch.name}</b> is closed{branch.nextOpenAt ? ` · opens ${new Date(branch.nextOpenAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : ""} · schedule ahead</> }
    : branches.length > 0
      ? { live: openCount > 0, text: <>{openCount} of {plural(branches.length, "branch", "branches")} open right now</> }
      : null

  return (
    <section className="grain relative isolate -mt-6 ml-[calc(50%-50vw)] w-screen overflow-hidden bg-ink text-ink-foreground" data-cy="home-hero">
      {/* Backdrop: aurora light, fine grid, vignette. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-aurora absolute -left-[10%] -top-[30%] aspect-square w-[60%] rounded-full bg-primary/55 blur-[90px]" />
        <div className="animate-aurora absolute -right-[15%] top-[10%] aspect-square w-[50%] rounded-full bg-accent/40 blur-[100px] [animation-delay:-6s] [animation-duration:22s]" />
        <div className="animate-aurora absolute -bottom-[35%] left-[30%] aspect-square w-[45%] rounded-full bg-gold/25 blur-[100px] [animation-delay:-12s] [animation-duration:26s]" />
        <div className="ink-grid absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-24 pt-10 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:gap-8 lg:pb-32 lg:pt-20">
        <div className="space-y-7">
          <div className="flex flex-wrap items-center gap-3">
            {storefrontExtras(slug).brand || logoUrl ? <BrandMark className="size-11" /> : null}
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-foreground/70">{name}</span>
          </div>

          {status ? (
            <button type="button" onClick={onFindBranch} className="group inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.07] py-1.5 pl-3 pr-4 text-sm text-ink-foreground/90 backdrop-blur transition hover:bg-white/[0.12]" data-cy="hero-status">
              <span className="relative flex size-2.5 shrink-0">
                {status.live ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" /> : null}
                <span className={cn("relative inline-flex size-2.5 rounded-full", status.live ? "bg-success" : "bg-destructive")} />
              </span>
              <span className="truncate">{status.text}</span>
              <ArrowRight className="size-3.5 shrink-0 opacity-60 transition group-hover:translate-x-0.5" />
            </button>
          ) : null}

          <h1 className={cn(headline.length > 48 ? "text-[clamp(2rem,4.6vw,3.5rem)]" : "text-[clamp(2.4rem,7vw,4.75rem)]", "font-display font-semibold leading-[1.05] tracking-tight")} aria-label={headline}>
            {words.map((w, i) => (
              <Fragment key={i}>
                <span className="hero-word" aria-hidden>
                  <span style={{ "--i": i } as CSSProperties}>
                    {w.highlight ? <span className="animate-gradient-pan bg-gradient-to-r from-accent via-gold to-accent bg-clip-text text-transparent">{w.word}</span> : w.word}
                  </span>
                </span>{" "}
              </Fragment>
            ))}
          </h1>

          <p className="max-w-lg text-lg leading-relaxed text-ink-foreground/75">
            {copy?.heroIntro ?? "Order for delivery or pickup from the branch nearest you. Choose your dishes and extras, then follow your order live from our kitchen to your door."}
          </p>

          <div className="flex flex-wrap gap-3">
            <Button variant="accent" size="lg" className="btn-shine h-14 rounded-full px-8 text-base shadow-[0_10px_40px_-10px_var(--accent)] transition hover:-translate-y-0.5" asChild data-cy="hero-order">
              <Link to={`/${slug}/menu`}>
                Start your order <ArrowRight className="transition group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 rounded-full border-white/20 bg-white/5 px-7 text-base text-ink-foreground backdrop-blur hover:bg-white/15" onClick={onFindBranch} data-cy="hero-branches">
              <MapPin /> Find a branch
            </Button>
          </div>

          {branches.length > 0 ? (
            <dl className="grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {[
                [nBranches, branches.length === 1 ? "branch" : "branches"],
                [nCities, cities === 1 ? "city" : "cities"],
                [nDishes, dishCount === 1 ? "menu item" : "menu items"],
              ].map(([n, label]) => (
                <div key={label as string}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">{n}</dd>
                  <dd className="text-xs uppercase tracking-wider text-ink-foreground/60">{label}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {dishes.length > 0 ? <HeroStage slug={slug} fmt={fmt} dishes={dishes} categoryName={categoryName} chat={copy?.heroChat} /> : null}
      </div>
    </section>
  )
}

function HeroStage({ slug, fmt, dishes, categoryName, chat }: { slug: string; fmt: CurrencyFormat; dishes: StoreItemCard[]; categoryName: (id: string) => string | undefined; chat?: [string, string] }) {
  const reduced = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const n = dishes.length
  useInterval(() => setIndex((i) => (i + 1) % n), 3800, !reduced && !paused && n > 1)

  const tilt = (e: React.PointerEvent) => {
    if (reduced || e.pointerType !== "mouse" || !stage.current) return
    const r = stage.current.getBoundingClientRect()
    stage.current.style.setProperty("--rx", `${((e.clientX - r.left) / r.width - 0.5) * 16}deg`)
    stage.current.style.setProperty("--ry", `${-((e.clientY - r.top) / r.height - 0.5) * 12}deg`)
  }
  const untilt = () => {
    stage.current?.style.setProperty("--rx", "0deg")
    stage.current?.style.setProperty("--ry", "0deg")
    setPaused(false)
  }
  const main = dishes[index % n]
  const backs = [dishes[(index + 1) % n], dishes[(index + 2) % n]]

  return (
    <div className="relative mx-auto w-full max-w-[19rem] sm:max-w-sm lg:max-w-[25rem]" onPointerEnter={() => setPaused(true)} onPointerLeave={untilt} onPointerMove={tilt}>
      <div ref={stage} className="relative aspect-[4/5] [perspective:1200px]">
        <div className="absolute inset-0 transition-transform duration-300 ease-out" style={{ transform: "rotateY(var(--rx, 0deg)) rotateX(var(--ry, 0deg))", transformStyle: "preserve-3d" }}>
          {/* Cards fanned behind the hero product */}
          {n > 1
            ? backs.map((d, i) => (
                <div
                  key={`${d.id}-${i}`}
                  aria-hidden
                  className="absolute inset-x-6 top-6 bottom-16 overflow-hidden rounded-[1.75rem] border border-white/10 opacity-60 shadow-2xl transition-all duration-700"
                  style={{ transform: `translateZ(${-70 - i * 50}px) rotate(${i === 0 ? -9 : 8}deg) translateX(${i === 0 ? -14 : 16}%)` }}
                >
                  <FoodArt name={d.name} hint={categoryName(d.categoryId)} imageUrl={d.imageUrl} />
                </div>
              ))
            : null}

          {/* Hero product */}
          <Link
            key={main.id}
            to={`/${slug}/item/${main.id}`}
            className="animate-card-in group absolute inset-0 flex flex-col overflow-hidden rounded-[1.75rem] bg-card text-card-foreground shadow-[0_40px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/10"
            style={{ transform: "translateZ(40px)" }}
            data-cy="hero-dish"
          >
            <div className="relative min-h-0 flex-1">
              <FoodArt name={main.name} hint={categoryName(main.categoryId)} imageUrl={main.imageUrl} iconClassName="size-1/3" />
              {main.isFeatured ? <span className="absolute left-4 top-4 rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white backdrop-blur">★ Crowd favourite</span> : null}
            </div>
            <div className="space-y-2 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{categoryName(main.categoryId) ?? "Signature"}</p>
              <p className="font-display text-xl font-semibold leading-tight">{main.name}</p>
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-sm">
                  {main.hasPricedVariants ? <span className="text-muted-foreground">From </span> : null}
                  <Money value={main.fromPrice} fmt={fmt} className="font-display text-lg font-semibold" />
                </span>
                <span className="flex items-center gap-2">
                  {main.optionGroupCount > 0 ? <span className="hidden rounded-full bg-muted px-2.5 py-1 text-xs font-medium sm:inline">{plural(main.optionGroupCount, "choice")}</span> : null}
                  <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg transition group-hover:rotate-90"><Plus className="size-5" /></span>
                </span>
              </div>
            </div>
          </Link>

          {/* Floating feature chips (real product features: live tracking, chat with the team, delivery or pickup).
              The outer element holds the 3D depth; the inner one floats (an animated transform would
              otherwise replace translateZ and drop the chip behind the card). */}
          <div className="absolute -left-3 top-[34%] sm:-left-12" style={{ transform: "translateZ(90px)" }} aria-hidden>
            <div className="animate-float w-44 rounded-2xl border border-white/15 bg-ink/85 p-3 text-xs text-ink-foreground shadow-2xl backdrop-blur-md">
              <p className="flex items-center gap-1.5 font-semibold"><ChefHat className="size-3.5 text-gold" /> Live order tracking</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-gold" style={{ animation: reduced ? undefined : "kiros-progress 6s ease-in-out infinite", width: reduced ? "68%" : undefined }} />
              </div>
              <p className="mt-1.5 flex justify-between text-[10px] text-ink-foreground/60"><span>Paid</span><span>Packing</span><span>On the way</span></p>
            </div>
          </div>
          <div className="absolute -right-2 bottom-28 sm:-right-10" style={{ transform: "translateZ(110px)" }} aria-hidden>
            <div className="animate-float w-48 rounded-2xl rounded-br-sm bg-primary p-3 text-xs text-primary-foreground shadow-2xl [animation-delay:-3s]">
              <p className="flex items-center gap-1.5 font-semibold opacity-80"><MessageCircle className="size-3.5" /> Our team</p>
              <p className="mt-1 leading-snug">{chat ? `${chat[0]} ${chat[1]}` : "Extra sauce, please? Of course — packing your order now."}</p>
            </div>
          </div>
          <div className="absolute -right-4 -top-4 hidden sm:block lg:-right-14" style={{ transform: "translateZ(70px)" }} aria-hidden>
            <div className="animate-float flex items-center gap-2 rounded-full border border-white/15 bg-ink/70 px-3 py-2 text-xs font-medium text-ink-foreground shadow-xl backdrop-blur-md [animation-delay:-1.5s]">
              <Bike className="size-4 text-gold" /> Delivery <span className="opacity-40">/</span> <StoreIcon className="size-4 text-gold" /> Pickup
            </div>
          </div>
        </div>
      </div>

      {n > 1 ? (
        <div className="mt-6 flex justify-center gap-2" role="group" aria-label="Featured dishes">
          {dishes.map((d, i) => (
            <button key={d.id} type="button" onClick={() => setIndex(i)} aria-label={`Show ${d.name}`} aria-current={i === index % n} className={cn("h-1.5 rounded-full transition-all", i === index % n ? "w-8 bg-gold" : "w-1.5 bg-white/30 hover:bg-white/60")} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
