// Logo artwork shipped with the server (server/public/brand, served at /brand). Emails need an image at a public web
// address; a logo uploaded in Admin → Settings (Cloudinary) always wins, and these cover restaurants that haven't
// uploaded one yet. Keyed by restaurant slug, like the storefront's own extras on the client.
import { env } from "../../config/env";

interface BuiltInBrand {
  /** Round badge on its own white disc, so it reads on the dark email header. */
  badge: string;
}

const BUILT_IN: Record<string, BuiltInBrand> = {
  kiros: { badge: "kiros-farmshop-mark.png" },
};

export function builtInBadgeUrl(slug: string): string | null {
  const brand = BUILT_IN[slug];
  return brand ? `${env.appUrl}/brand/${brand.badge}` : null;
}
