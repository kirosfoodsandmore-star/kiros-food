// Who gets the notification setup guide, and when. Pure decisions (so they can be tested without a browser) plus the tiny
// bit of storage that remembers how someone answered. The guide itself is components/onboarding/PushGuide.tsx.
import type { PushState } from "@/lib/push"

export type GuidePlatform = "ios" | "android" | "desktop"

/** iPads report themselves as Macs, hence the touch-point check. */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): GuidePlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return "ios"
  if (/Android/i.test(userAgent)) return "android"
  return "desktop"
}

/** Running as an installed app (Home Screen / "Install app") rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return Boolean(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone)
}

/**
 * An iPhone's Safari can't receive web notifications at all until the site is added to the Home Screen, so there the
 * first thing to do is install, not "Allow".
 */
export function needsInstall(platform: GuidePlatform, standalone: boolean, state: PushState): boolean {
  return platform === "ios" && !standalone && state === "unsupported"
}

export type GuideOutcome = "done" | "never" | "later"
export interface GuideRecord {
  outcome: GuideOutcome
  /** How many times they've said "maybe later". */
  laters: number
  /** When they last answered (ms since epoch). */
  at: number
}

/** After "maybe later", wait this long before asking again, and stop asking after this many of them. */
export const LATER_DAYS = 3
export const MAX_LATERS = 2

export interface OfferInput {
  state: PushState
  /** See needsInstall(). */
  install: boolean
  /** They switched notifications off themselves on this device: never turn that into a nag. */
  optedOut: boolean
  record: GuideRecord | null
  now: number
}

/**
 * Should the guide open now? Yes for someone on a device where notifications could work but aren't on, who hasn't
 * finished it, said "don't ask again", or put it off recently. Never when notifications aren't set up for the
 * restaurant, are already on, or the browser simply can't do them.
 */
export function shouldOfferGuide({ state, install, optedOut, record, now }: OfferInput): boolean {
  if (optedOut) return false
  if (state === "on" || state === "unconfigured") return false
  if (state === "unsupported" && !install) return false
  if (!record) return true
  if (record.outcome === "done" || record.outcome === "never") return false
  if (record.laters >= MAX_LATERS) return false
  return now - record.at >= LATER_DAYS * 86_400_000
}

/** What the person can expect to be told about, from what their role can do. Empty = nothing worth a guide. */
export function pushReasons(can: (permission: string) => boolean): string[] {
  const reasons: string[] = []
  if (can("orders.deliver")) reasons.push("A delivery is given to you, or the food you're carrying is ready to collect")
  if (can("orders.update_status") || can("orders.reject") || can("payments.confirm")) reasons.push("A new order has been paid and is waiting for the kitchen")
  if (can("payments.confirm")) reasons.push("A customer says they've paid by bank transfer")
  if (can("chat.view")) reasons.push("A customer sends a message about their order")
  if (can("orders.assign_rider")) reasons.push("A rider hands a delivery back, or doesn't answer in time")
  return reasons
}

/** A rider's guide talks about deliveries; everyone else's about orders. */
export function guideHeadline(can: (permission: string) => boolean): string {
  const handlesOrders = can("orders.update_status") || can("orders.reject") || can("payments.confirm")
  return can("orders.deliver") && !handlesOrders ? "Never miss a delivery" : "Never miss an order"
}

// ── What they answered, remembered per person on this device ────────────────────────────────────────────────────────

const recordKey = (userId: string) => `kiros.push.guide.${userId}`

export function readGuideRecord(userId: string): GuideRecord | null {
  try {
    const raw = localStorage.getItem(recordKey(userId))
    if (!raw) return null
    const r = JSON.parse(raw) as Partial<GuideRecord>
    if ((r.outcome !== "done" && r.outcome !== "never" && r.outcome !== "later") || typeof r.at !== "number") return null
    return { outcome: r.outcome, laters: typeof r.laters === "number" ? r.laters : 0, at: r.at }
  } catch {
    return null
  }
}

export function writeGuideRecord(userId: string, outcome: GuideOutcome, now = Date.now()): void {
  const previous = readGuideRecord(userId)
  const record: GuideRecord = { outcome, laters: outcome === "later" ? (previous?.laters ?? 0) + 1 : (previous?.laters ?? 0), at: now }
  try {
    localStorage.setItem(recordKey(userId), JSON.stringify(record))
  } catch {
    /* private mode: it will just ask again next time */
  }
}

/** The "Show me how" link on the account page asks the guide to open, whatever was answered before. */
export const OPEN_GUIDE_EVENT = "kiros:open-push-guide"
