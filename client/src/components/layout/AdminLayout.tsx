// Portal shell: collapsible sidebar (sheet on mobile), top bar with the restaurant name, theme toggle and account menu.
// Connects the staff socket and plays a sound on new orders. The rider portal uses the same shell with the rider's own
// sidebar (portal="rider"), so riders and admins get the same layout without the rider ever seeing admin screens.
import { ExternalLink, LogOut, Menu as MenuIcon, User, Volume2, VolumeX } from "lucide-react"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { Link, Outlet, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { BrandLogo } from "@/components/shared/BrandLogo"
import { PageLoader } from "@/components/shared/PageLoader"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/AuthContext"
import { ThemeMenu } from "@/components/shared/ThemeSwitcher"
import { useLiveOrderInvalidation } from "@/hooks/useAdminOrders"
import { useDeliveryAlerts } from "@/hooks/useDeliveryAlerts"
import { usePersistedState } from "@/hooks/usePersistedState"
import { useSocketEvent } from "@/hooks/useSocketEvent"
import { playChime } from "@/lib/chime"
import { refreshPush } from "@/lib/push"
import { connectSocket } from "@/lib/socket"
import { initials } from "@/lib/utils"
import type { OrderSummary } from "@/types/store.types"
import { AdminNav } from "./AdminNav"
import { RiderNav } from "./RiderNav"

export default function AdminLayout({ portal = "admin" }: { portal?: "admin" | "rider" }) {
  const rider = portal === "rider"
  const { session, signOut, canAny } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [sound, setSound] = usePersistedState("kiros.admin.sound", true)
  const soundRef = useRef(sound)
  soundRef.current = sound
  // Only people who act on new orders (accept, confirm a payment, reject) get the new-order chime. A rider can see
  // orders but has nothing to do with a new one; they get their own alert when a delivery is assigned to them.
  const handlesOrders = canAny("orders.update_status", "orders.reject", "payments.confirm")
  const handlesOrdersRef = useRef(handlesOrders)
  handlesOrdersRef.current = handlesOrders

  useEffect(() => {
    connectSocket("staff")
  }, [])
  // Notifications already allowed on this device: keep the server's copy of the token current for whoever is signed in.
  useEffect(() => {
    void refreshPush()
  }, [])
  // The rider portal can be installed to the Home Screen as its own app (and iPhones only deliver notifications to an installed app).
  useEffect(() => {
    if (!rider) return
    // iPhones ignore the manifest's icons and want their own touch icon.
    const links = [
      { rel: "manifest", href: "/rider.webmanifest" },
      { rel: "apple-touch-icon", href: "/rider-apple-touch-icon.png" },
    ].map((l) => Object.assign(document.createElement("link"), l))
    links.forEach((l) => document.head.appendChild(l))
    return () => links.forEach((l) => l.remove())
  }, [rider])
  const onNewOrder = useCallback((o: OrderSummary) => {
    if (!handlesOrdersRef.current) return
    if (soundRef.current) playChime()
    toast.success(`New order ${o.number} · ${o.branchName}`, { action: { label: "Open", onClick: () => navigate(`/admin/orders/${o.id}`) } })
  }, [navigate])
  useSocketEvent<OrderSummary>("staff", "order:new", onNewOrder)
  // A delivery handed to this person (a rider, or a manager who also rides): the server tells them alone.
  useDeliveryAlerts(sound, rider ? "/rider" : "/admin/deliveries")
  // The sidebar's order count has to move on every page, not only the ones that list orders.
  useLiveOrderInvalidation()

  const nav = rider ? <RiderNav onNavigate={() => setOpen(false)} /> : <AdminNav onNavigate={() => setOpen(false)} />

  const brand = (
    <BrandLogo slug={session?.restaurant.slug} logoUrl={session?.restaurant.logoUrl} name={session?.restaurant.name} />
  )

  // Scrolling model: the document scrolls the main column (so mobile browser chrome collapses naturally);
  // the header is sticky, and the desktop sidebar is pinned to the viewport with its own scroll area.
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card lg:flex print:hidden!" data-cy={rider ? "rider-sidebar" : "admin-sidebar"}>
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4 font-display font-semibold">{brand}</div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin">{nav}</div>
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0" aria-describedby={undefined} data-cy={rider ? "rider-nav-drawer" : "admin-nav-drawer"}>
          <SheetTitle className="flex h-14 shrink-0 items-center gap-2 border-b px-4 text-base">{brand}</SheetTitle>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin">{nav}</div>
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur sm:px-5 print:hidden!" data-cy={rider ? "rider-header" : "admin-header"}>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation" data-cy="admin-nav-toggle">
            <MenuIcon />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate font-display font-semibold">
              {session?.restaurant.name}
              {rider ? <span className="rounded-full bg-primary/10 px-2 py-0.5 font-sans text-xs font-semibold text-primary">Rider</span> : null}
            </p>
          </div>
          {rider ? null : (
            <Button variant="ghost" size="icon" asChild aria-label="Open storefront">
              <a href={`/${session?.restaurant.slug}`} target="_blank" rel="noreferrer" data-cy="open-storefront">
                <ExternalLink />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setSound(!sound)} aria-label={sound ? (rider ? "Mute delivery alerts" : "Mute new-order sound") : rider ? "Unmute delivery alerts" : "Unmute new-order sound"} data-cy="sound-toggle">
            {sound ? <Volume2 /> : <VolumeX />}
          </Button>
          <ThemeMenu />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground" aria-label="Account menu" data-cy="account-menu">
                {initials(session?.user.name)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{session?.user.name}</p>
                <p>{session?.user.roleName}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={rider ? "/rider/account" : "/admin/me"} data-cy="menu-my-account"><User /> My account</Link>
              </DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={() => void signOut().then(() => navigate(rider ? "/rider/login" : "/admin/login"))} data-cy="menu-signout">
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 print:p-0">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
