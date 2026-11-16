// Company details the storefront shows that Admin → Settings can't store yet: Settings holds one email,
// no opening hours and no footer links. Name, phone, address, tagline, email and social links still come
// from Settings (the API); only these extras live here, keyed by the restaurant's slug. To add another
// restaurant, add an entry; when Settings gains these fields, delete this file and read them from the API.

// Web-sized copies of the Kiros Farmshop logo (made from client/logo.png): the full lockup, and the round badge on a
// white disc, which also reads on dark surfaces.
import brandLockup from "@/assets/brand/kiros-farmshop-logo.png"
import brandMark from "@/assets/brand/kiros-farmshop-mark.png"

export interface FooterLink {
  label: string
  /** An in-app path ("/{slug}/faq" style, filled in by the footer) or a full URL. */
  href: string
  external?: boolean
}

export interface AboutContent {
  heading: string
  paragraphs: string[]
  quote: string
  reasons: Array<{ title: string; text: string; icon: "fresh" | "farm" | "quality" | "delivery" }>
}

/** Home-page copy. Each field falls back to generic restaurant wording when left out. */
export interface HomeContent {
  /** The paragraph under the hero headline. */
  heroIntro?: string
  /** The two-line chat shown floating beside the hero dish: [customer, team]. */
  heroChat?: [string, string]
  /** "How it works", step 2 ("Make it yours"). */
  makeItYours?: string
  /** The intro under the "Build your own" heading. */
  buildYourOwnIntro?: string
}

export interface StorefrontExtras {
  /** Logo artwork: `lockup` is the badge plus wordmark (light backgrounds), `mark` is the badge alone (any background). */
  brand?: { lockup: string; mark: string }
  /** Content for the About page. Without it, the page and its links are not shown. */
  about?: AboutContent
  home?: HomeContent
  salesEmail?: string
  /** One line per period, e.g. "Mon–Sat: 8:30am–7:30pm". */
  hours?: string[]
  deliveryNotice?: string
  /** Social links Settings has no field for (it stores Instagram, Facebook, Twitter, TikTok and WhatsApp). */
  socialLinks?: Record<string, string>
  /** Company pages that live on the main website (shown in the footer's link list). */
  companyLinks?: FooterLink[]
  /** Policies, shown in the footer's bottom bar. */
  legalLinks?: FooterLink[]
}

// From "KIROS FAQ Content.docx" (copied from kiros.ng). Sunday is written "12:30am" on the website, which the
// document flags as a probable typo; it is shown as 12:30pm here.
const KIROS_FARMSHOP: StorefrontExtras = {
  brand: { lockup: brandLockup, mark: brandMark },
  // From "KIROS FarmShop — Menu Ordering User Stories.md": the shop menu is salads (build your own or a signature
  // salad), shawarma, wraps and sandwiches, smoothies, parfait and juices.
  home: {
    heroIntro: "Build your own salad from over 40 fresh ingredients, or pick a signature salad, smoothie, fresh juice or shawarma. Delivery or pickup from your nearest KIROS branch.",
    heroChat: ["Dressing on the side, please?", "Of course! Packing your salad now."],
    makeItYours: "Choose a base, up to 10 fillings, 2 cravings and a dressing, then add a protein if you like. The price updates as you go.",
    buildYourOwnIntro: "Start with a base, add up to 10 fillings, pick 2 cravings and finish with a dressing. Add a protein for a little extra and watch the price update as you build.",
  },
  salesEmail: "sales@kiros.ng",
  hours: ["Mon–Sat: 8:30am–7:30pm", "Sun: 12:30pm–4:30pm"],
  deliveryNotice: "Please supply a correct and verifiable address for delivery.",
  // The footer's YouTube icon on kiros.ng points at a placeholder; this is the channel the Contact Us page uses.
  socialLinks: { youtube: "https://youtube.com/kirosfarmshop" },
  about: {
    heading: "Welcome to Kiros Farmshop!",
    paragraphs: [
      "Kiros Farmshop, located in Nigeria, is a retail outlet that usually sells produce directly from our farms. We resell related goods such as locally produced groceries, foods, drinks and delicatessen products.",
      "We offer direct sales to our consumers, and we allow other merchants to retain a larger portion of the resulting products than they can obtain by selling to a wholesaler or larger reseller.",
      "Our farmshops sell higher-margin premium goods such as organic produce of known local provenance, in order to differentiate our offerings from those in supermarkets.",
      "Our kitchen turns that produce into food to order: build-your-own and signature salads, smoothies, parfait, natural juice blends, shawarma, wraps and sandwiches.",
    ],
    quote: "Fresh and organic farm produce you can trust.",
    // Written from statements in the FAQ and welcome text. The website's other items (Overall Healthy, Environmental
    // Safety, Antioxidant Capacity, Good For Arteries) are health/safety claims with no text of their own: add them
    // here once they can be backed up.
    reasons: [
      { title: "Always fresh", icon: "fresh", text: "Our products are kept in the best condition to make sure they're always fresh. We don't store items for more than 24 hours." },
      { title: "Direct from our farms", icon: "farm", text: "Much of what we sell comes straight from our own farms, alongside locally produced groceries, foods and drinks." },
      { title: "Quality standards", icon: "quality", text: "Every item is properly stored within our storage time and delivered to you in good condition." },
      { title: "Delivered by our own team", icon: "delivery", text: "Our dedicated delivery team and dispatch riders make sure your order reaches you quickly and accurately." },
    ],
  },
  companyLinks: [
    { label: "Delivery", href: "https://kiros.ng/delivery", external: true },
  ],
  legalLinks: [
    { label: "Privacy Policy", href: "https://kiros.ng/privacy-policy", external: true },
    { label: "Delivery Policy", href: "https://kiros.ng/delivery-policy", external: true },
    { label: "Terms & Conditions", href: "https://kiros.ng/tc", external: true },
  ],
}

const BY_SLUG: Record<string, StorefrontExtras> = {
  kiros: KIROS_FARMSHOP,
}

export function storefrontExtras(slug: string): StorefrontExtras {
  return BY_SLUG[slug] ?? {}
}

/** The main site links, in the same order everywhere (header, side menu, footer). */
export function storeNavLinks(slug: string): FooterLink[] {
  const extras = storefrontExtras(slug)
  const company = extras.companyLinks ?? []
  const pick = (label: string) => company.filter((l) => l.label === label)
  return [
    { label: "Home", href: `/${slug}` },
    { label: "Menu", href: `/${slug}/menu` },
    ...(extras.about ? [{ label: "About us", href: `/${slug}/about` }] : []),
    ...pick("Delivery"),
    { label: "FAQ", href: `/${slug}/faq` },
    { label: "Contact us", href: `/${slug}/contact` },
  ]
}
