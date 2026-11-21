// Push notifications on this device through Firebase Cloud Messaging (web push), for staff (new orders, deliveries) and
// for customers (replies from the branch on their order).
//  - enablePush(): asks the browser for permission, subscribes, and gives the token to our server
//  - refreshPush(): when permission was already granted, quietly keeps the server's copy of the token current
//  - disablePush(): forgets this device on the server (and in the browser, unless the other kind still uses it)
// Every function takes the target (staff by default). The service worker that actually shows notifications is
// /push-sw.js (client/public); the browser holds one token that both kinds register with their own server endpoint.
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging"
import { PushEndpoints } from "@/endpoints/admin.endpoints"
import { StoreEndpoints } from "@/endpoints/store.endpoints"
import { firebaseApp, pushConfigured, vapidKey } from "@/lib/firebase"
import { unwrap } from "@/transport/http"

export { pushConfigured }

export type PushTarget = { kind: "staff" } | { kind: "customer"; slug: string }
export const STAFF_PUSH: PushTarget = { kind: "staff" }

// Staff keep the original keys; customers have their own so one choice doesn't affect the other.
const KEYS = {
  staff: { token: "kiros.push.token", off: "kiros.push.off" },
  customer: { token: "kiros.push.customer.token", off: "kiros.push.customer.off" },
} as const

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

const registerOnServer = async (t: PushTarget, token: string) => unwrap(t.kind === "staff" ? await PushEndpoints.register(token) : await StoreEndpoints.pushRegister(t.slug, token))
const unregisterOnServer = (t: PushTarget, token: string) => (t.kind === "staff" ? PushEndpoints.unregister(token) : StoreEndpoints.pushUnregister(t.slug, token))

export async function pushState(target: PushTarget = STAFF_PUSH): Promise<PushState> {
  if (!pushConfigured) return "unconfigured"
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !(await isSupported().catch(() => false))) return "unsupported"
  if (Notification.permission === "denied") return "blocked"
  const k = KEYS[target.kind]
  if (Notification.permission === "granted" && read(k.token) && read(k.off) !== "1") return "on"
  return "off"
}

async function subscribe(target: PushTarget): Promise<void> {
  const registration = await navigator.serviceWorker.register("/push-sw.js")
  await navigator.serviceWorker.ready
  const token = await getToken(getMessaging(firebaseApp()), { vapidKey, serviceWorkerRegistration: registration })
  if (!token) throw new Error("This device couldn't be set up for notifications")
  await registerOnServer(target, token)
  write(KEYS[target.kind].token, token)
}

export async function enablePush(target: PushTarget = STAFF_PUSH): Promise<void> {
  if (!pushConfigured) throw new Error("Notifications aren't set up yet")
  const permission = await Notification.requestPermission()
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them for this site in your browser settings, then try again.")
  write(KEYS[target.kind].off, null)
  await subscribe(target)
}

/** Signed-in and already allowed: re-register (tokens change now and then, and a shared phone may have a new user). */
export async function refreshPush(target: PushTarget = STAFF_PUSH): Promise<void> {
  if (!pushConfigured || typeof Notification === "undefined" || Notification.permission !== "granted" || read(KEYS[target.kind].off) === "1") return
  if (!("serviceWorker" in navigator) || !(await isSupported().catch(() => false))) return
  await subscribe(target).catch(() => undefined)
}

/** `forSignOut`: leave the browser's permission alone and let the next sign-in on this phone switch it on again. */
export async function disablePush(forSignOut = false, target: PushTarget = STAFF_PUSH): Promise<void> {
  const k = KEYS[target.kind]
  const token = read(k.token)
  if (token) await unregisterOnServer(target, token).catch(() => undefined)
  write(k.token, null)
  if (!forSignOut) write(k.off, "1")
  // The browser's token is shared: a customer turning alerts off must not silence staff alerts on the same browser.
  const otherStillUsing = target.kind === "customer" && Boolean(read(KEYS.staff.token))
  if (pushConfigured && !otherStillUsing) await deleteToken(getMessaging(firebaseApp())).catch(() => undefined)
}
