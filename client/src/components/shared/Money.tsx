import { formatMoney, type CurrencyFormat } from "@/lib/money"

/** Formats kobo with the restaurant's currency. Pass `fmt` from the store/restaurant profile. */
export function Money({ value, fmt, className }: { value: number; fmt?: CurrencyFormat | null; className?: string }) {
  return (
    <span className={className} data-cy="money">
      {formatMoney(value, fmt ?? undefined)}
    </span>
  )
}
