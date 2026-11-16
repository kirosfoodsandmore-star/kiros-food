// BrowserRouter keeps the window's scroll position across navigations, so a link clicked in the footer
// opened the next page still scrolled to the bottom (it looked like the link did nothing). Scroll to the
// top on every forward navigation — including a link to the page you're already on — but leave
// back/forward (POP) to the browser and let #hash links scroll to their target.
import { useLayoutEffect } from "react"
import { useLocation, useNavigationType } from "react-router-dom"

export function ScrollToTop() {
  const { key, hash } = useLocation()
  const type = useNavigationType()
  useLayoutEffect(() => {
    if (type === "POP" || hash) return
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [key, hash, type])
  return null
}
