// Resolves the restaurant for the current URL slug and exposes its profile + currency format.
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react"
import { useStoreProfile } from "@/hooks/useStore"
import type { CurrencyFormat } from "@/lib/money"
import { useStoreSession } from "@/stores/storeSession"
import type { StoreProfile } from "@/types/store.types"

interface StoreValue {
  slug: string
  profile: StoreProfile
  fmt: CurrencyFormat
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ slug, profile, children }: { slug: string; profile: StoreProfile; children: ReactNode }) {
  const setSlug = useStoreSession((s) => s.setSlug)
  useEffect(() => setSlug(slug), [slug, setSlug])
  const value = useMemo<StoreValue>(() => ({ slug, profile, fmt: { currencySymbol: profile.currencySymbol, currencyDecimals: profile.currencyDecimals } }), [slug, profile])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used inside StoreProvider")
  return ctx
}

export { useStoreProfile }
