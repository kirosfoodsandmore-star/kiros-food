import { useAuth } from "@/contexts/AuthContext"
import type { CurrencyFormat } from "@/lib/money"

/** The admin portal's currency format (from the restaurant settings in the session). */
export function useAdminCurrency(): CurrencyFormat {
  const { session } = useAuth()
  return { currencySymbol: session?.restaurant.currencySymbol ?? "₦", currencyDecimals: session?.restaurant.currencyDecimals ?? 0 }
}
