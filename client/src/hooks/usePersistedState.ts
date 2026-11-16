import { useCallback, useEffect, useRef, useState } from "react"
import { jsonStorage } from "@/lib/storage"

const CHANGED = "kiros:persisted-state"

interface Change {
  key: string
  value: unknown
  /** Which hook instance made the change, so it doesn't react to its own announcement. */
  from: object
}

/**
 * Non-sensitive UI state that survives reloads (tab, filters, view mode).
 * Every component using the same key stays in step: when one changes it, the others update at once. That's what
 * lets the sidebar follow the branch you picked on a page without either one knowing about the other.
 */
export function usePersistedState<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => jsonStorage.get<T>(key, initial))
  const latest = useRef(state)
  latest.current = state
  const self = useRef<object>({})

  const set = useCallback(
    (value: T | ((prev: T) => T)) => {
      const next = typeof value === "function" ? (value as (p: T) => T)(latest.current) : value
      latest.current = next
      setState(next)
      jsonStorage.set(key, next)
      window.dispatchEvent(new CustomEvent<Change>(CHANGED, { detail: { key, value: next, from: self.current } }))
    },
    [key]
  )

  useEffect(() => {
    const onChanged = (e: Event) => {
      const { key: changed, value, from } = (e as CustomEvent<Change>).detail
      if (changed !== key || from === self.current) return
      latest.current = value as T
      setState(value as T)
    }
    window.addEventListener(CHANGED, onChanged)
    return () => window.removeEventListener(CHANGED, onChanged)
  }, [key])

  return [state, set]
}
