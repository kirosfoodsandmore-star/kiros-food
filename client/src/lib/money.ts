// Amounts travel as integers in the minor unit (kobo). Format from the restaurant's currency settings.
export interface CurrencyFormat {
  currencySymbol: string
  currencyDecimals: number
}

const DEFAULT: CurrencyFormat = { currencySymbol: "₦", currencyDecimals: 0 }

export function formatMoney(minor: number, fmt: CurrencyFormat = DEFAULT): string {
  const major = minor / 100
  return `${fmt.currencySymbol}${major.toLocaleString("en-NG", { minimumFractionDigits: fmt.currencyDecimals, maximumFractionDigits: fmt.currencyDecimals })}`
}

/** Form input: naira string → kobo integer. */
export function toMinor(major: string | number): number {
  const n = typeof major === "number" ? major : Number.parseFloat(major.replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export function toMajor(minor: number): string {
  return (minor / 100).toString()
}
