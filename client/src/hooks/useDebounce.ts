import { useEffect, useState } from "react"

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/** Typing waits out the delay, but an emptied box applies at once. */
export function useDebouncedSearch(input: string, delayMs = 300): string {
  const debounced = useDebounce(input, delayMs)
  return input === "" ? "" : debounced
}
