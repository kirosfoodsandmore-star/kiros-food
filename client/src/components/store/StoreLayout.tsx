// Storefront shell: resolves the restaurant by slug, provides store + customer contexts, renders the
// header, overlays and footer. The branch picker opens once on arrival when no branch is stored.
import { Suspense, useEffect, useMemo } from "react"
import { Outlet, useParams } from "react-router-dom"
import { toast } from "sonner"
import { PageLoader } from "@/components/shared/PageLoader"
import { ErrorState } from "@/components/shared/States"
import { CustomerProvider } from "@/contexts/CustomerContext"
import { StoreProvider, useStore, useStoreProfile } from "@/contexts/StoreContext"
import { useStoreBranches } from "@/hooks/useStore"
import { pickDefaultBranch } from "@/lib/defaultBranch"
import { storefrontExtras } from "@/lib/storefrontExtras"
import { useStoreSession } from "@/stores/storeSession"
import { ActiveOrderBar } from "./ActiveOrderBar"
import { BranchPicker } from "./BranchPicker"
import { CartDrawer } from "./CartDrawer"
import { StoreFooter } from "./Footer"
import { StoreHeader } from "./Header"
import { MenuSwitcher } from "./MenuSwitcher"
import { NavDrawer } from "./NavDrawer"
import { SearchDialog } from "./SearchDialog"

export default function StoreLayout() {
  const { slug = "" } = useParams()
  const { data: apiProfile, isLoading, error, refetch } = useStoreProfile(slug)
  // The storefront's display name (lib/storefrontExtras) wins over the name saved in Settings, so the footer, copyright
  // and page titles all read the same.
  const displayName = storefrontExtras(slug).displayName
  const profile = useMemo(() => (apiProfile && displayName ? { ...apiProfile, name: displayName } : apiProfile), [apiProfile, displayName])

  if (isLoading) return <PageLoader label="Opening the shop…" />
  if (error || !profile) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <ErrorState message="We couldn't find this restaurant." onRetry={() => void refetch()} />
      </main>
    )
  }
  return (
    <StoreProvider slug={slug} profile={profile}>
      <CustomerProvider slug={slug}>
        <StoreShell />
      </CustomerProvider>
    </StoreProvider>
  )
}

function StoreShell() {
  const { slug, profile } = useStore()
  const { branchId, open, setBranch, clearCart, slug: sessionSlug } = useStoreSession()
  const { data: branches } = useStoreBranches(slug)
  // A first visit shows a branch straight away instead of an empty page behind a picker: the one the admin chose in
  // Settings, or an open one (see lib/defaultBranch). The same applies if the saved branch no longer exists. Visitors can
  // still switch from the branch button in the header. Wait until the session belongs to this restaurant: on a
  // first visit StoreProvider's setSlug runs after this effect and resets the session.
  useEffect(() => {
    if (sessionSlug !== slug || !branches) return
    if (branchId && branches.some((b) => b.id === branchId)) return
    const pick = pickDefaultBranch(branches, profile.defaultBranchId)
    if (!pick) return
    if (branchId) clearCart() // the saved bag belonged to a branch that is gone
    setBranch(pick.id, pick.menus[0]?.id ?? null)
    toast(`Showing ${pick.name}`, { description: "Tap the branch name at the top to order from a different branch.", action: { label: "Change", onClick: () => open("branch") } })
  }, [branchId, branches, clearCart, open, profile.defaultBranchId, sessionSlug, setBranch, slug])
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <a
        href="#store-main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById("store-main")?.focus()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <StoreHeader />
      <ActiveOrderBar />
      <main id="store-main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 outline-none">
        {/* Page chunks load inside the shell, so the header and footer stay put while a new page arrives. */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <StoreFooter />
      <NavDrawer />
      <BranchPicker />
      <MenuSwitcher />
      <SearchDialog />
      <CartDrawer />
    </div>
  )
}
