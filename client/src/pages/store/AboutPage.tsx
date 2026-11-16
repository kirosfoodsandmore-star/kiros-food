// About page: hero, welcome story, pull quote, "why choose us" and the shared contact card. Content lives in
// lib/storefrontExtras (the `about` entry); a restaurant without it has no About page.
import { ArrowRight, Apple, Carrot, Leaf, ShieldCheck, Sprout, Truck, Wheat, type LucideIcon } from "lucide-react"
import { useEffect, type CSSProperties } from "react"
import { Link, Navigate } from "react-router-dom"
import { ContactCard } from "@/components/store/ContactCard"
import { SectionHeading } from "@/components/store/home/Sections"
import { Button } from "@/components/ui/button"
import { useStore } from "@/contexts/StoreContext"
import { useReveal } from "@/hooks/useMotion"
import { storefrontExtras } from "@/lib/storefrontExtras"

const ICONS: Record<string, LucideIcon> = { fresh: Leaf, farm: Wheat, quality: ShieldCheck, delivery: Truck }
const stagger = (i: number) => ({ "--i": i }) as CSSProperties

export default function AboutPage() {
  const { slug, profile } = useStore()
  const about = storefrontExtras(slug).about
  const [storyRef] = useReveal<HTMLElement>(0.1)
  const [quoteRef] = useReveal<HTMLElement>(0.3)
  const [whyRef] = useReveal<HTMLDivElement>(0.1)

  useEffect(() => {
    const prev = document.title
    document.title = `About us · ${profile.name}`
    return () => {
      document.title = prev
    }
  }, [profile.name])

  if (!about) return <Navigate to={`/${slug}`} replace />

  return (
    <div className="space-y-20 pb-8 sm:space-y-28" data-cy="about-page">
      {/* Hero */}
      <section className="grain relative isolate -mt-0 ml-[calc(50%-50vw)] w-screen overflow-hidden bg-ink text-ink-foreground">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="animate-aurora absolute -left-[10%] -top-[40%] aspect-square w-[50%] rounded-full bg-primary/55 blur-[90px]" />
          <div className="animate-aurora absolute -right-[10%] -bottom-[50%] aspect-square w-[45%] rounded-full bg-gold/25 blur-[100px] [animation-delay:-8s]" />
          <div className="ink-grid absolute inset-0" />
          <Leaf className="animate-float absolute -right-4 top-6 hidden size-56 rotate-12 text-white/[0.07] md:block" strokeWidth={1} />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:pb-24 sm:pt-20">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-foreground/60">
            <Link to={`/${slug}`} className="hover:text-ink-foreground">Home</Link> <span aria-hidden>/</span> <span className="text-ink-foreground/90">About us</span>
          </nav>
          <h1 className="mt-5 font-display text-[clamp(2.4rem,7vw,4.5rem)] font-semibold leading-[1.05] tracking-tight text-balance">
            Fresh from the farm, <span className="animate-gradient-pan bg-gradient-to-r from-accent via-gold to-accent bg-clip-text text-transparent">straight to you.</span>
          </h1>
        </div>
      </section>

      {/* Story */}
      <section ref={storyRef} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <p className="reveal text-xs font-semibold uppercase tracking-[0.25em] text-[color-mix(in_srgb,var(--accent)_72%,black)] dark:text-accent">Our story</p>
          <h2 className="reveal mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl" style={stagger(1)}>{about.heading}</h2>
          <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
            {about.paragraphs.map((p, i) => <p key={i} className="reveal" style={stagger(i + 2)}>{p}</p>)}
          </div>
          <div className="reveal mt-8 flex flex-wrap gap-3" style={stagger(about.paragraphs.length + 2)}>
            <Button variant="accent" size="lg" className="btn-shine rounded-full" asChild>
              <Link to={`/${slug}/menu`}>See the menu <ArrowRight /></Link>
            </Button>
          </div>
        </div>

        {/* Illustration (a hosted photo can replace this panel) */}
        <div className="reveal relative mx-auto w-full max-w-md" style={stagger(2)} aria-hidden>
          <div className="food-art art-0 relative aspect-[10/11] overflow-hidden rounded-[2rem] shadow-2xl">
            <div className="food-art-dots absolute inset-0 opacity-70" />
            <div className="absolute -right-[15%] -top-[12%] aspect-square w-3/5 rounded-full border-[12px] border-white/15" />
            <div className="absolute -bottom-[20%] -left-[15%] aspect-square w-3/5 rounded-full bg-white/10" />
            <Leaf className="animate-float absolute left-[12%] top-[14%] size-24 -rotate-12 text-white/90 drop-shadow-xl" strokeWidth={1.4} />
            <Carrot className="animate-float absolute right-[14%] top-[34%] size-28 rotate-12 text-white/90 drop-shadow-xl [animation-delay:-2s]" strokeWidth={1.4} />
            <Apple className="animate-float absolute bottom-[14%] left-[26%] size-24 text-white/90 drop-shadow-xl [animation-delay:-4s]" strokeWidth={1.4} />
            <Sprout className="absolute bottom-[10%] right-[12%] size-16 text-white/70" strokeWidth={1.4} />
          </div>
        </div>
      </section>

      {/* Pull quote */}
      <section ref={quoteRef} className="relative isolate overflow-hidden rounded-[2rem] border bg-secondary/50 px-6 py-14 text-center sm:px-12 sm:py-20">
        <span aria-hidden className="reveal pointer-events-none absolute left-6 top-0 font-display text-[10rem] leading-none text-primary/15 sm:left-12">“</span>
        <blockquote className="reveal relative mx-auto max-w-3xl font-display text-2xl font-semibold leading-snug tracking-tight text-secondary-foreground sm:text-4xl" style={stagger(1)}>
          {about.quote}
        </blockquote>
        <p className="reveal mt-5 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground" style={stagger(2)}>{profile.name}</p>
      </section>

      {/* Why choose us */}
      <section data-cy="why-choose-us">
        <SectionHeading eyebrow="Why choose us" title="Good food, handled with care" />
        <div ref={whyRef} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {about.reasons.map((r, i) => {
            const Icon = ICONS[r.icon] ?? Leaf
            return (
              <div key={r.title} className="reveal group relative overflow-hidden rounded-3xl border bg-card p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg" style={stagger(i)}>
                <div className="flex items-center justify-between">
                  <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition group-hover:rotate-6"><Icon className="size-6" /></span>
                  <span className="text-outline font-display text-5xl font-semibold text-primary/30">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
              </div>
            )
          })}
        </div>
      </section>

      <ContactCard title="Get in touch" intro="Get in touch today for your fresh and organic farm produce." />
    </div>
  )
}
