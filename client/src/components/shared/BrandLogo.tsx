// The logo as the staff-facing screens (sign-in pages, admin sidebar) show it. Brand artwork set up for a restaurant in
// lib/storefrontExtras wins; otherwise the logo uploaded in Admin → Settings; otherwise the platform's own "K" tile.
// The full lockup is dark lettering, so on dark surfaces it sits on a white plate to stay readable.
import { storefrontExtras } from "@/lib/storefrontExtras"
import { cn } from "@/lib/utils"

export interface BrandLogoProps {
  /** Restaurant slug; the sign-in pages use the deployment's default one. */
  slug?: string
  /** The logo uploaded in Admin → Settings, when there is one. */
  logoUrl?: string | null
  /** Restaurant name, used when the logo is an uploaded image (it carries no lettering of its own). */
  name?: string
  className?: string
}

export function BrandLogo({ slug, logoUrl, name, className }: BrandLogoProps) {
  const brand = slug ? storefrontExtras(slug).brand : undefined
  if (brand) {
    return (
      <span className="inline-flex items-center dark:rounded-lg dark:bg-white dark:px-2 dark:py-1" data-cy="brand-logo">
        <img src={brand.lockup} alt={name ?? "Kiros Farmshop"} className={cn("h-8 w-auto", className)} />
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
