// Contact page: the company's details beside a message form. The form posts to the storefront API, which
// emails the restaurant (Reply-To = the visitor). Details come from Settings plus lib/storefrontExtras.
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Clock, Mail, MapPin, MessageCircle, Navigation, Phone, Send } from "lucide-react"
import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { Link } from "react-router-dom"
import { z } from "zod"
import { SocialLinks } from "@/components/store/SocialLinks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCustomer } from "@/contexts/CustomerContext"
import { useStore } from "@/contexts/StoreContext"
import { StoreEndpoints } from "@/endpoints/store.endpoints"
import { useReveal } from "@/hooks/useMotion"
import { storefrontExtras } from "@/lib/storefrontExtras"
import { formatPhone } from "@/lib/utils"
import { email } from "@/lib/validation"
import { ApiError, unwrap } from "@/transport/http"

const MAX = 2000
const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email,
  phone: z.string().trim().max(30).regex(/^[0-9+()\-\s]*$/, "Enter a valid phone number").optional(),
  message: z.string().trim().min(5, "Please write a little more").max(MAX, `Please keep your message under ${MAX} characters`),
  website: z.string().optional(), // honeypot
})
type Form = z.infer<typeof schema>

const stagger = (i: number) => ({ "--i": i }) as CSSProperties

function Detail({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="break-words text-[0.95rem] font-medium leading-snug">{children}</div>
      </div>
    </div>
  )
}

export default function ContactPage() {
  const { slug, profile } = useStore()
  const { session } = useCustomer()
  const extras = storefrontExtras(slug)
  const whatsapp = profile.socialLinks?.whatsapp ?? null
  const [detailsRef] = useReveal<HTMLDivElement>(0.1)
  const [sent, setSent] = useState<string | null>(null) // the address we'll reply to
  const [failure, setFailure] = useState<string | null>(null)
  const { register, handleSubmit, reset, setError, setValue, getValues, watch, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", phone: "", message: "", website: "" } })

  useEffect(() => {
    const prev = document.title
    document.title = `Contact us · ${profile.name}`
    return () => {
      document.title = prev
    }
  }, [profile.name])

  // Signed-in customers don't have to retype who they are.
  useEffect(() => {
    if (!session) return
    const c = session.customer
    if (!getValues("name") && c.name) setValue("name", c.name)
    if (!getValues("email") && c.email) setValue("email", c.email)
    if (!getValues("phone") && c.phone) setValue("phone", c.phone)
  }, [session, getValues, setValue])

  const onSubmit = async (data: Form) => {
    setFailure(null)
    try {
      unwrap(await StoreEndpoints.contact(slug, { name: data.name, email: data.email, phone: data.phone || null, message: data.message, website: data.website || undefined }))
      setSent(data.email)
      reset({ name: "", email: "", phone: "", message: "", website: "" })
    } catch (err) {
      const e = err as ApiError
      const fields = (e.errors ?? []).filter((x) => ["name", "email", "phone", "message"].includes(x.field))
      if (fields.length) fields.forEach((x) => setError(x.field as keyof Form, { message: x.message }))
      else setFailure(e.statusCode === 429 ? "You've sent a few messages already. Please try again a little later, or call or WhatsApp us." : e.message)
    }
  }

  const length = (watch("message") ?? "").length
  const directions = profile.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}` : null

  return (
    <div className="space-y-6 pb-8 sm:space-y-8" data-cy="contact-page">
      {/* Header: kept short so the details and the form are on screen without scrolling. */}
      <section className="grain relative isolate ml-[calc(50%-50vw)] w-screen overflow-hidden bg-ink text-ink-foreground">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="animate-aurora absolute -left-[10%] -top-[50%] aspect-square w-[50%] rounded-full bg-primary/55 blur-[90px]" />
          <div className="animate-aurora absolute -bottom-[60%] -right-[10%] aspect-square w-[45%] rounded-full bg-accent/35 blur-[100px] [animation-delay:-8s]" />
          <div className="ink-grid absolute inset-0" />
          <Send className="animate-float absolute -right-2 top-8 hidden size-48 -rotate-12 text-white/[0.07] md:block" strokeWidth={1} />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-7 pt-7 sm:pb-9 sm:pt-9">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-foreground/60">
            <Link to={`/${slug}`} className="hover:text-ink-foreground">Home</Link> <span aria-hidden>/</span> <span className="text-ink-foreground/90">Contact us</span>
          </nav>
          <h1 className="mt-3 font-display text-[clamp(1.9rem,5vw,3rem)] font-semibold leading-[1.05] tracking-tight">
            Get in <span className="animate-gradient-pan bg-gradient-to-r from-accent via-gold to-accent bg-clip-text text-transparent">touch</span>
          </h1>
          <p className="mt-2 max-w-xl text-base text-ink-foreground/70 sm:text-lg">Get in touch today for your fresh and organic farm produce.</p>
        </div>
      </section>

      {/* Phones: details, then the form, then social links and the delivery note. Desktop: details and those extras stack in the left column, the form fills the right. */}
      <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-x-12 lg:gap-y-6">
        {/* Details */}
        <div ref={detailsRef} className="lg:col-start-1 lg:row-start-1">
          <ul className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {profile.phone ? <li className="reveal" style={stagger(0)}><Detail icon={Phone} label="Phone"><a href={`tel:${profile.phone}`} className="hover:text-primary">{formatPhone(profile.phone)}</a></Detail></li> : null}
            {whatsapp ? <li className="reveal" style={stagger(1)}><Detail icon={MessageCircle} label="WhatsApp"><a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="hover:text-primary">{formatPhone(whatsapp)}</a></Detail></li> : null}
            {profile.address ? (
              <li className="reveal" style={stagger(2)}>
                <Detail icon={MapPin} label="Address">
                  {profile.address}
                  {directions ? <a href={directions} target="_blank" rel="noreferrer" className="mt-0.5 flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"><Navigation className="size-3.5" /> Get directions</a> : null}
                </Detail>
              </li>
            ) : null}
            {extras.hours?.length ? <li className="reveal" style={stagger(3)}><Detail icon={Clock} label="Store open">{extras.hours.map((h) => <span key={h} className="block">{h}</span>)}</Detail></li> : null}
            {profile.email || extras.salesEmail ? (
              <li className="reveal sm:col-span-2" style={stagger(4)}>
                <Detail icon={Mail} label="Email">
                  {profile.email ? <a href={`mailto:${profile.email}`} className="block hover:text-primary">{profile.email}</a> : null}
                  {extras.salesEmail ? <a href={`mailto:${extras.salesEmail}`} className="block hover:text-primary">{extras.salesEmail} <span className="text-xs font-normal text-muted-foreground">Sales</span></a> : null}
                </Detail>
              </li>
            ) : null}
          </ul>
        </div>

        {/* Form */}
        <div className="rounded-3xl border bg-card p-5 shadow-lg shadow-black/5 sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1" data-cy="contact-form-card">
          {sent ? (
            <div className="py-10 text-center" role="status" data-cy="contact-sent">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="size-8" /></span>
              <h2 className="mt-5 font-display text-2xl font-semibold">Message sent</h2>
              <p className="mx-auto mt-2 max-w-sm text-muted-foreground">Thank you for getting in touch. We'll reply to <span className="font-medium text-foreground">{sent}</span> as soon as we can.</p>
              <Button variant="outline" className="mt-6 rounded-full" onClick={() => setSent(null)}>Send another message</Button>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Send us a message</h2>
              <p className="mt-1 text-sm text-muted-foreground">We usually reply by email. For anything about an order that's already placed, chat with us from the order page.</p>
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-3" data-cy="contact-form">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" error={errors.name?.message}><Input autoComplete="name" placeholder="Your name" {...register("name")} data-cy="contact-name" /></Field>
                  <Field label="Phone (optional)" error={errors.phone?.message}><Input type="tel" autoComplete="tel" placeholder="Phone number" {...register("phone")} data-cy="contact-phone" /></Field>
                </div>
                <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" placeholder="Email address" {...register("email")} data-cy="contact-email" /></Field>
                <Field label="Message" error={errors.message?.message}>
                  <Textarea rows={4} placeholder="How can we help?" {...register("message")} data-cy="contact-message" />
                  <p className={`text-right text-xs ${length > MAX ? "text-destructive" : "text-muted-foreground"}`} aria-live="off">{length} / {MAX}</p>
                </Field>
                {/* Honeypot: invisible to people and screen readers; bots fill it in. */}
                <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>Leave this empty<input type="text" tabIndex={-1} autoComplete="off" {...register("website")} /></label>
                </div>
                {failure ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert" data-cy="contact-error">{failure}</p> : null}
                <Button type="submit" size="lg" className="w-full rounded-full sm:w-auto" loading={isSubmitting} data-cy="contact-submit">
                  {isSubmitting ? "Sending…" : <>Send message <Send /></>}
                </Button>
              </form>
            </>
          )}
        </div>

        {/* Social links and the delivery note */}
        <div className="space-y-3 lg:col-start-1 lg:row-start-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Follow us</p>
            <SocialLinks links={{ ...profile.socialLinks, ...extras.socialLinks, whatsapp: null }} tone="light" />
          </div>
          {extras.deliveryNotice ? <p className="rounded-xl border bg-secondary/50 p-3 text-sm text-secondary-foreground">{extras.deliveryNotice}</p> : null}
        </div>
      </section>
    </div>
  )
}
