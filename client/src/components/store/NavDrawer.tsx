// Side menu (phones and tablets; on large screens the header carries the links). It is also home to what the
// header leaves out: the team login, call/WhatsApp, opening hours and the colour theme.
import { CircleHelp, ClipboardList, Clock, House, Info, MapPin, MessageCircle, Phone, ShoppingBasket, Truck, User, type LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher"
import { BrandMark } from "@/components/store/BrandMark"
import { useTeamEntries } from "@/components/store/TeamLogin"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useCustomer } from "@/contexts/CustomerContext"
import { useStore } from "@/contexts/StoreContext"
import { type FooterLink, storeNavLinks, storefrontExtras } from "@/lib/storefrontExtras"
import { formatPhone, initials } from "@/lib/utils"
import { useStoreSession } from "@/stores/storeSession"

const ICONS: Record<string, LucideIcon> = {
  Home: House,
  Products: ShoppingBasket,
  "About us": Info,
  Delivery: Truck,
  FAQ: CircleHelp,
  "Contact us": MessageCircle,
  "My orders": ClipboardList,
  Account: User,
}
const CY: Record<string, string> = { Products: "nav-menu", "My orders": "nav-orders", Account: "nav-account", FAQ: "nav-faq" }
const rowCls = "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base transition-colors hover:bg-muted"

export function NavDrawer() {
  const { slug, profile } = useStore()
  const { overlay, close, open } = useStoreSession()
  const { session, isSignedIn } = useCustomer()
  const team = useTeamEntries()
  const extras = storefrontExtras(slug)
  const whatsapp = profile.socialLinks?.whatsapp ?? null
  const links: FooterLink[] = [...storeNavLinks(slug), { label: "My orders", href: `/${slug}/orders` }, { label: "Account", href: `/${slug}/account` }]

  return (
    <Sheet open={overlay === "nav"} onOpenChange={(o) => (o ? open("nav") : close())}>
      <SheetContent side="left" aria-describedby={undefined} data-cy="nav-drawer">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <BrandMark className="size-10 text-lg" />
            <SheetTitle>{profile.name}</SheetTitle>
          </div>
          {profile.tagline ? <p className="text-sm text-muted-foreground">{profile.tagline}</p> : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Account */}
          <div className="p-3">
            {isSignedIn ? (
              <Link to={`/${slug}/account`} onClick={close} className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3" data-cy="nav-signed-in">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">{initials(session?.customer.name) || <User className="size-5" />}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">Hi, {session?.customer.name?.split(/\s+/)[0] ?? "there"}</span>
                  <span className="block truncate text-sm text-muted-foreground">{session?.customer.guest ? "Ordering as a guest" : (session?.customer.email ?? session?.customer.phone ?? "Your account")}</span>
                </span>
              </Link>
            ) : null}
          </div>

          <nav aria-label="Menu" className="flex flex-col px-2 pb-2">
            {links.map((l) => {
              const Icon = ICONS[l.label] ?? ShoppingBasket
              const body = (<><Icon className="size-5 text-primary" />{l.label}</>)
              return l.external ? (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer" onClick={close} className={rowCls}>{body}</a>
              ) : (
                <Link key={l.label} to={l.href} onClick={close} className={rowCls} data-cy={CY[l.label]}>{body}</Link>
              )
            })}
            <button type="button" onClick={() => open("branch")} className={rowCls} data-cy="nav-branches">
              <MapPin className="size-5 text-primary" />
              Branches
            </button>
          </nav>

          {/* For the team: admins, staff and riders each have their own sign-in. */}
          <div className="mx-3 mb-3 rounded-xl border p-3" data-cy="nav-team">
            <p className="text-sm font-semibold">{team.signedIn ? "Your team portal" : "Work here?"}</p>
            <div className="mt-2 grid gap-2">
              {team.entries.map((e) => (
                <Button key={e.href} variant="outline" className="h-auto justify-between px-3 py-2" asChild>
                  <Link to={e.href} onClick={close} data-cy={`nav-${e.href.split("/")[1]}-login`}>
                    <span className="font-medium">{e.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">{e.hint}</span>
                  </Link>
                </Button>
              ))}
            </div>
          </div>

          {/* Contact */}
          {profile.phone || whatsapp ? (
            <div className="mx-3 mb-3 rounded-xl border p-3">
              <p className="text-sm font-semibold">Got any questions?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {profile.phone ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${profile.phone}`} aria-label={`Call ${formatPhone(profile.phone)}`}><Phone /> Call</a>
                  </Button>
                ) : null}
                {whatsapp ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
                  </Button>
                ) : null}
              </div>
              {extras.hours?.length ? (
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <Clock className="mt-0.5 size-3.5 shrink-0" />
                  <span>{extras.hours.map((h) => <span key={h} className="block">{h}</span>)}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border-t p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appearance</p>
          <ThemeSwitcher variant="labels" />
        </div>
      </SheetContent>
    </Sheet>
  )
}
