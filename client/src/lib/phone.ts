// Phone numbers for the country-code picker (components/ui/phone-input.tsx). The API always stores the
// international format ("+2348012345678"); these helpers split that into a country plus a local number to show,
// and join them back, so nobody has to type "+234" or remember to drop the leading 0.

export interface Country {
  /** ISO 3166 code ("NG"), or "OTHER" for a country that isn't listed (the number is typed in full). */
  iso: string
  name: string
  /** Calling code without the "+", or "" for "OTHER". */
  dial: string
}

/** Nigeria first (the default), then West/Central Africa, the rest of Africa and the usual diaspora destinations. */
export const COUNTRIES: Country[] = [
  { iso: "NG", name: "Nigeria", dial: "234" },
  { iso: "GH", name: "Ghana", dial: "233" },
  { iso: "BJ", name: "Benin", dial: "229" },
  { iso: "TG", name: "Togo", dial: "228" },
  { iso: "CI", name: "Côte d'Ivoire", dial: "225" },
  { iso: "SN", name: "Senegal", dial: "221" },
  { iso: "NE", name: "Niger", dial: "227" },
  { iso: "CM", name: "Cameroon", dial: "237" },
  { iso: "KE", name: "Kenya", dial: "254" },
  { iso: "UG", name: "Uganda", dial: "256" },
  { iso: "TZ", name: "Tanzania", dial: "255" },
  { iso: "RW", name: "Rwanda", dial: "250" },
  { iso: "ZA", name: "South Africa", dial: "27" },
  { iso: "EG", name: "Egypt", dial: "20" },
  { iso: "AE", name: "United Arab Emirates", dial: "971" },
  { iso: "GB", name: "United Kingdom", dial: "44" },
  { iso: "IE", name: "Ireland", dial: "353" },
  { iso: "DE", name: "Germany", dial: "49" },
  { iso: "FR", name: "France", dial: "33" },
  { iso: "US", name: "United States", dial: "1" },
  { iso: "CA", name: "Canada", dial: "1" },
  { iso: "OTHER", name: "Other country", dial: "" },
]

const DEFAULT_ISO = "NG"
const OTHER = COUNTRIES[COUNTRIES.length - 1]
/** Longest calling code first, so "+234…" is never mistaken for a shorter code. First listed wins for shared codes (+1). */
const BY_DIAL_LONGEST_FIRST = COUNTRIES.filter((c) => c.dial).sort((a, b) => b.dial.length - a.dial.length)

/** True for a complete international number such as "+2347044414000" (what PhoneInput hands back when it is filled in). */
export function isE164(value: string): boolean {
  return value.length >= 8 && value.length <= 16 && value[0] === "+" && value[1] !== "0" && value.slice(1).split("").every((c) => c >= "0" && c <= "9")
}

export function countryByIso(iso: string): Country {
  return COUNTRIES.find((c) => c.iso === iso) ?? OTHER
}

/** Light grouping so a stored number reads naturally in the box ("801 234 5678"); it round-trips through toE164. */
function group(digits: string): string {
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ")
}

/**
 * Splits what we hold or what was pasted into a country and a local number. International input ("+…" or "00…")
 * picks its country from the calling code; anything else is treated as a local number in the default country.
 * An empty value gives the default country and an empty box.
 */
export function parsePhone(value: string): { iso: string; national: string } {
  const raw = (value ?? "").trim()
  if (!raw) return { iso: DEFAULT_ISO, national: "" }
  const international = raw.startsWith("+") ? raw.replace(/\D/g, "") : raw.startsWith("00") ? raw.replace(/\D/g, "").slice(2) : null
  if (international === null) return { iso: DEFAULT_ISO, national: raw }
  const match = BY_DIAL_LONGEST_FIRST.find((c) => international.startsWith(c.dial))
  if (!match) return { iso: OTHER.iso, national: group(international) }
  return { iso: match.iso, national: group(international.slice(match.dial.length)) }
}

/**
 * Joins a country and a local number into the international format the API expects, or "" when the number
 * box is empty. Leading zeros (the local "0" trunk prefix) are dropped; for "OTHER" the box holds the full
 * number including its calling code.
 */
export function toE164(iso: string, national: string): string {
  const digits = (national ?? "").replace(/\D/g, "")
  if (!digits) return ""
  const country = countryByIso(iso)
  if (!country.dial) return `+${digits}`
  return `+${country.dial}${digits.replace(/^0+/, "")}`
}
