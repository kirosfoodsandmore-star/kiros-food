// Theme: the visitor's *preference* is "light", "dark" or "system" (follow the device, live). `theme` is what
// is actually applied, so existing consumers (map style, toasts) keep reading a plain light/dark value.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { usePersistedState } from "@/hooks/usePersistedState"

export type Theme = "light" | "dark"
export type ThemePreference = Theme | "system"

interface ThemeValue {
  /** The theme in effect right now. */
  theme: Theme
  /** What the visitor chose; "system" follows the device. */
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  /** Pin the opposite of the current theme (kept for simple two-state toggles). */
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeValue | null>(null)
const QUERY = "(prefers-color-scheme: dark)"

function systemTheme(): Theme {
  return typeof window !== "undefined" && window.matchMedia?.(QUERY).matches ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Earlier versions stored "light" or "dark" under this key; those remain valid. New visitors follow the device.
  const [stored, setPreference] = usePersistedState<ThemePreference>("kiros.theme", "system")
  const preference: ThemePreference = stored === "light" || stored === "dark" ? stored : "system"
  const [system, setSystem] = useState<Theme>(systemTheme)

  useEffect(() => {
    const mq = window.matchMedia?.(QUERY)
    if (!mq) return
    const onChange = () => setSystem(mq.matches ? "dark" : "light")
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const theme: Theme = preference === "system" ? system : preference
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  const value = useMemo<ThemeValue>(
    () => ({ theme, preference, setPreference, toggle: () => setPreference(theme === "dark" ? "light" : "dark"), setTheme: (t) => setPreference(t) }),
    [theme, preference, setPreference]
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) return { theme: "light", preference: "system", setPreference: () => undefined, toggle: () => undefined, setTheme: () => undefined }
  return ctx
}
