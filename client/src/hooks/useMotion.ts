// Motion helpers for the storefront showcase. All of them degrade to "show the final state" when the
// user prefers reduced motion or the browser lacks IntersectionObserver, so content never stays hidden.
import { useEffect, useRef, useState, type RefObject } from "react"

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return reduced
}

/**
 * Marks the element with `data-revealed` the first time it scrolls into view. Pair with the `.reveal`
 * class on the element or its children (stagger children with `style={{ "--i": n }}`).
 */
export function useReveal<T extends HTMLElement = HTMLElement>(threshold = 0.15): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || revealed) return
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true)
          io.disconnect()
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [revealed, threshold])
  useEffect(() => {
    if (revealed) ref.current?.setAttribute("data-revealed", "")
  }, [revealed])
  return [ref, revealed]
}

/** Counts from 0 to `target` (ease-out) once `start` is true. */
export function useCountUp(target: number, start: boolean, durationMs = 1400): number {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start) return
    if (reduced || target <= 0) {
      setValue(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, start, durationMs, reduced])
  return value
}

/** Calls `fn` every `ms` while enabled (used for gentle auto-cycling showcases). */
export function useInterval(fn: () => void, ms: number, enabled = true): void {
  const saved = useRef(fn)
  saved.current = fn
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") saved.current()
    }, ms)
    return () => window.clearInterval(id)
  }, [ms, enabled])
}

/** Pointer handler that writes the cursor position into --mx/--my (px) on the hovered element. No re-renders. */
export function trackPointer(e: React.PointerEvent<HTMLElement>): void {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty("--mx", `${e.clientX - r.left}px`)
  el.style.setProperty("--my", `${e.clientY - r.top}px`)
}

/** True once the page has scrolled more than `threshold` px (used to add a shadow under sticky headers). */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [threshold])
  return scrolled
}
