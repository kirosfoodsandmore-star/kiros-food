// Storefront header, kept deliberately light: brand and a few links on the left; the branch, search, theme,
// account and bag on the right (icons only). Contact details, hours and sign-in live in the side menu and
// footer. "/" or Ctrl/Cmd+K opens search from anywhere. The bar stays 56px tall: other sticky elements
// (category tabs, FAQ menu) offset themselves by it.
import { ChevronDown, MapPin, Menu as MenuIcon, Search, ShoppingBag, User } from "lucide-react"
import { useEffect } from "react"
import { Link, NavLink } from "react-router-dom"
import { Money } from "@/components/shared/Money"
import { ThemeMenu } from "@/components/shared/ThemeSwitcher"
import { Button } from "@/components/ui/button"
import { useCustomer } from "@/contexts/CustomerContext"
import { useStore } from "@/contexts/StoreContext"
import { useCart } from "@/hooks/useCart"
import { useScrolled } from "@/hooks/useMotion"
import { useStoreBranches } from "@/hooks/useStore"
import { BrandMark } from "./BrandMark"
import { TeamPortalLink } from "./TeamLogin"
import { storeNavLinks, storefrontExtras } from "@/lib/storefrontExtras"
import { cn, initials, plural } from "@/lib/utils"
import { useStoreSession } from "@/stores/storeSession"

const navCls = "relative rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
// Links shown in the bar (Home is the logo; About stays in the footer and side menu). "My orders" joins them once the
// customer has a session, so a placed order is never more than one click away on wider screens.
const BAR_LINKS = ["Menu", "FAQ", "Contact us"]

export function StoreHeader() {
  const { slug, profile, fmt } = useStore()
  const { branchId, open, overlay } = useStoreSession()
  const { data: branches } = useStoreBranches(slug)
  const { session, isSignedIn } = useCustomer()
  const { cart, itemCount } = useCart()
  const scrolled = useScrolled()
  const branch = branches?.find((b) => b.id === branchId)
  const links = [...storeNavLinks(slug).filter((l) => BAR_LINKS.includes(l.label)), ...(isSignedIn ? [{ label: "My orders", href: `/${slug}/orders` }] : [])]
  const brand = storefrontExtras(slug).brand

  // "/" or Ctrl/Cmd+K opens search from anywhere (unless you're typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)
      const combo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"
      if (combo || (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        e.preventDefault()
        open("search")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const state = branch ? (branch.isOpen ? "open" : branch.isPaused ? "paused" : "closed") : null
  const branchLabel = branch ? `${branch.name}, ${state}${state === "open" && branch.closesAt ? ` till ${branch.closesAt}` : ""}. Change branch` : "Choose a branch"

  return (
    <header className={cn("sticky top-0 z-40 border-b bg-card/95 backdrop-blur transition-shadow duration-300 supports-[backdrop-filter]:bg-card/80", scrolled && "shadow-md shadow-black/5")} data-cy="store-header">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-2 sm:gap-2 sm:px-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => open("nav")} aria-label="Open menu" aria-expanded={overlay === "nav"} data-cy="nav-toggle">
          <MenuIcon />
        </Button>
        <Link to={`/${slug}`} className="flex shrink-0 items-center gap-2 rounded-lg font-display text-lg font-semibold lg:mr-3" aria-label={profile.name} data-cy="brand-link">
          {brand ? (
            <>
              <BrandMark className="size-9 sm:hidden" />
              <span className="hidden items-center sm:flex dark:rounded-lg dark:bg-white dark:px-2 dark:py-1">
                <img src={brand.lockup} alt={profile.name} className="h-8 w-auto" />
              </span>
            </>
          ) : (
            <>
              <BrandMark className="size-8" />
              <span className="hidden sm:inline">{profile.name}</span>
            </>
          )}
        </Link>

        <nav aria-label="Main" className="hidden items-center lg:flex" data-cy="store-nav">
          {links.map((l) =>
            l.external ? (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className={navCls}>{l.label}</a>
            ) : (
              <NavLink key={l.label} to={l.href} className={({ isActive }) => cn(navCls, isActive && "text-foreground after:absolute after:inset-x-3 after:-bottom-[9px] after:h-0.5 after:rounded-full after:bg-primary")}>
                {l.label === "Contact us" ? "Contact" : l.label === "My orders" ? "Orders" : l.label}
              </NavLink>
            )
          )}
        </nav>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={() => open("branch")}
            title={branchLabel}
            aria-label={branchLabel}
            className="mr-1 flex min-w-0 flex-1 items-center gap-2 rounded-full border px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted md:max-w-52 md:flex-none"
            data-cy="branch-pill"
          >
            <MapPin className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate font-medium">{branch ? branch.name : "Choose a branch"}</span>
            {state ? <span className={cn("size-2 shrink-0 rounded-full", state === "open" ? "bg-success" : "bg-destructive")} aria-hidden /> : null}
            <ChevronDown className="size-4 shrink-0 opacity-60" />
          </button>

          <Button variant="ghost" size="icon" onClick={() => open("search")} aria-label="Search (press / )" title="Search ( / )" data-cy="search-toggle">
            <Search />
          </Button>

          <TeamPortalLink />

          {/* Theme and account: wider screens only. On phones both live in the side menu, which keeps the bar clear. */}
          <div className="hidden md:block"><ThemeMenu /></div>
          {isSignedIn ? (
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" asChild data-cy="account-link">
              <Link to={`/${slug}/account`} aria-label={`Your account, ${session?.customer.name ?? ""}`} title={session?.customer.name ?? "Account"}>
                {initials(session?.customer.name) ? <span className="grid size-7 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{initials(session?.customer.name)}</span> : <User />}
              </Link>
            </Button>
          ) : (
            // Signed out: "Sign in" is for the team (admin, staff, riders), so it opens the Team login page. Customers
            // order as guests and aren't asked to make an account from the header.
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" asChild data-cy="account-link">
              <Link to="/team" aria-label="Sign in (team login)" title="Sign in (team login)">
                <User />
              </Link>
            </Button>
          )}

          <button
            type="button"
            onClick={() => open("cart")}
            className={cn("relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors", itemCount > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90 md:px-3.5" : "hover:bg-muted", itemCount > 0 && cart ? "size-10 md:w-auto" : "size-10")}
            aria-label={`Bag, ${plural(itemCount, "item")}`}
            title="Your bag"
            data-cy="cart-toggle"
          >
            <ShoppingBag className="size-5" />
            {itemCount > 0 && cart ? <span className="hidden md:inline"><Money value={cart.total} fmt={fmt} /></span> : null}
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold text-accent-foreground ring-2 ring-card" data-cy="cart-badge">
                {itemCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  )
}
