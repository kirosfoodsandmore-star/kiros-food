// The restaurant's round badge. Brand artwork set up in lib/storefrontExtras wins; otherwise the logo uploaded in
// Admin → Settings; otherwise the first letter on a tile. The badge artwork is transparent outside its scalloped edge
// and white inside, so it reads the same on light and dark surfaces.
import { useStore } from "@/contexts/StoreContext"
import { storefrontExtras } from "@/lib/storefrontExtras"
import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  const { slug, profile } = useStore()
  const brand = storefrontExtras(slug).brand
  if (brand) return <img src={brand.mark} alt="" className={cn("shrink-0 object-contain", className)} />
  if (profile.logoUrl) return <img src={profile.logoUrl} alt="" className={cn("shrink-0 rounded-md object-cover", className)} />
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-md bg-primary font-display font-semibold text-primary-foreground", className)}>
      {profile.name[0]}
    </span>
  )
}
