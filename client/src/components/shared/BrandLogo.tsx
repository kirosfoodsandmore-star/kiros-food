// The logo as the staff-facing screens (sign-in pages, admin sidebar) show it. Brand artwork set up for a restaurant in
// lib/storefrontExtras wins (the round badge on its own: it already reads as the name); otherwise the logo uploaded
// in Admin → Settings with the name beside it; otherwise the platform's own "K" tile.
import { storefrontExtras } from "@/lib/storefrontExtras"
import { cn } from "@/lib/utils"

export interface BrandLogoProps {
  /** Restaurant slug; the sign-in pages use the deployment's default one. */
  slug?: string
  /** The logo uploaded in Admin → Settings, when there is one. */
  logoUrl?: string | null
  /** Restaurant name: the badge's alt text, or the text beside an uploaded logo. */
  name?: string
  /** Sizing for the badge or uploaded logo, e.g. "size-20". */
  className?: string
}

export function BrandLogo({ slug, logoUrl, name, className }: BrandLogoProps) {
  const brand = slug ? storefrontExtras(slug).brand : undefined
  if (brand) {
    return (
      <span className="inline-flex items-center" data-cy="brand-logo">
        <img src={brand.mark} alt={name ?? "Kiros"} className={cn("shrink-0 object-contain", className ?? "size-10")} />
      </span>
    )
  }
  if (logoUrl) {
    return (
      <span className="inline-flex items-center gap-2 font-display font-semibold" data-cy="brand-logo">
        <img src={logoUrl} alt="" className="size-8 rounded-md object-cover" />
        {name}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 font-display font-semibold" data-cy="brand-logo">
      <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">K</span> Kiros
    </span>
  )
}
