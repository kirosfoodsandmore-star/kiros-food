// Kiros FAQ content, from "KIROS FAQ Content.docx" (the 15 questions on kiros.ng/faq), cleaned up for the
// revamp as that doc asks: typos fixed, "kirosfarm" references replaced with kiros.ng, and the refunds and
// sales-agent questions moved out of Delivery. Meaning and policies are unchanged. Edit the wording here;
// the page renders whatever this exports, including the search index and the FAQPage structured data.

export interface Faq {
  id: string
  q: string
  /** Paragraphs separated by a blank line. */
  a: string
}

export interface FaqCategory {
  id: string
  title: string
  blurb: string
  faqs: Faq[]
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "general",
    title: "General",
    blurb: "What we sell, how to order and how we keep things fresh.",
    faqs: [
      {
        id: "how-to-order",
        q: "How do I order farm fresh vegetables from your store?",
        a: "Browse our items on our website, kiros.ng, and add what you need to your order, or visit our store at 13 Amadi Close, off Odikagbo Lane, Market Road, Rumuomasi, Port Harcourt.\n\nYou can also order by phone on (+234) 704 441 4000 or (+234) 704 441 4002, or by email at info@kiros.ng.",
      },
      {
        id: "what-we-sell",
        q: "What kind of items do you sell?",
        a: "We sell a wide variety of farm fresh vegetables, groceries and other items you need for home-cooked meals.",
      },
      {
        id: "farm-fresh",
        q: "Are your items farm fresh?",
        a: "Yes. We offer farm fresh fruits, vegetables and other food items.",
      },
      {
        id: "frozen",
        q: "Do you sell frozen foods?",
        a: "Yes, we sell a variety of frozen food items. Check what's available, place your order and wait for our swift delivery.",
      },
      {
        id: "storage",
        q: "Do you store and preserve items in your store?",
        a: "We don't store our items for more than 24 hours. During that time, we keep them at a moderate temperature to preserve them.",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments & invoices",
    blurb: "Invoices, card payments and failed transactions.",
    faqs: [
      {
        id: "invoice",
        q: "Can I have an invoice for my items?",
        a: "Yes. We generate and issue an invoice for every order from our store, whether you order online or in person.\n\nWhen shopping in store, please ask any of our attendants to generate and issue an invoice for you.",
      },
      {
        id: "card-failed",
        q: "Why did my debit card payment fail?",
        a: "We can't see the exact reason a card payment fails. Possible causes include a poor internet connection, bad weather or another issue outside our control.\n\nWe advise you to contact your bank, or reach out to our customer care team, for a clearer explanation.",
      },
      {
        id: "failed-transaction",
        q: "How do you resolve issues with a failed transaction?",
        a: "We handle each case on its own merits. Issues are escalated quickly to the right team, and our dedicated administrative team works to resolve them, maintaining 85% customer satisfaction.",
      },
    ],
  },
  {
    id: "delivery",
    title: "Delivery",
    blurb: "Who delivers, when your order arrives and next day delivery.",
    faqs: [
      {
        id: "when-arrive",
        q: "When will my order arrive?",
        a: "Your order arrives on time at the exact location you give us. Please make sure the address and details in your order are correct.",
      },
      {
        id: "not-delivered",
        q: "What should I do if my order hasn't been delivered yet?",
        a: "We work hard to deliver every order promptly. If there's a slight delay, keep track of your order and stay in touch with our team so we can speed up your delivery.",
      },
      {
        id: "next-day",
        q: "How does your Next Day Delivery service work?",
        a: "Next day deliveries go out as soon as we open for the day. We also monitor and track every late-day order so we can deliver to you as soon as possible.",
      },
      {
        id: "who-delivers",
        q: "Who takes care of delivery?",
        a: "Kiros has a dedicated delivery team. Our dispatch riders make sure your orders reach you quickly and accurately.",
      },
      {
        id: "delivery-info",
        q: "How can I find your delivery information?",
        a: "Our contact details are at the bottom of this page — reach out there for quick information about getting your delivery.",
      },
    ],
  },
  {
    id: "returns-support",
    title: "Returns & support",
    blurb: "Our returns policy and how to reach our team.",
    faqs: [
      {
        id: "returns",
        q: "Do you accept returns or refunds?",
        a: "No, we don't have a return policy. We make sure every item is properly stored within our storage time and delivered in good condition.",
      },
      {
        id: "sales-agents",
        q: "How do I contact your sales agents?",
        a: "Call (+234) 704 441 4000 for any questions or enquiries, or use the contact options at the bottom of this page.",
      },
    ],
  },
]
