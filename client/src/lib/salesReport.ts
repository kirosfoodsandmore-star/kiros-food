// Helpers for the Sales reports page: date presets, the online / counter source filter, and turning daily rows into
// chart buckets (days for short ranges, weeks, then months).
import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns"
import type { Granularity } from "@/types/finance.types"

export type SalesPreset = "today" | "7d" | "30d" | "month" | "lastmonth" | "90d" | "year" | "custom"
export const SALES_PRESETS: Array<[SalesPreset, string]> = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["month", "This month"], ["lastmonth", "Last month"], ["90d", "90 days"], ["year", "This year"], ["custom", "Custom"]]

const iso = (d: Date) => format(d, "yyyy-MM-dd")

export function salesPresetRange(p: SalesPreset, custom: { from: string; to: string }): { from?: string; to?: string } {
  const today = new Date()
  switch (p) {
    case "today": return { from: iso(today), to: iso(today) }
    case "7d": return { from: iso(addDays(today, -6)), to: iso(today) }
    case "30d": return { from: iso(addDays(today, -29)), to: iso(today) }
    case "90d": return { from: iso(addDays(today, -89)), to: iso(today) }
    case "month": return { from: iso(startOfMonth(today)), to: iso(today) }
    case "lastmonth": { const m = subMonths(today, 1); return { from: iso(startOfMonth(m)), to: iso(endOfMonth(m)) } }
    case "year": return { from: `${today.getFullYear()}-01-01`, to: iso(today) }
    default: return { from: custom.from || undefined, to: custom.to || undefined }
  }
}

/** Which sales a view shows: everything, online orders only, or counter sales only. */
export type SalesSource = "all" | "online" | "counter"
export const SALES_SOURCES: Array<[SalesSource, string]> = [["all", "All sales"], ["online", "Online orders"], ["counter", "Counter sales"]]

export function revenueOf(x: { onlineRevenue: number; counterRevenue: number }, source: SalesSource): number {
  return source === "online" ? x.onlineRevenue : source === "counter" ? x.counterRevenue : x.onlineRevenue + x.counterRevenue
}

export function granularityFor(from: string, to: string): Granularity {
  const n = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1
  return n <= 45 ? "day" : n <= 190 ? "week" : "month"
}

const startOf = (d: Date, g: Granularity) => (g === "day" ? d : g === "week" ? startOfWeek(d, { weekStartsOn: 1 }) : startOfMonth(d))
const next = (d: Date, g: Granularity) => (g === "day" ? addDays(d, 1) : g === "week" ? addDays(d, 7) : addMonths(d, 1))

/** Sums daily figures into chart buckets, including the empty ones so gaps show as gaps. */
export function bucketDays(from: string, to: string, days: Array<{ key: string; online: number; counter: number }>) {
  const granularity = granularityFor(from, to)
  const end = parseISO(to)
  const buckets: string[] = []
  for (let b = startOf(parseISO(from), granularity); b <= end && buckets.length < 800; b = next(b, granularity)) buckets.push(iso(b))
  const at = new Map(buckets.map((b, i) => [b, i]))
  const online = buckets.map(() => 0)
  const counter = buckets.map(() => 0)
  for (const d of days) {
    const i = at.get(iso(startOf(parseISO(d.key), granularity)))
    if (i === undefined) continue
    online[i] += d.online
    counter[i] += d.counter
  }
  return { granularity, buckets, online, counter }
}
