# Kiros API

Multi-branch restaurant ordering platform: a public storefront (branches, menus, option groups, server-side cart, phone/Google sign-in, Paystack or bank-transfer checkout, live order tracking, order chat) and an admin portal (live order board, payments to confirm, menus, availability, branches, promo codes, customers, reports, staff and roles, audit log). Multi-tenant: every restaurant is an organisation with its own storefront slug.

Built with Node 20+, Express 4, TypeScript (run through `tsx`), TypeORM 0.3 + PostgreSQL, Zod, Firebase Authentication + Firestore, Socket.io, Cloudinary, Nodemailer.

## Run locally

```bash
cp .env.example .env        # fill in DATABASE_URL (or DB_*), optionally Firebase / Cloudinary / email
npm install
npm run migration:run
npm run seed                # demo restaurant "demo-kitchen", owner owner@kiros.test / Password123
npm run dev                 # http://localhost:4000
```

`npm run typecheck` must pass before any change is complete.

Staff sign-in (email and password, or Google) needs Firebase credentials: passwords live only in Firebase Authentication, and Postgres stores just the Firebase uid, never a password or hash. Without the credentials the API answers 503 on sign-in. Order chat needs Firebase too. Customers do not: they can check out as guests, and optionally sign up with an emailed code (no Firebase, no SMS).

## Surfaces

| Prefix | Who | Auth |
|---|---|---|
| `GET /health` | anyone | none |
| `/api/v1/auth/*` | staff | public (sign-in, register, invites, password reset) / staff Bearer token |
| `/api/v1/store/:slug/*` | customers | public browsing + carts (`X-Cart-Token`), customer Bearer token for account, checkout, orders, chat |
| `/api/v1/admin/*` | staff | staff Bearer token + permission guard on every route |
| `/api/v1/platform/*` | platform operators | staff token whose email is in `PLATFORM_ADMIN_EMAILS` |
| `POST /api/v1/webhooks/paystack` | Paystack | `x-paystack-signature` checked with the restaurant's secret key |

Every response uses the same envelope: `{ success, message, statusCode, data, errors, meta? }`.

### Storefront flow

1. `GET /store/:slug` → restaurant profile. `GET /store/:slug/branches?lat&lng` → branches with computed open state and distance.
2. `GET /store/:slug/branches/:branchId/menus`, `GET /store/:slug/menus/:id?branchId=` (full tree with per-branch availability), `GET /store/:slug/menus/:id/version?branchId=` (cheap poll), `GET /store/:slug/items/:id?branchId=`, `GET /store/:slug/search?branchId=&q=`, `GET /store/:slug/featured?branchId=`.
3. `POST /store/:slug/carts` returns the cart and a `token`; send it as `X-Cart-Token` on every cart call. Lines, fulfilment, scheduled time, address, phone and promo code are updated through the cart routes; every response is the repriced cart with line warnings and `blockers`.
4. Customers never have to sign in to order. `POST /store/:slug/auth/guest { name, email? }` starts an anonymous customer session (always a brand-new record, never a lookup by phone or email, so a guest cannot reach anyone else's orders); the contact phone travels with the bag. An account is optional: `POST /store/:slug/auth/email/start { email }` emails a 6-digit code (3 per address per 15 minutes; 5 attempts per code), and `POST /store/:slug/auth/email/verify { email, code, name? }` signs in or creates the account. Send the guest's Bearer token with `verify` and that guest's orders, chats and saved addresses are merged into the account, along with any other guest records that used the same email. Needs `EMAIL_*` configured to deliver codes; in development a code that could not be emailed is returned as `devCode`. Customer sign-in with a Firebase ID token (`POST …/auth/firebase`) still exists for deployments that use it.
5. `GET /store/:slug/branches/:branchId/payment-methods`, then `POST /store/:slug/checkout { cartId, paymentMethod }` → order + either a Paystack `authorizationUrl` or bank-transfer details with a deadline.
6. Paystack return: `POST /store/:slug/orders/:id/payment/verify`. Bank transfer: `POST /store/:slug/orders/:id/transfer-claim` (multipart `receipt` optional).
7. `GET /store/:slug/orders`, `GET /store/:slug/orders/:id`, `POST …/reorder`, `GET/POST …/chat`.
8. `POST /store/:slug/contact { name, email, phone?, message }` — the storefront contact form. Emails the restaurant's own address (Reply-To = the visitor) and answers `503` if the email could not be sent, so the visitor is never told a lost message was delivered. Limited to 5 delivered messages per IP per hour; the hidden `website` field is a bot trap (a filled value is accepted and silently dropped). Needs `EMAIL_*` configured on the server.

Realtime: connect Socket.io with `auth: { customerToken }` (customers) or `auth: { token }` (staff). Chat messages live in the Firestore collection `orderChatMessages` filtered by `conversationId`; clients subscribe with `onSnapshot()` after signing in to Firebase, the server is the only writer.

### Admin portal

Roles are permission bundles (`modules/access/catalog/permissions.catalog.ts`). Presets: Owner (everything), Branch manager, Kitchen staff, Rider. Staff see the branches on their account or all branches. Every route declares a guard from `shared/access/can.ts`; at boot `routeAudit` blocks any route without one.

Order statuses: `pending_payment → awaiting_confirmation (transfer) → paid → accepted → preparing → ready → out_for_delivery → completed`, with `cancelled` and `refunded` as side exits. Transitions are serialised with a row lock and written with a status-history row and an audit entry in the same transaction (`OrderService.transition`).

## Layout

```
server/
 ├── app.ts · server.ts          Express wiring · process entry (HTTP + Socket.io + scheduler)
 ├── config/                     env.ts (the ONLY reader of process.env) · constants.ts
 ├── modules/<domain>/           entities · dto · validators · repositories · services · controllers · routes (+ domain/ for pure logic)
 ├── shared/                     access (can, scope, routeAudit) · middleware · utils (jwt, mailer, mail/*) · services/storage
 ├── infrastructure/             database (dataSource, migrations) · firebase · firestore · mail · payments (Paystack) · realtime · scheduler · storage
 └── scripts/                    migrate.ts · seed.ts
```

Modules: `access` · `audit` · `auth` · `availability` · `branch` · `cart` · `chat` · `customer` · `menu` · `notification` · `order` · `organization` · `payment` · `platform` · `promo` · `report` · `user`.

## Deploying

See `../docs/DEPLOYMENT.md` (Render free plan + Aiven PostgreSQL + Firebase + Cloudinary + Gmail).
