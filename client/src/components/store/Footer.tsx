// Storefront footer: an ink call-to-action overlapping a rich footer — contact details ("Got any questions?"),
// quick links, head office with hours, live branch status, socials, policies and a giant wordmark.
// Name, phone, email, address and social links come from Settings; sales email, hours and the company
// links come from lib/storefrontExtras.
import { Apple, ArrowRight, ArrowUp, Clock, Headset, Leaf, Mail, MapPin, MessageCircle, Phone } from "lucide-react"
import { Link, useMatch } from "react-router-dom"
import { BrandMark } from "@/components/store/BrandMark"
import { useTeamEntries } from "@/components/store/TeamLogin"
import { SocialLinks } from "@/components/store/SocialLinks"
import { Button } from "@/components/ui/button"
import { useStore } from "@/contexts/StoreContext"
import { useStoreBranches } from "@/hooks/useStore"
import { type FooterLink, storeLegalLinks, storeNavLinks, storefrontExtras } from "@/lib/storefrontExtras"
import { cn, formatPhone } from "@/lib/utils"
import { useStoreSession } from "@/stores/storeSession"

const linkCls = "hover:text-ink-foreground"
const headingCls = "mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-ink-foreground/50"

function FooterAnchor({ link, className }: { link: FooterLink; className?: string }) {
  return link.external ? (
    <a href={link.href} target="_blank" rel="noreferrer" className={className}>{link.label}</a>
  ) : (
    <Link to={link.href} className={className}>{link.label}</Link>
  )
}

export function StoreFooter() {
  const { slug, profile } = useStore()
  const { branchId, open } = useStoreSession()
  const { data: branches } = useStoreBranches(slug)
  const extras = storefrontExtras(slug)
  const legalLinks = storeLegalLinks(slug)
  // The item page has a fixed add-to-bag bar on phones; keep the footer's last row clear of it.
  const onItemPage = Boolean(useMatch("/:slug/item/:itemId"))
  // Someone following an order is not browsing: skip the promo band so the page ends sooner.
  const onOrderPage = Boolean(useMatch("/:slug/orders/:orderId"))
  // The Contact page already shows the phone, email, address, hours, socials and delivery note, so the footer there
  // drops its own copies (and the promo band) instead of repeating them under the page.
  const onContactPage = Boolean(useMatch("/:slug/contact"))
  const skipPromo = onOrderPage || onContactPage
  const branch = branches?.find((b) => b.id === branchId)
  const whatsapp = profile.socialLinks?.whatsapp ?? null
  const shownBranches = (branches ?? []).slice(0, 5)
  const more = (branches?.length ?? 0) - shownBranches.length
  const year = new Date().getFullYear()
  const team = useTeamEntries()
  const links: FooterLink[] = [...storeNavLinks(slug).filter((l) => l.label !== "Delivery"), { label: "My orders", href: `/${slug}/orders` }, { label: "Account", href: `/${slug}/account` }, ...team.entries.map((e) => ({ label: e.label, href: e.href }))]

  return (
    <footer className={skipPromo ? "mt-10" : "mt-24"} data-cy="store-footer">
      {/* Call to action, overlapping the footer below */}
      {skipPromo ? null : <div className="relative z-10 mx-auto max-w-6xl px-4">
        <div className="grain relative isolate overflow-hidden rounded-[2rem] bg-ink px-6 py-12 text-ink-foreground shadow-2xl sm:px-12 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="animate-aurora absolute -left-[10%] -top-[60%] aspect-square w-[55%] rounded-full bg-primary/50 blur-[90px]" />
            <div className="animate-aurora absolute -bottom-[70%] -right-[10%] aspect-square w-[55%] rounded-full bg-accent/40 blur-[90px] [animation-delay:-9s]" />
            <div className="ink-grid absolute inset-0" />
            <Leaf className="animate-float absolute -right-6 -top-4 hidden size-44 rotate-12 text-white/10 md:block" strokeWidth={1} />
            <Apple className="animate-float absolute bottom-[-2rem] right-44 hidden size-32 -rotate-12 text-white/10 [animation-delay:-3s] md:block" strokeWidth={1} />
          </div>
          <h2 className="max-w-xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Stocking up? <span className="animate-gradient-pan bg-gradient-to-r from-accent via-gold to-accent bg-clip-text text-transparent">Let's get it to you.</span>
          </h2>
          <p className="mt-4 max-w-md text-ink-foreground/75">
            {branch ? <>Fresh produce and groceries are a few taps away at <b className="font-semibold text-ink-foreground">{branch.name}</b>.</> : "Fresh produce and groceries are a few taps away. Pick the branch nearest you to get started."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="accent" size="lg" className="btn-shine h-12 rounded-full px-7" asChild data-cy="footer-order">
              <Link to={`/${slug}/menu`}>Start your order <ArrowRight /></Link>
            </Button>
            <Button variant="outline" size="lg" className="h-12 rounded-full border-white/20 bg-white/5 px-6 text-ink-foreground hover:bg-white/15" onClick={() => open("branch")}>
              <MapPin /> {branch ? "Change branch" : "Find a branch"}
            </Button>
          </div>
        </div>
      </div>}

      <div className={cn("overflow-hidden bg-ink text-ink-foreground", skipPromo ? "pt-12" : "-mt-24 pt-36", onItemPage && "pb-24 md:pb-0")}>
        <div className={cn("mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pb-12 text-sm sm:grid-cols-2", onContactPage ? "gap-8 pb-8 lg:grid-cols-[1.25fr_0.8fr_1.2fr]" : "lg:grid-cols-[1.25fr_0.8fr_1.2fr_1fr]")}>
          {/* Brand + contact */}
          <div className="space-y-5">
            <Link to={`/${slug}`} className="inline-flex items-center gap-3" aria-label={profile.name}>
              <BrandMark className={extras.brand ? "size-16" : "size-11 text-lg"} />
              {extras.brand ? null : <span className="font-display text-xl font-semibold">{profile.name}</span>}
            </Link>
            {!onContactPage && (profile.phone || whatsapp) ? (
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-gold"><Headset className="size-5" /></span>
                <div>
                  <p className="font-display text-base font-semibold">Got any questions?</p>
                  <ul className="mt-1 space-y-1 text-ink-foreground/80">
                    {profile.phone ? <li><a href={`tel:${profile.phone}`} className={cn("inline-flex items-center gap-2", linkCls)}><Phone className="size-3.5 text-gold" />{formatPhone(profile.phone)}</a></li> : null}
                    {whatsapp ? <li><a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-2", linkCls)}><MessageCircle className="size-3.5 text-gold" />{formatPhone(whatsapp)} <span className="text-xs text-ink-foreground/50">WhatsApp</span></a></li> : null}
                  </ul>
                </div>
              </div>
            ) : null}
            {profile.tagline ? <p className="max-w-xs leading-relaxed text-ink-foreground/60">{profile.tagline}</p> : null}
            {onContactPage ? null : <SocialLinks links={{ ...profile.socialLinks, ...extras.socialLinks }} tone="ink" />}
          </div>

          {/* Links */}
          <nav aria-label="Footer">
            <h3 className={headingCls}>Quick links</h3>
            <ul className="space-y-2.5 text-ink-foreground/80">
              {links.map((l) => <li key={l.label}><FooterAnchor link={l} className={linkCls} /></li>)}
            </ul>
          </nav>

          {/* Head office */}
          {onContactPage ? null : <div>
            <h3 className={headingCls}>Head office</h3>
            <ul className="space-y-3 text-ink-foreground/80">
              {profile.address ? <li className="flex items-start gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-gold" />{profile.address}</li> : null}
              {profile.email ? <li><a href={`mailto:${profile.email}`} className={cn("inline-flex items-start gap-2.5 break-all", linkCls)}><Mail className="mt-0.5 size-4 shrink-0 text-gold" />{profile.email}</a></li> : null}
              {extras.salesEmail ? <li><a href={`mailto:${extras.salesEmail}`} className={cn("inline-flex items-start gap-2.5 break-all", linkCls)}><Mail className="mt-0.5 size-4 shrink-0 text-gold" />{extras.salesEmail} <span className="text-xs text-ink-foreground/50">Sales</span></a></li> : null}
              {extras.hours?.length ? (
                <li className="flex items-start gap-2.5">
                  <Clock className="mt-0.5 size-4 shrink-0 text-gold" />
                  <span>{extras.hours.map((h) => <span key={h} className="block">{h}</span>)}</span>
                </li>
              ) : null}
            </ul>
            {extras.deliveryNotice ? <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-ink-foreground/65">{extras.deliveryNotice}</p> : null}
          </div>}

          {/* Branches */}
          {shownBranches.length > 0 ? (
            <div>
              <h3 className={headingCls}>Our branches</h3>
              <ul className="space-y-2.5">
                {shownBranches.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => open("branch")} className="group flex w-full items-center gap-2.5 text-left text-ink-foreground/80 hover:text-ink-foreground">
                      <span className={cn("size-2 shrink-0 rounded-full", b.isOpen ? "bg-success shadow-[0_0_10px_var(--success)]" : "bg-white/25")} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{b.name} <span className="text-ink-foreground/45">· {b.city}</span></span>
                      <span className="shrink-0 text-xs text-ink-foreground/50">{b.isOpen ? `till ${b.closesAt}` : b.isPaused ? "Paused" : "Closed"}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {more > 0 ? <button type="button" onClick={() => open("branch")} className="mt-3 text-xs font-medium text-gold hover:underline">+{more} more</button> : null}
            </div>
          ) : null}
        </div>

        {/* Giant wordmark, sized to the name so it always spans the width */}
        <div aria-hidden className="pointer-events-none select-none overflow-hidden px-4">
          <p className="mx-auto max-w-6xl translate-y-[22%] whitespace-nowrap text-center font-display font-semibold leading-none tracking-tighter text-transparent bg-gradient-to-b from-white/[0.14] to-white/0 bg-clip-text" style={{ fontSize: `min(11rem, ${Math.round(118 / Math.max(profile.name.length, 6))}vw)` }}>
            {profile.name}
          </p>
        </div>

        {/* Bottom strip: a fixed-height row with no padding of its own, so nothing sits under the text.
            (safe-bottom only adds space on phones with a home-indicator inset, and is 0 everywhere else.) */}
        <div className="safe-bottom border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col text-xs text-ink-foreground/60 sm:h-14 sm:flex-row sm:items-stretch sm:justify-between">
            {legalLinks.length ? (
              <ul className="order-first flex flex-wrap items-center gap-x-5 gap-y-1 px-4 pb-3 pt-4 sm:order-none sm:flex-1 sm:justify-center sm:p-0" aria-label="Policies">
                {legalLinks.map((l) => <li key={l.label}><FooterAnchor link={l} className={linkCls} /></li>)}
              </ul>
            ) : null}
            <div className="flex h-12 items-stretch justify-between border-t border-white/10 sm:contents">
              <p className="flex min-w-0 items-center px-4 leading-snug sm:order-first">© {year} {profile.name} · Powered by Kiros</p>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="group flex shrink-0 items-center gap-1.5 whitespace-nowrap border-l border-white/10 px-5 font-medium transition-colors hover:bg-white/5 hover:text-ink-foreground"
                data-cy="back-to-top"
              >
                <span className="sr-only sm:not-sr-only">Back to top</span> <ArrowUp className="size-4 transition-transform group-hover:-translate-y-0.5 sm:size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
