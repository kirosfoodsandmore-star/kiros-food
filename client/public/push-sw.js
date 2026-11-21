// Service worker for push notifications (Firebase Cloud Messaging, web push). It does nothing else: no caching, no
// offline mode, so it can never serve a stale copy of the app.
//
// The server sends data-only messages: { title, body, url, tag }. We show them ourselves so a tap opens the right
// screen, and stay quiet while the app is open and visible, because the in-app alert (chime + toast) already covers it.

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    return
  }
  // FCM wraps our fields in `data` (or `notification` when a message carries one).
  const m = payload.data || payload.notification || payload
  if (!m.title) return

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      if (windows.some((w) => w.visibilityState === "visible")) return
      await self.registration.showNotification(m.title, {
        body: m.body || "",
        tag: m.tag || undefined,
        renotify: Boolean(m.tag), // same delivery again (e.g. "ready") still buzzes
        icon: m.icon || "/rider-icon.png",
        badge: "/rider-icon.png",
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: { url: m.url || "/" },
      })
    })()
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      // Reuse a window that's already open on this site rather than stacking another.
      for (const w of windows) {
        if ("focus" in w) {
          await w.focus()
          if ("navigate" in w) await w.navigate(target).catch(() => undefined)
          return
        }
      }
      await self.clients.openWindow(target)
    })()
  )
})
