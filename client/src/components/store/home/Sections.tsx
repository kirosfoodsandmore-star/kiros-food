// Storefront home sections below the hero: dish marquee, kitchens, how it works, categories, favourites.
import { ArrowRight, ArrowUpRight, Bike, ChefHat, ChevronLeft, ChevronRight, MapPin } from "lucide-react"
import { useRef, type CSSProperties, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ItemCard } from "@/components/store/ItemCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { trackPointer, useReveal } from "@/hooks/useMotion"
import type { CurrencyFormat } from "@/lib/money"
import { cn, plural } from "@/lib/utils"
import type { StoreCategory, StoreItemCard, StoreMenuSummary } from "@/types/store.types"
import { COLLECTION_PALETTES, FoodArt, foodIcon } from "../FoodArt"

const stagger = (i: number) => ({ "--i": i }) as CSSProperties

/** Section heading with an eyebrow, revealed on scroll. */
export function SectionHeading({ eyebrow, title, children, action }: { eyebrow: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const [ref] = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="reveal text-xs font-semibold uppercase tracking-[0.25em] text-[color-mix(in_srgb,var(--accent)_72%,black)] dark:text-accent">{eyebrow}</p>
        <h2 className="reveal mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl" style={stagger(1)}>{title}</h2>
        {children ? <p className="reveal mt-3 text-muted-foreground" style={stagger(2)}>{children}</p> : null}
      </div>
      {action ? <div className="reveal" style={stagger(2)}>{action}</div> : null}
    </div>
  )
}

/** Angled, endlessly scrolling band of product names. */
export function DishMarquee({ names }: { names: string[] }) {
  if (names.length === 0) return null
  // Repeat until one copy comfortably exceeds the widest screens, then render it twice for a seamless loop.
  const base = Array.from({ length: Math.max(1, Math.ceil(14 / names.length)) }, () => names).flat()
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={hidden || undefined}>
      {base.map((n, i) => (
        <li key={i} className="flex items-center gap-8 whitespace-nowrap">
          <span>{n}</span>
          <span className="size-2.5 rotate-45 bg-current opacity-70" aria-hidden />
        </li>
      ))}
    </ul>
  )
  return (
    <div className="relative z-10 -mt-14 ml-[calc(50%-50vw)] w-screen overflow-hidden py-8" data-cy="dish-marquee">
      <div className="-mx-[5%] w-[110%] -rotate-2 bg-accent py-4 text-accent-foreground shadow-xl">
        <div className="group flex font-display text-lg font-semibold uppercase tracking-wider [--marquee-duration:45s] sm:text-xl">
          <div className="animate-marquee flex group-hover:[animation-play-state:paused]">
            {row(false)}
            {row(true)}
          </div>
        </div>
      </div>
    </div>
  )
}

/** One large card per menu ("collection") with a cursor-following spotlight. */
export function Kitchens({ menus, onOpen }: { menus: StoreMenuSummary[]; onOpen: (id: string) => void }) {
  const [ref] = useReveal<HTMLDivElement>()
  return (
    <section data-cy="menu-intro">
      <SectionHeading eyebrow="Our menus" title={<>{menus.length} menus. <span className="text-muted-foreground">One order.</span></>}>
        Mix and match from every menu at your branch — it all arrives together.
      </SectionHeading>
      <div ref={ref} className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {menus.map((m, i) => {
          const Icon = foodIcon(m.name, m.description)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpen(m.id)}
              onPointerMove={trackPointer}
              className={cn("reveal food-art group relative isolate flex min-h-72 flex-col justify-end overflow-hidden rounded-[2rem] p-7 text-left text-white shadow-lg transition duration-500 hover:-translate-y-1 hover:shadow-2xl sm:min-h-80 sm:p-9", COLLECTION_PALETTES[i % COLLECTION_PALETTES.length])}
              style={stagger(i)}
              data-cy={`menu-intro-${m.id}`}
            >
              {m.imageUrl ? <img src={m.imageUrl} alt="" className="absolute inset-0 -z-20 size-full object-cover transition duration-700 group-hover:scale-105" /> : null}
              <div className="food-art-dots absolute inset-0 -z-10 opacity-50" />
              <div className="spotlight absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
              <Icon className="absolute -right-6 -top-6 size-56 rotate-12 text-white/20 transition duration-700 group-hover:rotate-0 group-hover:scale-110 sm:size-64" strokeWidth={1} aria-hidden />
              <span className="absolute left-7 top-7 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur sm:left-9 sm:top-9">Menu {String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{m.name}</h3>
              {m.description ? <p className="mt-2 max-w-sm text-white/85">{m.description}</p> : null}
              <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow transition group-hover:gap-3">
                Explore the menu <ArrowRight className="size-4" />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Three steps with a hand-drawn connector that draws itself on scroll. */
export function HowItWorks({ branchCount, cityCount, makeItYours }: { branchCount: number; cityCount: number; makeItYours?: string }) {
  const [ref] = useReveal<HTMLDivElement>(0.25)
  const steps = [
    { icon: MapPin, title: "Pick your branch", text: branchCount > 1 ? `${plural(branchCount, "branch", "branches")} across ${plural(cityCount, "city", "cities")}. We'll show you who's open and who delivers to you.` : "See opening hours and whether we deliver to you." },
    { icon: ChefHat, title: "Make it yours", text: makeItYours ?? "Sizes, sides and extras — choose exactly what you want, and the price updates as you go." },
    { icon: Bike, title: "Track it live", text: "Follow your order from our kitchen to your door, and chat with our team any time." },
  ]
  return (
    <section data-cy="how-it-works">
      <SectionHeading eyebrow="How it works" title="Three taps to something delicious" />
      <div ref={ref} className="relative grid grid-cols-1 gap-5 md:grid-cols-3">
        <svg className="pointer-events-none absolute left-[16%] right-[16%] top-14 hidden h-8 w-[68%] text-accent/60 md:block" viewBox="0 0 600 32" preserveAspectRatio="none" aria-hidden>
          <path className="draw-path" pathLength={1} d="M2 16 C 100 -6, 200 38, 300 16 S 500 -6, 598 16" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="1" strokeLinecap="round" />
        </svg>
        {steps.map((s, i) => (
          <div key={s.title} className="reveal relative rounded-3xl border bg-card p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg" style={stagger(i + 1)}>
            <div className="flex items-center justify-between">
              <span className="relative grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <s.icon className="size-6" />
              </span>
              <span className="text-outline font-display text-6xl font-semibold text-primary/30">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <h3 className="mt-6 font-display text-xl font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Category tiles with generated art (or the category photo). */
export function CategoryTiles({ slug, categories }: { slug: string; categories: StoreCategory[] }) {
  const [ref] = useReveal<HTMLDivElement>()
  return (
    <section data-cy="category-tiles">
      <SectionHeading eyebrow="On the menu" title="Browse by category" action={<Button variant="outline" className="rounded-full" asChild><Link to={`/${slug}/menu`}>Full menu <ArrowRight /></Link></Button>} />
      <div ref={ref} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {categories.map((c, i) => (
          <Link key={c.id} to={`/${slug}/menu#cat-${c.id}`} className="reveal group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl p-4 text-white shadow-sm transition duration-500 hover:-translate-y-1 hover:shadow-xl sm:aspect-[5/6] sm:p-5" style={stagger(i)} data-cy={`category-tile-${c.id}`}>
            <div className="absolute inset-0 -z-10 transition duration-700 group-hover:scale-110">
              <FoodArt name={c.name} hint={c.items.map((x) => x.name).join(" ")} imageUrl={c.imageUrl} iconClassName="size-1/3 -translate-y-6" />
            </div>
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
            <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/20 opacity-0 backdrop-blur transition group-hover:opacity-100"><ArrowUpRight className="size-4" /></span>
            <span className="font-display text-xl font-semibold leading-tight sm:text-2xl">{c.name}</span>
            <span className="text-sm text-white/80">{plural(c.items.length, "item")}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** Horizontal favourites carousel with edge fades and arrow controls. */
export function Favourites({ slug, fmt, items, loading, hasBranch }: { slug: string; fmt: CurrencyFormat; items: StoreItemCard[]; loading: boolean; hasBranch: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: "smooth" })
  const [ref] = useReveal<HTMLDivElement>()
  return (
    <section data-cy="favourites">
      <SectionHeading
        eyebrow="Crowd favourites"
        title="What everyone's ordering"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => scroll(-1)} aria-label="Previous" data-cy="fav-prev"><ChevronLeft /></Button>
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => scroll(1)} aria-label="Next" data-cy="fav-next"><ChevronRight /></Button>
          </div>
        }
      />
      <div ref={ref} className="relative -mx-4">
        <div ref={track} className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 scrollbar-none [mask-image:linear-gradient(90deg,transparent,black_2rem,black_calc(100%-2rem),transparent)]">
          {loading
            ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72 w-60 shrink-0 rounded-2xl" />)
            : items.map((item, i) => (
                <div key={item.id} className="reveal w-60 shrink-0 snap-start sm:w-64" style={stagger(Math.min(i, 5))}>
                  <ItemCard item={item} slug={slug} fmt={fmt} />
                </div>
              ))}
          {!loading && items.length === 0 ? <p className="text-sm text-muted-foreground">{hasBranch ? "No favourites yet." : "Choose a branch to see favourites."}</p> : null}
        </div>
      </div>
    </section>
  )
}
