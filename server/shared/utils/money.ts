// Amounts are integers in the minor unit (kobo). Formatting is for emails and CSV only — clients
// format from the restaurant's currency settings themselves.

export function formatMoney(minor: number, symbol = "₦", decimals = 0): string {
  const major = Math.abs(minor) / 100;
  const text = major.toLocaleString("en-NG", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${minor < 0 ? "-" : ""}${symbol}${text}`;
}

/** Percentage discount in whole percent applied to a minor-unit amount, rounded down. */
export function percentOf(amount: number, percent: number): number {
  return Math.floor((amount * percent) / 100);
}
