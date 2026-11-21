// Logo artwork shipped with the server (server/public/brand, served at /brand). Emails need an image at a public web
// address. A restaurant listed here always uses this badge in emails (as the web app does with its own copy, keyed by the
// same slug in the client's storefrontExtras); a logo uploaded in Admin → Settings (Cloudinary) is used for restaurants
// that are not listed.
import { env } from "../../config/env";

interface BuiltInBrand {
  /** The round badge (white inside, transparent outside its scalloped edge), so it reads on the dark email header. */
  badge: string;
}

const BUILT_IN: Record<string, BuiltInBrand> = {
  kiros: { badge: "kiros-mark.png" },
};

export function builtInBadgeUrl(slug: string): string | null {
  const brand = BUILT_IN[slug];
  return brand ? `${env.appUrl}/brand/${brand.badge}` : null;
}
