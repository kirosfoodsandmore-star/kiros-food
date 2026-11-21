// The three policy pages linked from the footer. Written from the restaurant's FAQ ("KIROS FAQ Content") and from how the
// storefront actually works (payment window, cancellation rule, delivery zones, email sign-in, the services it uses),
// so each statement can be checked against the product. Have the business (and a lawyer) read these before relying on
// them. Decisions that are the business's to make, and that these drafts assume:
//   - Privacy: how long order records are kept (no fixed period is stated); that customers are not sent marketing email.
//   - Delivery: a missed delivery is returned to the branch and not automatically refunded; refunds "take a few working days".
//   - Terms: a paid order cannot be cancelled online (it is made fresh); liability is capped at the order amount; customers
//     under 18 should order through an adult; Nigerian law governs (no court or state is named).
//   - "No returns" and the 24-hour storage limit come from the FAQ; "refund in full when we cannot fulfil" matches the
//     product's refund feature.

export type LegalKey = "privacy-policy" | "delivery-policy" | "terms"

/** Where a "see also" link at the end of a section goes (an in-app path under the storefront). */
export type LegalLinkTarget = LegalKey | "contact" | "faq" | "orders"

export interface LegalSection {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  /** Paragraphs shown after the bullets. */
  after?: string[]
  link?: { label: string; to: LegalLinkTarget }
}

export interface LegalDoc {
  key: LegalKey
  /** Footer label and page title. */
  title: string
  /** One or two sentences under the title. */
  summary: string
  sections: LegalSection[]
}

export interface LegalContext {
  /** The name the storefront shows, e.g. "Kiros Foods". */
  name: string
  email: string | null
  phone: string | null
  address: string | null
}

export const LEGAL_UPDATED = "20 November 2026"

export const LEGAL_ORDER: LegalKey[] = ["privacy-policy", "delivery-policy", "terms"]
export const LEGAL_LABEL: Record<LegalKey, string> = { "privacy-policy": "Privacy Policy", "delivery-policy": "Delivery Policy", terms: "Terms & Conditions" }

const reach = (c: LegalContext) => [c.email ? `email ${c.email}` : null, c.phone ? `call ${c.phone}` : null].filter(Boolean).join(" or ")

export function legalDoc(key: LegalKey, c: LegalContext): LegalDoc {
  switch (key) {
    case "privacy-policy":
      return privacy(c)
    case "delivery-policy":
      return delivery(c)
    case "terms":
      return terms(c)
  }
}

function privacy(c: LegalContext): LegalDoc {
  return {
    key: "privacy-policy",
    title: "Privacy Policy",
    summary: `What ${c.name} collects when you order from us, why we need it, who sees it, and the choices you have. In short: we use your details to take, make and deliver your order, and we do not sell them.`,
    sections: [
      {
        id: "who-we-are",
        title: "Who we are",
        paragraphs: [
          `${c.name} ("we", "us") runs this online ordering service for our branches in Nigeria${c.address ? `, with our head office at ${c.address}` : ""}. We decide what personal information is collected through it and how it is used, which makes us the "data controller" under Nigerian data protection law.`,
          `If you have a question about this policy or your information, ${reach(c) || "contact us through the Contact page"}.`,
        ],
      },
      {
        id: "what-we-collect",
        title: "What we collect",
        paragraphs: ["We only ask for what we need to complete your order and look after it afterwards:"],
        bullets: [
          "Your name and phone number, so the branch and our riders can reach you about your order.",
          "Your email address (optional unless you choose to create an account), so we can send order updates and your sign-in code.",
          "For delivery: your address, the point you place on the map, and any delivery instructions you add.",
          "What you ordered, any notes you write, the branch, the amount, when it was placed and how it is progressing.",
          "Messages you send us through order chat or the Contact form.",
          "For bank transfers: the transfer reference and the photo or PDF of your transfer receipt that you upload.",
          "For card payments: nothing sensitive. Card details are entered on Paystack's secure page and never reach our servers. We only receive confirmation that the payment succeeded, the reference and the amount.",
        ],
        after: [
          "If you tap \"Near me\" when choosing a branch, your browser asks permission to share your location. We use it once to sort branches by distance and do not keep it.",
        ],
      },
      {
        id: "saved-on-your-device",
        title: "What is saved on your device",
        paragraphs: [
          "The site remembers a few things in your browser so it works the way you left it: the branch you chose, the items in your bag, your colour theme, and a sign-in token that lets you reopen your orders. This is how a guest order stays reachable on the device it was placed from.",
          "We do not use advertising trackers or sell advertising to you. If you clear your browser data, these are removed, and a guest order placed on that device can no longer be opened from it. Create an account first if you want to keep access.",
        ],
      },
      {
        id: "how-we-use-it",
        title: "How we use your information",
        bullets: [
          "To take, prepare, deliver and confirm your order, and to take payment.",
          "To contact you about your order: updates, a rider on the way, a problem with an item or an address.",
          "To send the emails you would expect: order confirmations and status updates (when you gave an email), your one-time sign-in code, and replies to your messages.",
          "To keep records that we need for accounting, invoices and tax, and to settle disputes or failed payments.",
          "To keep the service safe: preventing fraud, abuse and repeated failed sign-in attempts.",
          "To improve the menu and service using order history, in ways that do not single you out.",
        ],
        after: ["We do not sell your personal information, and we do not use your email to send you marketing."],
      },
      {
        id: "who-we-share-with",
        title: "Who we share it with",
        paragraphs: ["Your information is seen only by the people and services that need it to deliver your order:"],
        bullets: [
          "Our branch staff and dispatch riders: your name, phone number, address and what you ordered.",
          "Paystack, which processes card, bank and USSD payments made on the site.",
          "Google, which hosts our live order chat and sends our emails.",
          "Cloudinary, which stores images, including receipts you upload.",
          "Mapbox, which provides the maps and address search.",
          "The authorities, if the law requires it or to protect our customers, staff or business from fraud or harm.",
        ],
        after: ["These providers handle your information on our behalf and only to provide their service. Some of them are based outside Nigeria, so your information may be processed in other countries."],
      },
      {
        id: "how-long",
        title: "How long we keep it",
        paragraphs: [
          "We keep order records for as long as we need them for accounting, tax and legal reasons, and to handle questions or complaints about an order. If you have an account, we keep it until you ask us to remove it. Messages and receipts are kept with the order they belong to.",
          "When information is no longer needed, we delete it or remove anything that identifies you.",
        ],
      },
      {
        id: "your-rights",
        title: "Your rights",
        paragraphs: ["Under the Nigeria Data Protection Act, 2023 you can ask us to:"],
        bullets: [
          "tell you what information we hold about you, and give you a copy;",
          "correct anything that is wrong or out of date;",
          "delete your information, where we have no legal reason to keep it;",
          "stop using it for a particular purpose, or withdraw a consent you gave us.",
        ],
        after: [
          `To use any of these, ${reach(c) || "contact us"} and tell us which order or email address it concerns. We may need to confirm it is really you first. If you are not satisfied with how we handle your request, you can complain to the Nigeria Data Protection Commission.`,
        ],
        link: { label: "Contact us", to: "contact" },
      },
      {
        id: "security",
        title: "How we protect it",
        paragraphs: [
          "The site uses encrypted connections, sign-in codes are stored only in a scrambled form, and staff see only what their role needs. No online service is completely secure, so please keep your device and email account safe, and tell us straight away if you think someone has used your account.",
        ],
      },
      {
        id: "children",
        title: "Children",
        paragraphs: ["This service is not meant for children. If you believe a child has given us personal information, contact us and we will remove it."],
      },
      {
        id: "changes",
        title: "Changes to this policy",
        paragraphs: [`We may update this policy from time to time. The date at the top shows when it last changed. If we change how we use your information in a significant way, we will say so on the site.`],
      },
    ],
  }
}

function delivery(c: LegalContext): LegalDoc {
  return {
    key: "delivery-policy",
    title: "Delivery Policy",
    summary: `How ${c.name} delivers, what it costs, how long it takes, and what to do if something goes wrong. You can also collect your order from the branch.`,
    sections: [
      {
        id: "delivery-or-pickup",
        title: "Delivery or pickup",
        paragraphs: [
          "Every order is placed with one branch, and you choose delivery or pickup at checkout. Pickup is free: we tell you when your order is ready and you collect it from the branch, whose address is on your order page.",
          "Delivery is made by our own dedicated delivery team and dispatch riders, from the branch you ordered from.",
        ],
      },
      {
        id: "where-we-deliver",
        title: "Where we deliver and what it costs",
        paragraphs: [
          "Each branch delivers within set distances from the branch. When you enter your address and place your point on the map, the site tells you straight away whether we deliver there and shows the delivery fee before you pay.",
        ],
        bullets: [
          "The fee depends on how far you are from the branch.",
          "Some distances have a minimum order, and some give free delivery above a certain amount. If either applies, the bag tells you.",
          "If your address is outside a branch's range, try another branch, or choose pickup.",
        ],
      },
      {
        id: "your-address",
        title: "Your address and phone number",
        paragraphs: [
          "Please give a correct and verifiable address, and add landmarks or instructions that help the rider find you. Keep the phone number you gave us switched on and within reach: our rider will call if they cannot find you.",
          "Delivery goes to the address and point on your order. We cannot be responsible for a delay or a failed delivery caused by a wrong or incomplete address or an unreachable phone.",
        ],
      },
      {
        id: "delivery-times",
        title: "How long it takes",
        paragraphs: [
          "Our food is prepared fresh once your order is confirmed, so the time is the preparation time plus the ride to you. The site shows the earliest time available for your branch and address, which is the estimate we work to.",
          "You can also schedule an order for later, and pick a time slot that suits you. Orders placed after a branch has closed can be scheduled for when it next opens: they are delivered as soon as the branch resumes, in the order they came in.",
        ],
        after: ["Each branch's opening hours are shown in the branch picker and on the menu page."],
      },
      {
        id: "tracking",
        title: "Following your order",
        paragraphs: [
          "Your order page shows each step as it happens: paid, accepted, preparing, ready, on the way and done. If you gave an email, we also email you at the main steps. You can message the branch from the same page, or call us.",
        ],
        link: { label: "Open your orders", to: "orders" },
      },
      {
        id: "delays",
        title: "If your order is late",
        paragraphs: [
          "We work to deliver promptly, but traffic, weather and busy periods can cause delays. If your order is taking longer than expected, check the order page, message the branch from it, or call us. We will tell you what is happening and keep you updated until it reaches you.",
        ],
      },
      {
        id: "when-it-arrives",
        title: "When your order arrives",
        paragraphs: [
          "Our fresh items are stored in suitable conditions and not kept beyond 24 hours, and delivered to you in good shape. Please check your order when it arrives and tell us right away, using the order chat or by phone, if something is missing, wrong or not as it should be. The sooner you tell us, the easier it is for us to put it right.",
        ],
      },
      {
        id: "missed-delivery",
        title: "If we cannot reach you",
        paragraphs: [
          "If nobody is available to receive the order and we cannot reach you by phone, the rider will return the order to the branch and contact you. Because fresh food cannot be kept, we cannot always redeliver or refund a missed delivery, but please get in touch and we will see what we can do.",
        ],
      },
      {
        id: "returns-and-refunds",
        title: "Returns and refunds",
        paragraphs: [
          "Because our items are prepared fresh and handled to be delivered in good condition, we do not accept returns. That does not leave you without help:",
        ],
        bullets: [
          "If an item is missing, wrong or not as it should be, tell us straight away and we will look into it.",
          "If you were charged but we could not fulfil the order, you are refunded in full, to the way you paid.",
          "If a payment fails or is charged twice, contact us with your order number and we will check and put it right.",
        ],
        after: ["Refunds from card and bank payments can take a few working days to show in your account, depending on your bank."],
        link: { label: "Read the Terms & Conditions", to: "terms" },
      },
      {
        id: "questions",
        title: "Questions",
        paragraphs: [`For anything about a delivery, ${reach(c) || "contact us through the Contact page"}. Please have your order number to hand.`],
        link: { label: "Contact us", to: "contact" },
      },
    ],
  }
}

function terms(c: LegalContext): LegalDoc {
  return {
    key: "terms",
    title: "Terms & Conditions",
    summary: `The rules for ordering from ${c.name} on this site: how orders, payments, cancellations and refunds work. By placing an order you agree to them.`,
    sections: [
      {
        id: "about-these-terms",
        title: "About these terms",
        paragraphs: [
          `These terms apply to every order you place with ${c.name} ("we", "us") through this website. By placing an order you agree to them and to our Privacy Policy and Delivery Policy. If you do not agree, please do not order.`,
          "You do not need an account to order. If you are under 18, please ask a parent or guardian to order for you.",
        ],
        link: { label: "Delivery Policy", to: "delivery-policy" },
      },
      {
        id: "placing-an-order",
        title: "Placing an order",
        paragraphs: [
          "You choose a branch, add items to your bag, give your details and pay. Please check the branch, items, notes, address and phone number before you pay: they are what we will prepare and deliver.",
          "An order is only confirmed once your payment is received. Until then it is held for you and shown as pending payment.",
        ],
      },
      {
        id: "menu-and-prices",
        title: "Menu, availability and prices",
        paragraphs: [
          "The menu and prices belong to the branch you choose and can differ between branches. All prices are in Naira (₦), and the total, including any delivery fee and discount, is shown before you pay.",
          "Items can sell out and branches can pause orders. Photos are for illustration, and the food may look a little different. If we have made a mistake in a price or description, we will tell you and give you the choice to continue at the correct price or cancel for a full refund.",
        ],
      },
      {
        id: "paying",
        title: "Paying for your order",
        paragraphs: ["You can pay in the ways shown at checkout, which can include:"],
        bullets: [
          "Card, bank or USSD payment through Paystack, our payment partner.",
          "Bank transfer to the account shown on your order page. Use your order number as the reference, transfer the exact amount, upload your transfer receipt and tap \"I have paid\" (if you forget the receipt, you can add it from your order page afterwards). A transfer must be made within the time shown on the order page, otherwise the order is cancelled automatically. The kitchen starts once we have confirmed the money.",
        ],
        after: [
          "Promo codes follow the conditions shown with them, such as an expiry date or a minimum spend, and can only be used as allowed. We cannot tell why a bank declines a card payment: if yours fails, please check with your bank, and contact us if you were charged but see no order.",
          "We issue an invoice for orders we receive. If you need one, ask us through the order chat or by phone.",
        ],
      },
      {
        id: "cancelling",
        title: "Cancelling an order",
        paragraphs: [
          "You can cancel an order yourself from its page while it is still unpaid. Once it is paid, our kitchen starts working on it right away because it is made fresh to order, so it cannot be cancelled online. Message the branch or call us as soon as you can and we will see what is possible.",
          "We may cancel an order if an item is unavailable, the branch cannot fulfil it, we cannot reach you, or we suspect misuse. If we cancel an order you have paid for, we refund you in full.",
        ],
      },
      {
        id: "delivery-and-refunds",
        title: "Delivery, returns and refunds",
        paragraphs: [
          "Delivery and pickup are covered in our Delivery Policy. In short: you must give a correct address and be reachable, we deliver as promptly as we can, and we do not accept returns of fresh food, but we will make it right if something is missing, wrong or not as it should be, and we refund orders we cannot fulfil.",
        ],
        link: { label: "Delivery Policy", to: "delivery-policy" },
      },
      {
        id: "allergies",
        title: "Allergies and dietary needs",
        paragraphs: [
          "If you have an allergy or an intolerance, tell the branch before you order, by phone or in the order notes. Our kitchens handle many ingredients, including nuts, dairy, gluten and eggs, so we cannot promise that any dish is free of them.",
        ],
      },
      {
        id: "your-account",
        title: "Your account and your device",
        paragraphs: [
          "An account is optional. If you make one, you sign in with a code we email you, so keep your email account secure and do not share the codes. Guest orders are tied to the device they were placed from: if you clear that device or use a new one, you may not be able to open them again unless you have an account.",
          "You are responsible for what happens under your sign-in, and for giving us information that is true and up to date.",
        ],
      },
      {
        id: "acceptable-use",
        title: "Using the site properly",
        paragraphs: ["Please do not misuse the site. That includes:"],
        bullets: [
          "giving false details, or ordering with a payment method you are not allowed to use;",
          "sending abusive, threatening or unlawful messages to our staff or riders;",
          "trying to break into, overload or interfere with the site or other customers' accounts;",
          "copying or scraping the site.",
        ],
        after: ["We may refuse or cancel orders and block access for anyone who does."],
      },
      {
        id: "our-responsibility",
        title: "Our responsibility",
        paragraphs: [
          "We take care to prepare and deliver your order properly. We are responsible for the food and service we provide to you. We are not responsible for delays or failures caused by things outside our control, such as severe weather, road closures, network or payment-provider outages, or a wrong address.",
          "To the extent the law allows, we are not liable for indirect or consequential losses, and our liability for an order is limited to the amount you paid for it. Nothing in these terms limits any right you have under Nigerian consumer protection law.",
        ],
      },
      {
        id: "ownership",
        title: "Our name and content",
        paragraphs: [`The ${c.name} name, logo, text and images on this site belong to us or are used with permission. Please do not copy or reuse them without asking.`],
      },
      {
        id: "changes-and-law",
        title: "Changes and governing law",
        paragraphs: [
          "We may change these terms from time to time. The date at the top shows when they last changed, and the version in place when you place an order is the one that applies to it.",
          "These terms are governed by the laws of the Federal Republic of Nigeria.",
        ],
      },
      {
        id: "contact",
        title: "Contact",
        paragraphs: [`Questions about these terms? ${reach(c) ? `You can ${reach(c)}.` : "Contact us through the Contact page."}`],
        link: { label: "Contact us", to: "contact" },
      },
    ],
  }
}
