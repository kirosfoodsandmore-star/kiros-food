// "Install the app" (PWA). Chrome, Edge and Android browsers that can install the site fire `beforeinstallprompt` once,
// about a second after load. index.html catches it in a tiny inline script (the app's JavaScript may not be ready yet)
// and parks it on window.__installPrompt; it is picked up here, and later events are caught directly.
// Only iPhone/iPad Safari has no such event (Apple offers no install API), so only there does the UI show written steps.
import { useSyncExternalStore } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

declare global {
  interface Window {
    /** Set by the inline script in index.html when the browser offered install before this module loaded. */
    __installPrompt?: Event
  }
}

export interface InstallState {
  /** Already running as an installed app (or just installed), so there is nothing to offer. */
  installed: boolean
  /** The browser has handed us its native install prompt. */
  canPrompt: boolean
}

const isBrowser = typeof window !== "undefined"

function runningInstalled(): boolean {
  if (!isBrowser) return false
  return window.matchMedia?.("(display-mode: standalone)").matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

let deferred: BeforeInstallPromptEvent | null = isBrowser ? ((window.__installPrompt as BeforeInstallPromptEvent | undefined) ?? null) : null
let state: InstallState = { installed: runningInstalled(), canPrompt: deferred !== null }
const listeners = new Set<() => void>()

function update(next: Partial<InstallState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

if (isBrowser) {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault() // keep it for our own button instead of the browser's mini-infobar
    deferred = e as BeforeInstallPromptEvent
    update({ canPrompt: true })
  })
  window.addEventListener("appinstalled", () => {
    deferred = null
    update({ installed: true, canPrompt: false })
  })
}

/** iPhone and iPad can't be asked to install a site: the person has to use Safari's Share menu. */
export function isIos(): boolean {
  if (!isBrowser) return false
  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as a Mac, but has a touch screen.
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

/** Shows the browser's own install dialog. Resolves to what the person chose, or null when there is no prompt to show. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  if (!deferred) return null
  const event = deferred
  deferred = null // the event can only be used once
  update({ canPrompt: false })
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useInstallApp(): InstallState & { install: typeof promptInstall; ios: boolean } {
  const s = useSyncExternalStore(subscribe, () => state, () => state)
  return { ...s, install: promptInstall, ios: isIos() }
}
