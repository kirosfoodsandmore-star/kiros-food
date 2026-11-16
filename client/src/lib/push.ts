// Push notifications on this device through Firebase Cloud Messaging (web push).
//  - enablePush(): asks the browser for permission, subscribes, and gives the token to our server
//  - refreshPush(): when permission was already granted, quietly keeps the server's copy of the token current
//  - disablePush(): forgets this device on the server and in the browser
// The service worker that actually shows notifications is /push-sw.js (client/public).
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging"
import { PushEndpoints } from "@/endpoints/admin.endpoints"
import { firebaseApp, pushConfigured, vapidKey } from "@/lib/firebase"
import { unwrap } from "@/transport/http"

export { pushConfigured }

const TOKEN_KEY = "kiros.push.token"
/** Set when someone turns notifications off on purpose, so signing in again doesn't quietly turn them back on. */
const OFF_KEY = "kiros.push.off"

export type PushState = "unconfigured" | "unsupported" | "blocked" | "off" | "on"

const read = (k: string): string | null => {
  try { return localStorage.getItem(k) } catch { return null }
}
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch { /* private mode: it just won't be remembered */ }
}

export async function pushState(): Promise<PushState> {
  if (!pushConfigured) return "unconfigured"
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !(await isSupported().catch(() => false))) return "unsupported"
  if (Notification.permission === "denied") return "blocked"
  if (Notification.permission === "granted" && read(TOKEN_KEY) && read(OFF_KEY) !== "1") return "on"
  return "off"
}

async function subscribe(): Promise<void> {
  const registration = await navigator.serviceWorker.register("/push-sw.js")
  await navigator.serviceWorker.ready
  const token = await getToken(getMessaging(firebaseApp()), { vapidKey, serviceWorkerRegistration: registration })
  if (!token) throw new Error("This device couldn't be set up for notifications")
  unwrap(await PushEndpoints.register(token))
  write(TOKEN_KEY, token)
}

export async function enablePush(): Promise<void> {
  if (!pushConfigured) throw new Error("Notifications aren't set up yet")
  const permission = await Notification.requestPermission()
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them for this site in your browser settings, then try again.")
  write(OFF_KEY, null)
  await subscribe()
}

/** Signed-in and already allowed: re-register (tokens change now and then, and a shared phone may have a new user). */
export async function refreshPush(): Promise<void> {
  if (!pushConfigured || typeof Notification === "undefined" || Notification.permission !== "granted" || read(OFF_KEY) === "1") return
  if (!("serviceWorker" in navigator) || !(await isSupported().catch(() => false))) return
  await subscribe().catch(() => undefined)
}

/** `forSignOut`: leave the browser's permission alone and let the next sign-in on this phone switch it on again. */
export async function disablePush(forSignOut = false): Promise<void> {
  const token = read(TOKEN_KEY)
  if (token) await PushEndpoints.unregister(token).catch(() => undefined)
  write(TOKEN_KEY, null)
  if (!forSignOut) write(OFF_KEY, "1")
  if (pushConfigured) await deleteToken(getMessaging(firebaseApp())).catch(() => undefined)
}
