// The period filter of the email log ("last 24 hours", "that day", a range of days). A platform admin means days in their own
// time zone, so the browser works out the exact start and end moments and sends them as timestamps: `from` is inclusive,
// `to` is exclusive (a whole day is midnight to the next midnight). Relative periods ("last 24 hours") are resolved each time
// the list loads, so they keep sliding while the page stays open.

export type PeriodPreset = "1h" | "24h" | "7d" | "30d" | "today" | "yesterday" | "all" | "custom"

export interface Period {
  preset: PeriodPreset
  /** Custom range, as the YYYY-MM-DD a date input gives. Either end may be empty. The "to" day is included. */
  fromDate: string
  toDate: string
}

export const DEFAULT_PERIOD: Period = { preset: "24h", fromDate: "", toDate: "" }

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  "1h": "Last hour",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  today: "Today",
  yesterday: "Yesterday",
  all: "All time",
  custom: "Pick dates…",
}

const HOUR = 3_600_000

/** Local midnight at the start of a YYYY-MM-DD day, or null if the text isn't a real date. */
function startOfDay(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0)
  return Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d
}

const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 0, 0, 0, 0)

/** The exact window to ask the server for. Missing ends are open. */
export function periodWindow(p: Period, now: Date = new Date()): { from?: string; to?: string } {
  const iso = (d: Date) => d.toISOString()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  switch (p.preset) {
    case "1h":
      return { from: iso(new Date(now.getTime() - HOUR)) }
    case "24h":
      return { from: iso(new Date(now.getTime() - 24 * HOUR)) }
    case "7d":
      return { from: iso(new Date(now.getTime() - 7 * 24 * HOUR)) }
    case "30d":
      return { from: iso(new Date(now.getTime() - 30 * 24 * HOUR)) }
    case "today":
      return { from: iso(midnight) }
    case "yesterday":
      return { from: iso(addDays(midnight, -1)), to: iso(midnight) }
    case "custom": {
      const from = startOfDay(p.fromDate)
      const to = startOfDay(p.toDate)
      // The "to" day is included, so the window ends at the start of the day after it.
      const end = to ? addDays(to, 1) : null
      if (from && end && from >= end) return { from: iso(from) } // dates entered the wrong way round: ignore the end
      return { ...(from ? { from: iso(from) } : {}), ...(end ? { to: iso(end) } : {}) }
    }
    default:
      return {}
  }
}

/** A short sentence for under the filters: what is being shown. */
export function describePeriod(p: Period, now: Date = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  switch (p.preset) {
    case "all":
      return "All emails"
    case "today":
      return `Today, ${day(now)}`
    case "yesterday":
      return `Yesterday, ${day(addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -1))}`
    case "custom": {
      const from = startOfDay(p.fromDate)
      const to = startOfDay(p.toDate)
      if (from && to && from.getTime() === to.getTime()) return day(from)
      if (from && to) return from > to ? `From ${day(from)}` : `${day(from)} to ${day(to)}`
      if (from) return `From ${day(from)} onwards`
      if (to) return `Up to the end of ${day(to)}`
      return "All emails (pick a start or end date)"
    }
    default:
      return PERIOD_LABELS[p.preset]
  }
}
