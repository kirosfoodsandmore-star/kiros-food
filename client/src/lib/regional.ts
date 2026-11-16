// Currency and timezone lists for the Settings pickers. Names, symbols and UTC offsets come from the browser's own
// Intl data, so there is no table to keep in sync by hand.

/** Shown first, African markets ahead of the big international ones. Every other currency follows under "All". */
const COMMON_CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "XOF", "XAF", "EGP", "MAD", "TZS", "UGX", "RWF", "ETB", "ZMW", "USD", "GBP", "EUR", "CAD", "AUD", "AED", "SAR", "INR", "CNY", "JPY", "BRL"]

const displayNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" })
  } catch {
    return null
  }
})()

export const currencyName = (code: string): string => displayNames?.of(code) ?? code

/** The short symbol people write next to a price: ₦, $, GH₵, KSh, R. */
export function currencySymbolFor(code: string): string {
  try {
    const parts = new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0)
    return parts.find((p) => p.type === "currency")?.value ?? code
  } catch {
    return code
  }
}

export interface CurrencyGroup {
  label: string
  codes: string[]
}

let allCurrencies: string[] | null = null
function everyCurrency(): string[] {
  if (!allCurrencies) {
    let codes: string[] = []
    try {
      codes = Intl.supportedValuesOf("currency")
    } catch {
      codes = []
    }
    allCurrencies = codes.filter((c) => !COMMON_CURRENCIES.includes(c)).sort((a, b) => currencyName(a).localeCompare(currencyName(b)))
  }
  return allCurrencies
}

/** `current` is always offered, even if this browser does not know it, so opening Settings never changes it silently. */
export function currencyGroups(current: string): CurrencyGroup[] {
  const known = COMMON_CURRENCIES.includes(current) || everyCurrency().includes(current)
  const groups: CurrencyGroup[] = [{ label: "Common", codes: known || !current ? COMMON_CURRENCIES : [current, ...COMMON_CURRENCIES] }]
  const rest = everyCurrency()
  if (rest.length > 0) groups.push({ label: "All currencies", codes: rest })
  return groups
}

export interface TimezoneOption {
  id: string
  /** City and current UTC offset, e.g. "Lagos (GMT+1)". The region is the group heading. */
  label: string
}
export interface TimezoneGroup {
  region: string
  zones: TimezoneOption[]
}

const FALLBACK_ZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "Africa/Cairo", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Kolkata", "Asia/Shanghai", "Australia/Sydney"]

/** Current UTC offset of a zone, e.g. "GMT+1" or "GMT+5:30"; empty when the browser cannot say. */
export function timezoneOffset(id: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone: id, timeZoneName: "shortOffset" }).formatToParts(new Date())
    return parts.find((p) => p.type === "timeZoneName")?.value ?? ""
  } catch {
    return ""
  }
}

let zoneGroups: TimezoneGroup[] | null = null
function allZoneGroups(): TimezoneGroup[] {
  if (zoneGroups) return zoneGroups
  let ids: string[]
  try {
    ids = Intl.supportedValuesOf("timeZone")
  } catch {
    ids = FALLBACK_ZONES
  }
  if (!ids.includes("UTC")) ids = [...ids, "UTC"]
  const byRegion = new Map<string, TimezoneOption[]>()
  for (const id of [...ids].sort()) {
    const slash = id.indexOf("/")
    const region = slash > 0 ? id.slice(0, slash) : "Other"
    const city = (slash > 0 ? id.slice(slash + 1) : id).replace(/_/g, " ")
    const offset = timezoneOffset(id)
    byRegion.set(region, [...(byRegion.get(region) ?? []), { id, label: offset ? `${city} (${offset})` : city }])
  }
  // Africa first (that is where these restaurants are), then the rest alphabetically.
  const order = (r: string) => (r === "Africa" ? 0 : r === "Other" ? 2 : 1)
  zoneGroups = [...byRegion.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0])).map(([region, zones]) => ({ region, zones }))
  return zoneGroups
}

/** `current` is always offered, even if this browser does not list it. */
export function timezoneGroups(current: string): TimezoneGroup[] {
  const groups = allZoneGroups()
  if (!current || groups.some((g) => g.zones.some((z) => z.id === current))) return groups
  return [{ region: "Current", zones: [{ id: current, label: current }] }, ...groups]
}
