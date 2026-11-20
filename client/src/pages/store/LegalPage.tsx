// A policy page (Privacy Policy, Delivery Policy, Terms & Conditions): header, a contents list that follows the reader,
// numbered sections, and links to the other policies. The text lives in ./legalContent; a restaurant without the `legal`
// flag in lib/storefrontExtras has no policy pages and falls back to the home page.
import { ArrowRight, Clock, Mail, Phone } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { useStore } from "@/contexts/StoreContext"
import { storefrontExtras } from "@/lib/storefrontExtras"
import { cn, formatPhone } from "@/lib/utils"
import { LEGAL_LABEL, LEGAL_ORDER, LEGAL_UPDATED, legalDoc, type LegalKey, type LegalLinkTarget } from "./legalContent"

export const legalPath = (slug: string, to: LegalLinkTarget) => `/${slug}/${to}`

export default function LegalPage({ doc: key }: { doc: LegalKey }) {
  const { slug, profile } = useStore()
  const enabled = Boolean(storefrontExtras(slug).legal)
  const doc = useMemo(() => legalDoc(key, { name: profile.name, email: profile.email, phone: profile.phone, address: profile.address }), [key, profile.name, profile.email, profile.phone, profile.address])
  const [active, setActive] = useState(doc.sections[0]?.id ?? "")

  useEffect(() => {
    const prev = document.title
    document.title = `${doc.title} · ${profile.name}`
    return () => {
      document.title = prev
    }
  }, [doc.title, profile.name])

  // Highlight the section being read.
  useEffect(() => {
    const els = doc.sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => Boolean(e))
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return
    const seen = new Set<string>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.add(e.target.id)
          else seen.delete(e.target.id)
        }
        const first = doc.sections.find((s) => seen.has(s.id))
        if (first) setActive(first.id)
      },
      { rootMargin: "-90px 0px -60% 0px" }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [doc])

  if (!enabled) return <Navigate to={`/${slug}`} replace />

  const jump = (id: string) => {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })
  }
  const others = LEGAL_ORDER.filter((k) => k !== key)

  return (
    <div className="pb-8" data-cy={`legal-${key}`}>
      <section className="relative isolate -mt-0 ml-[calc(50%-50vw)] w-screen overflow-hidden bg-gradient-to-br from-[#fffaf0] via-[#f6fbf1] to-[#e6f5ea] text-foreground dark:bg-none dark:bg-ink dark:text-ink-foreground">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="light-grid absolute inset-0 dark:hidden" />
          <div className="ink-grid absolute inset-0 hidden dark:block" />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:pb-14 sm:pt-14">
          <nav aria-label="Breadcrumb" className="text-sm text-foreground/60 dark:text-ink-foreground/60">
            <Link to={`/${slug}`} className="hover:text-foreground dark:hover:text-ink-foreground">Home</Link> <span aria-hidden>/</span> <span className="text-foreground/90 dark:text-ink-foreground/90">{doc.title}</span>
          </nav>
          <h1 className="mt-4 font-display text-[clamp(2.1rem,5.5vw,3.5rem)] font-semibold leading-[1.05] tracking-tight text-balance">{doc.title}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70 dark:text-ink-foreground/75">{doc.summary}</p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3.5 py-1.5 text-sm text-foreground/80 dark:border-white/15 dark:bg-white/[0.07] dark:text-ink-foreground/80">
            <Clock className="size-4" aria-hidden /> Last updated {LEGAL_UPDATED}
          </p>
        </div>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:mt-14 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <details className="rounded-xl border bg-card lg:hidden">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">On this page</summary>
            <ol className="space-y-0.5 border-t p-2 text-sm">
              {doc.sections.map((s, i) => (
                <li key={s.id}><a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); jump(s.id) }} className="block rounded-lg px-3 py-2 hover:bg-muted">{i + 1}. {s.title}</a></li>
              ))}
            </ol>
          </details>
          <div className="hidden lg:block">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">On this page</p>
            <ol className="space-y-0.5 border-l text-sm">
              {doc.sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={(e) => { e.preventDefault(); jump(s.id) }}
                    aria-current={active === s.id ? "location" : undefined}
                    className={cn("-ml-px block border-l-2 py-1.5 pl-4 pr-2 transition-colors", active === s.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                  >
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="min-w-0 max-w-3xl">
          <div className="space-y-12">
            {doc.sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  <span className="mr-2 text-muted-foreground/60" aria-hidden>{i + 1}.</span>{s.title}
                </h2>
                <div className="mt-4 space-y-4 leading-relaxed text-muted-foreground">
                  {s.paragraphs?.map((p, k) => <p key={k}>{p}</p>)}
                  {s.bullets ? (
                    <ul className="space-y-2.5">
                      {s.bullets.map((b, k) => (
                        <li key={k} className="relative pl-6"><span aria-hidden className="absolute left-1 top-[0.6em] size-1.5 rounded-full bg-primary" />{b}</li>
                      ))}
                    </ul>
                  ) : null}
                  {s.after?.map((p, k) => <p key={`a${k}`}>{p}</p>)}
                </div>
                {s.link ? (
                  <Link to={legalPath(slug, s.link.to)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                    {s.link.label} <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                ) : null}
              </section>
            ))}
          </div>

          <aside className="mt-14 rounded-2xl border bg-card p-6" aria-label="Contact and related pages">
            <h2 className="font-display text-lg font-semibold">Questions about this page?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Our team is happy to help.</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {profile.email ? <a href={`mailto:${profile.email}`} className="inline-flex items-center gap-2 hover:underline"><Mail className="size-4 text-primary" aria-hidden />{profile.email}</a> : null}
              {profile.phone ? <a href={`tel:${profile.phone}`} className="inline-flex items-center gap-2 hover:underline"><Phone className="size-4 text-primary" aria-hidden />{formatPhone(profile.phone)}</a> : null}
              <Link to={`/${slug}/contact`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">Send us a message <ArrowRight className="size-3.5" aria-hidden /></Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
              <span className="py-1.5 text-sm text-muted-foreground">Also read:</span>
              {others.map((k) => (
                <Link key={k} to={legalPath(slug, k)} className="rounded-full border px-3.5 py-1.5 text-sm hover:bg-muted">{LEGAL_LABEL[k]}</Link>
              ))}
            </div>
          </aside>
        </article>
      </div>
    </div>
  )
}
