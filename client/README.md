# Kiros client

One Vite + React 19 + TypeScript app with two surfaces:

- **Storefront** at `/:slug/…` — home, menu (tabs, grid/list, search, share), item page with option groups and live total, server-side cart drawer with the whole checkout (delivery/pickup, Mapbox address pin, phone, time slots, promo code, Paystack or bank transfer), phone/Google sign-in through Firebase, account, order history with live status and chat.
- **Admin portal** at `/admin/…` — sign-in/register/invites, dashboard, live order board (Socket.io, new-order chime), orders, payments to confirm, chat inbox, menus/categories/items/option groups, availability, branches (hours, Mapbox location, zones, menus, closures), promo codes, customers, reports with CSV export, staff & roles (permission matrix), settings (brand, payments, bank accounts, ownership transfer), audit log, platform view.

## Run

```bash
cp .env.example .env    # VITE_API_URL, VITE_FIREBASE_*, VITE_MAPBOX_TOKEN
npm install
npm run dev             # http://localhost:5173
npm run build           # tsc -b && vite build
npm run lint            # oxlint
```

## Layout

```
src/
 ├── App.tsx · main.tsx · index.css     lazy routes · providers · design tokens (one theme file)
 ├── transport/http.ts                  single Axios client, ApiError, token refresh per surface, uploads, downloads
 ├── endpoints/                         store · auth · admin — typed API functions
 ├── hooks/                             React Query hooks per domain, Firestore chat hook, socket hook, debounce, persisted state
 ├── contexts/                          AuthContext (staff) · CustomerContext · StoreContext · ThemeContext
 ├── stores/storeSession.ts             Zustand: branch, menu, fulfilment, cart token, overlays (persisted)
 ├── components/ui                      Radix-based primitives · shared/ (Mapbox MapView, ConfirmDialog, Pagination…) · store/ · admin/ · layout/
 ├── pages/store · pages/admin          one file per route
 └── types/                             mirror of the backend DTOs
```

Rules followed: components never call the API (endpoints → hooks), React Query owns server state, permissions gate routes and controls via `can(code)`, every page is lazy, every interactive element carries a `data-cy`, no native browser dialogs, amounts are kobo formatted from the restaurant's currency settings.

## Theming

All colours, radii and fonts live in `src/index.css` as CSS variables mapped into Tailwind v4 tokens (light and dark). Change them there to reskin without touching components.
