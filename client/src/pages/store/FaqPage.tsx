// Storefront help centre: live search across every question, category navigation, animated accordions
// with deep links (#q-<id>), a contact card and FAQPage structured data for search engines.
import { Check, ChevronDown, Link2, Search, X } from "lucide-react"
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { ContactCard } from "@/components/store/ContactCard"
import { Button } from "@/components/ui/button"
import { useStore } from "@/contexts/StoreContext"
import { useReveal } from "@/hooks/useMotion"
import { cn, plural } from "@/lib/utils"
import { FAQ_CATEGORIES, type Faq } from "./faqContent"

const QUICK = ["delivery", "invoice", "card", "frozen", "next day", "refund"]

/** Wraps case-insensitive matches of `term` in <mark>. */
function highlight(text: string, term: string): ReactNode {
  if (!term) return text
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return text.split(new RegExp(`(${esc})`, "gi")).map((part, i) => (i % 2 ? <mark key={i} className="rounded bg-gold/40 px-0.5 text-inherit">{part}</mark> : <Fragment key={i}>{part}</Fragment>))
}

export default function FaqPage() {
  const { slug, profile } = useStore()
  const { hash } = useLocation()
  const [query, setQuery] = useState("")
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  const [copied, setCopied] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const categories = FAQ_CATEGORIES
  const term = query.trim()
  const filtered = useMemo(() => {
    if (!term) return categories
    const t = term.toLowerCase()
    return categories.map((c) => ({ ...c, faqs: c.faqs.filter((f) => `${f.q} ${f.a} ${c.title}`.toLowerCase().includes(t)) })).filter((c) => c.faqs.length > 0)
  }, [categories, term])
  const matches = filtered.reduce((n, c) => n + c.faqs.length, 0)
  const total = categories.reduce((n, c) => n + c.faqs.length, 0)

  // Deep link: /faq#q-bank-transfer opens and scrolls to that question.
  useEffect(() => {
    const id = hash.startsWith("#q-") ? hash.slice(3) : null
    if (!id || !categories.some((c) => c.faqs.some((f) => f.id === id))) return
    setOpenIds((s) => new Set(s).add(id))
    requestAnimationFrame(() => document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }))
  }, [hash, categories])

  // Structured data so search engines can show these answers directly in results.
  useEffect(() => {
    const el = document.createElement("script")
    el.type = "application/ld+json"
    el.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: categories.flatMap((c) => c.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a.replace(/\n\n/g, " ") } }))),
    })
    document.head.appendChild(el)
    const prevTitle = document.title
    document.title = `Help & FAQ · ${profile.name}`
    return () => {
      el.remove()
      document.title = prevTitle
    }
  }, [categories, profile.name])

  const toggle = (id: string) => setOpenIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const copyLink = async (id: string) => {
    const url = `${window.location.origin}/${slug}/faq#q-${id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(id)
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800)
    } catch {
      window.location.hash = `q-${id}`
    }
  }
  const jump = (id: string) => document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })

  return (
    <div className="pb-8" data-cy="faq-page">
      {/* Hero with search */}
      <section className="grain relative isolate ml-[calc(50%-50vw)] w-screen overflow-hidden bg-ink text-ink-foreground">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="animate-aurora absolute -left-[10%] -top-[40%] aspect-square w-[50%] rounded-full bg-primary/50 blur-[90px]" />
          <div className="animate-aurora absolute -right-[10%] -bottom-[50%] aspect-square w-[45%] rounded-full bg-accent/35 blur-[100px] [animation-delay:-8s]" />
          <div className="ink-grid absolute inset-0" />
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-16 pt-14 text-center sm:pb-20 sm:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Help centre</p>
          <h1 className="mt-4 font-display text-[clamp(2.25rem,6vw,3.75rem)] font-semibold leading-[1.05] tracking-tight">
            Questions? <span className="animate-gradient-pan bg-gradient-to-r from-accent via-gold to-accent bg-clip-text text-transparent">Answered.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-ink-foreground/70">Everything about ordering from {profile.name} — freshness, payments, delivery and more.</p>

          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="pointer-events-none absolute left-5 top-1/2 z-10 size-5 -translate-y-1/2 text-ink-foreground/60" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${total} answers…`}
              aria-label="Search questions"
              className="h-14 w-full rounded-full border border-white/15 bg-white/10 pl-14 pr-12 text-base text-ink-foreground shadow-2xl backdrop-blur-md placeholder:text-ink-foreground/45 focus-visible:border-gold/60 focus-visible:ring-gold/40 focus-visible:ring-offset-0"
              data-cy="faq-search"
            />
            {query ? (
              <button type="button" onClick={() => { setQuery(""); searchRef.current?.focus() }} className="absolute right-4 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-foreground/60 hover:bg-white/10 hover:text-ink-foreground" aria-label="Clear search">
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Popular searches">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setQuery(q)} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition", query === q ? "border-gold bg-gold text-ink" : "border-white/15 bg-white/5 text-ink-foreground/80 hover:border-white/40 hover:text-ink-foreground")}>
                {q}
              </button>
            ))}
          </div>
          <p className="mt-5 h-5 text-sm text-ink-foreground/60" aria-live="polite">{term ? (matches ? `${plural(matches, "answer")} for "${term}"` : "") : ""}</p>
        </div>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:mt-14 lg:grid-cols-[14rem_minmax(0,1fr)]">
        {/* Category navigation: sticky chips on phones, a sticky list on desktop */}
        <nav aria-label="FAQ categories" className="sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 py-2 backdrop-blur lg:top-20 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0">
          <ul className="flex gap-2 overflow-x-auto scrollbar-none lg:flex-col lg:gap-1">
            {filtered.map((c) => (
              <li key={c.id} className="shrink-0">
                <button type="button" onClick={() => jump(c.id)} className="flex w-full items-center justify-between gap-3 rounded-full border bg-card px-4 py-2 text-left text-sm font-medium transition hover:border-primary hover:text-primary lg:rounded-xl lg:border-transparent lg:bg-transparent lg:px-3 lg:hover:bg-card">
                  {c.title}
                  <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{c.faqs.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-14">
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed p-10 text-center" data-cy="faq-empty">
              <Search className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-display text-lg font-semibold">No answers for "{term}"</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another word, or ask us directly below.</p>
              <Button variant="outline" className="mt-4 rounded-full" onClick={() => setQuery("")}>Show all questions</Button>
            </div>
          ) : (
            filtered.map((c, ci) => (
              <FaqGroup key={c.id} id={c.id} index={ci} title={c.title} blurb={c.blurb}>
                {c.faqs.map((f, fi) => (
                  <FaqItem key={f.id} faq={f} index={fi} term={term} open={Boolean(term) || openIds.has(f.id)} onToggle={() => toggle(f.id)} copied={copied === f.id} onCopy={() => void copyLink(f.id)} />
                ))}
              </FaqGroup>
            ))
          )}

          <ContactCard />
        </div>
      </div>
    </div>
  )
}

function FaqGroup({ id, index, title, blurb, children }: { id: string; index: number; title: string; blurb: string; children: ReactNode }) {
  const [ref] = useReveal<HTMLElement>(0.05)
  return (
    <section ref={ref} id={`cat-${id}`} className="scroll-mt-32 lg:scroll-mt-24" aria-labelledby={`cat-${id}-title`}>
      <div className="reveal mb-5 flex items-baseline gap-4">
        <span className="text-outline font-display text-4xl font-semibold text-primary/40">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <h2 id={`cat-${id}-title`} className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{blurb}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function FaqItem({ faq, index, term, open, onToggle, copied, onCopy }: { faq: Faq; index: number; term: string; open: boolean; onToggle: () => void; copied: boolean; onCopy: () => void }) {
  const panelId = `q-${faq.id}-panel`
  return (
    <div id={`q-${faq.id}`} className={cn("reveal scroll-mt-32 rounded-2xl border bg-card transition-shadow duration-300", open ? "border-primary/30 shadow-lg shadow-primary/5" : "hover:shadow-md")} style={{ "--i": index } as CSSProperties} data-cy={`faq-${faq.id}`}>
      <h3>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className="flex w-full items-center gap-4 rounded-2xl p-5 text-left">
          <span className="flex-1 font-display text-base font-semibold leading-snug sm:text-lg">{highlight(faq.q, term)}</span>
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-full transition-all duration-300", open ? "rotate-180 bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")} aria-hidden>
            <ChevronDown className="size-4" />
          </span>
        </button>
      </h3>
      {/* grid-rows 0fr → 1fr animates the height without measuring it */}
      <div id={panelId} role="region" aria-label={faq.q} className={cn("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden" inert={!open}>
          <div className="space-y-3 px-5 pb-5 text-[0.95rem] leading-relaxed text-muted-foreground">
            {faq.a.split("\n\n").map((p, i) => <p key={i}>{highlight(p, term)}</p>)}
            <button type="button" onClick={onCopy} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              {copied ? <><Check className="size-3.5" /> Link copied</> : <><Link2 className="size-3.5" /> Copy link to this answer</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
