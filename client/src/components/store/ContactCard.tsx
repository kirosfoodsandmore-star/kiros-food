// "Get in touch" block shared by the FAQ and About pages. It reads the company's phone, WhatsApp and emails
// itself (Settings + lib/storefrontExtras), so every page shows the same details.
import { ArrowRight, Mail, MessageCircle, Phone, Send, ShoppingBag } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useStore } from "@/contexts/StoreContext"
import { useReveal } from "@/hooks/useMotion"
import { storefrontExtras } from "@/lib/storefrontExtras"
import { formatPhone } from "@/lib/utils"
import { useStoreSession } from "@/stores/storeSession"

export function ContactCard({ title = "Still have a question?", intro = "We're happy to help. Pick whichever is easiest for you." }: { title?: string; intro?: string }) {
  const { slug, profile } = useStore()
  const { open } = useStoreSession()
  const [ref] = useReveal<HTMLElement>()
  const { phone, email } = profile
  const whatsapp = profile.socialLinks?.whatsapp ?? null
  const salesEmail = storefrontExtras(slug).salesEmail ?? null
  const options = [
    { key: "message", icon: Send, label: "Send a message", detail: "We reply by email", to: `/${slug}/contact` },
    { key: "chat", icon: MessageCircle, label: "Chat on your order", detail: "Fastest for anything about an order", to: `/${slug}/orders` },
    ...(phone ? [{ key: "phone", icon: Phone, label: "Call us", detail: formatPhone(phone), href: `tel:${phone}` }] : []),
    ...(whatsapp ? [{ key: "wa", icon: MessageCircle, label: "WhatsApp", detail: formatPhone(whatsapp), href: `https://wa.me/${whatsapp.replace(/\D/g, "")}` }] : []),
    ...(email ? [{ key: "email", icon: Mail, label: "Email", detail: email, href: `mailto:${email}` }] : []),
    ...(salesEmail ? [{ key: "sales", icon: Mail, label: "Sales enquiries", detail: salesEmail, href: `mailto:${salesEmail}` }] : []),
  ]
  return (
    <section ref={ref} className="reveal grain relative isolate overflow-hidden rounded-[2rem] bg-ink p-7 text-ink-foreground sm:p-10" data-cy="faq-contact">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-aurora absolute -right-[15%] -top-[60%] aspect-square w-[60%] rounded-full bg-primary/45 blur-[90px]" />
        <div className="ink-grid absolute inset-0" />
      </div>
      <h2 className="font-display text-3xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-ink-foreground/70">{intro}</p>
      <ul className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const body = (
            <>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-gold"><o.icon className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{o.label}</span>
                <span className="block truncate text-sm text-ink-foreground/60">{o.detail}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </>
          )
          const cls = "group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/30 hover:bg-white/10"
          return <li key={o.key}>{"to" in o && o.to ? <Link to={o.to} className={cls}>{body}</Link> : <a href={(o as { href: string }).href} className={cls} target={o.key === "wa" ? "_blank" : undefined} rel="noreferrer">{body}</a>}</li>
        })}
      </ul>
      <div className="mt-7 flex flex-wrap gap-3">
        <Button variant="accent" className="btn-shine rounded-full" asChild><Link to={`/${slug}/menu`}><ShoppingBag /> Start an order</Link></Button>
        <Button variant="outline" className="rounded-full border-white/20 bg-white/5 text-ink-foreground hover:bg-white/15" onClick={() => open("branch")}>Find a branch</Button>
      </div>
    </section>
  )
}
