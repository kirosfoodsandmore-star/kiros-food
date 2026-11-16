// Storefront home: hero, dish marquee, kitchens, how it works, build-your-own preview, categories and
// favourites. Every section is driven by the restaurant's real data and hides itself when empty.
import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { BuildYourOwn } from "@/components/store/home/BuildYourOwn"
import { Hero } from "@/components/store/home/Hero"
import { CategoryTiles, DishMarquee, Favourites, HowItWorks, Kitchens } from "@/components/store/home/Sections"
import { useStore } from "@/contexts/StoreContext"
import { storefrontExtras } from "@/lib/storefrontExtras"
import { useBranchMenus, useFeatured, useStoreBranches, useStoreMenu } from "@/hooks/useStore"
import { useStoreSession } from "@/stores/storeSession"

export default function HomePage() {
  const { slug, profile, fmt } = useStore()
  const navigate = useNavigate()
  const { branchId, menuId, setMenu, open } = useStoreSession()
  const { data: branches } = useStoreBranches(slug)
  const { data: menus } = useBranchMenus(slug, branchId)
  const { data: featured, isLoading: featuredLoading } = useFeatured(slug, branchId)
  const { data: menu } = useStoreMenu(slug, menuId ?? menus?.[0]?.id ?? null, branchId)
  const branch = branches?.find((b) => b.id === branchId)
  const copy = storefrontExtras(slug).home

  const menuItems = useMemo(() => (menu?.categories ?? []).flatMap((c) => c.items), [menu])
  const categoryNames = useMemo(() => new Map((menu?.categories ?? []).map((c) => [c.id, c.name])), [menu])
  const categoryName = (id: string) => categoryNames.get(id)
  // Hero showcase: favourites first, then the rest of the menu, available dishes only.
  const showcase = useMemo(() => {
    const seen = new Set<string>()
    return [...(featured ?? []), ...menuItems].filter((d) => d.isAvailable && !seen.has(d.id) && (seen.add(d.id), true)).slice(0, 5)
  }, [featured, menuItems])
  const marquee = useMemo(() => [...new Set([...(featured ?? []), ...menuItems].map((d) => d.name))].slice(0, 12), [featured, menuItems])
  const configurable = useMemo(() => [...menuItems].filter((i) => i.optionGroupCount >= 3 && i.isAvailable).sort((a, b) => b.optionGroupCount - a.optionGroupCount).slice(0, 3), [menuItems])
  const dishCount = useMemo(() => new Set([...(featured ?? []), ...menuItems].map((d) => d.id)).size, [featured, menuItems])
  const cityCount = new Set((branches ?? []).map((b) => b.city)).size

  return (
    <div className="space-y-24 pb-8 pt-6 sm:space-y-32" data-cy="home-page">
      <div>
        <Hero
          slug={slug}
          name={profile.name}
          tagline={profile.tagline}
          logoUrl={profile.logoUrl}
          fmt={fmt}
          branches={branches ?? []}
          branch={branch}
          dishes={showcase}
          dishCount={dishCount}
          categoryName={categoryName}
          onFindBranch={() => open("branch")}
        />
        <DishMarquee names={marquee} />
      </div>

      {menus && menus.length > 1 ? (
        <Kitchens
          menus={menus}
          onOpen={(id) => {
            setMenu(id)
            navigate(`/${slug}/menu`)
          }}
        />
      ) : null}

      <HowItWorks branchCount={branches?.length ?? 0} cityCount={cityCount} makeItYours={copy?.makeItYours} />

      {configurable.length > 0 ? <BuildYourOwn slug={slug} branchId={branchId} fmt={fmt} items={configurable} categoryName={categoryName} intro={copy?.buildYourOwnIntro} /> : null}

      {menu && menu.categories.length > 0 ? <CategoryTiles slug={slug} categories={menu.categories.filter((c) => c.items.length > 0)} /> : null}

      <Favourites slug={slug} fmt={fmt} items={featured ?? []} loading={featuredLoading && Boolean(branchId)} hasBranch={Boolean(branchId)} />
    </div>
  )
}
