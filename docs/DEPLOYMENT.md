# Deploying Kiros (Render free plan + Aiven PostgreSQL)

Follow the sections in order. Everything marked **[CONSOLE]** is a one-time click in a web console; the rest is config.

## 1. Aiven PostgreSQL (database)

1. **[CONSOLE]** aiven.io → Create service → PostgreSQL → Free plan → region close to Render's `frankfurt` (e.g. `aws-eu-central-1`). Name it `kiros-pg`.
2. Wait until the service is **Running**, open **Overview → Connection information** and copy the **Service URI** (`postgres://avnadmin:…@…aivencloud.com:PORT/defaultdb?sslmode=require`).
3. The API keeps a small pool (`DB_POOL_MAX=5`) because the free plan allows about 20 connections in total; one Render instance plus your local dev server fit comfortably.
4. Run the migrations once from your machine to check the connection:

```bash
cd server
DATABASE_URL="<service uri>" DB_SSL=true npm run migration:run
DATABASE_URL="<service uri>" DB_SSL=true npm run seed   # optional demo data
```

`DB_SSL=true` makes the API use TLS without a CA bundle (`rejectUnauthorized: false`), which is what Aiven's `sslmode=require` means.

## 2. Firebase (authentication + chat)

1. **[CONSOLE]** console.firebase.google.com → Add project (or reuse one). Note the project id.
2. **[CONSOLE]** Build → Authentication → **Get started**, then Sign-in method → enable **Email/Password**, **Google** and **Phone**. (Phone Auth sends the SMS one-time codes for customers; add test phone numbers under *Phone numbers for testing* while developing.)
3. **[CONSOLE]** Project settings → General → Your apps → **Add app → Web**. Copy `apiKey`, `authDomain`, `projectId` — these go into the two frontends and `FIREBASE_API_KEY` on the server.
4. **[CONSOLE]** Project settings → Service accounts → **Generate new private key**. From the JSON take `project_id`, `client_email`, `private_key` → `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (paste the key with its literal `\n` line breaks; the server unescapes them). Never commit the JSON.
5. **[CONSOLE]** Build → Firestore Database → Create database → production mode → same region as the project.
6. Deploy the rules and the composite index from the repo root:

```bash
npm i -g firebase-tools
firebase login
# edit .firebaserc and replace <FIREBASE_PROJECT_ID>
firebase deploy --only firestore:rules,firestore:indexes
```

The rules allow signed-in users to read `orderChatMessages` and nobody to write; the server writes through the Admin SDK. Run `firebase projects:list` first if the deploy says the project is not found: the CLI may be logged in to another Google account.

## 3. Cloudinary (photos, logos, transfer receipts)

**[CONSOLE]** cloudinary.com → Dashboard → copy the **API environment variable** (`cloudinary://API_KEY:API_SECRET@CLOUD_NAME`) into `CLOUDINARY_URL`. Uploads land in `kiros/items`, `kiros/branding`, `kiros/categories`, `kiros/transfer-receipts`.

## 4. Email

- **Gmail (default):** Google Account → Security → 2-Step Verification → App passwords → create one for "Kiros". Set `EMAIL_USER` to the Gmail address and `EMAIL_PASSWORD` to the app password. `EMAIL_FROM` is optional.
- **Google Apps Script relay:** set `EMAIL_PROVIDER=script` and `EMAIL_SCRIPT_URL` to a deployed web app (access: *Anyone*) whose `doPost` reads `{ to, subject, htmlBody, body, fromName, replyTo, attachments[] }` and calls `MailApp.sendEmail`. If the relay fails and Gmail credentials are also set, the server falls back to SMTP.

Emails sent: restaurant welcome, staff invite (48-hour link), password reset code, password changed, account deactivated, order received, bank-transfer instructions, order status updates, payment rejected, and new-order alerts to branch staff (`orders.view`) when the restaurant has that setting on.

## 5. Render (API)

1. Push the repo to GitHub.
2. **[CONSOLE]** render.com → New → **Blueprint** → select the repo. Render reads `render.yaml` (service `kiros-api`, plan free, root `server`, start command `npm run migration:run && npm start`, health check `/health`).
3. Fill in the prompted variables:

| Variable | Value |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | from the Aiven service in §1 (same names as `server/.env`). Alternatively set the single `DATABASE_URL` (the service URI); it takes priority |
| `APP_URL` | the Render URL, e.g. `https://kiros-api.onrender.com`. It must be public: emails load the Kiros Farmshop logo from `APP_URL/brand/`, and mail apps cannot fetch images from localhost |
| `STOREFRONT_URL` | the web app's address, e.g. `https://kiros.vercel.app`. It is the only URL to set: the admin portal is the same site under `/admin`, so staff-invite and new-order emails link to `STOREFRONT_URL/admin/…`. Also used for the Paystack return URL |
| `CORS_ORIGINS` | the same address (comma-separated if the web app is also served from another domain). In production the API accepts browser requests only from `CORS_ORIGINS` and `STOREFRONT_URL` |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_API_KEY` | from §2 |
| `CLOUDINARY_URL` | from §3 |
| `EMAIL_PROVIDER` (`script` or `nodemailer`), `EMAIL_SCRIPT_URL`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | from §4. Use `script` (the Apps Script relay) if Render blocks Gmail SMTP on your plan; `EMAIL_USER`/`EMAIL_PASSWORD` then act only as a fallback |

`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `APP_ENCRYPTION_KEY` are generated by Render. `PLATFORM_ADMIN_EMAILS` is preset to `edoghotugiddy@gmail.com,caroline@gmail.com`; those people must also hold a normal staff account with the same email to open the platform view.

4. Deploy. The first start runs the migration, then boots. Check `https://<service>/health`.
5. Free-plan notes: the instance sleeps after 15 minutes without traffic and the first request afterwards takes 30–60 s. Socket.io works on Render (long-running process). Migrations run on every start because free services have no pre-deploy hook.

## 6. Paystack (per restaurant, inside the admin portal)

Each restaurant's Owner opens **Settings → Payments** and enters the Paystack public and secret key plus test/live mode; the secret is encrypted with `APP_ENCRYPTION_KEY` and never returned. "Test connection" calls Paystack with that key.

**[CONSOLE]** In the Paystack dashboard set the webhook URL to `https://<render service>/api/v1/webhooks/paystack` (test and live). The server verifies `x-paystack-signature` with the restaurant's own secret key (looked up by the transaction reference) and marks the order paid exactly once, even if the webhook is delivered twice and the customer also returns through the verify endpoint.

## 7. First restaurant

Either `POST /api/v1/auth/register` from the admin sign-up page, or run `npm run seed` against the production database for the demo restaurant. Sign-up is open only while the database has no restaurant: once the first one exists the page and endpoint close (the admin login hides its "Create a restaurant" link), so strangers can't add another restaurant to your database. Set `ALLOW_SIGNUP=true` only if you deliberately host several restaurants on one deployment. Then, in the admin portal: add branches and opening hours, menus and items, enable at least one payment method, and the storefront at `/store/<slug>` is live.

## 8. Frontend on Vercel

The repo ships Vercel config for both ways of pointing a project at it:

- **Root Directory = repo root** (default when you import the repo): the root `vercel.json` installs and builds inside `client/` and serves `client/dist`. `.vercelignore` keeps the server out of the upload.
- **Root Directory = `client`** (Project → Settings → General → Root Directory): `client/vercel.json` applies instead.

Both set the SPA rewrite (every path → `index.html`) so `/<slug>/menu` and `/admin/orders/…` load on refresh, long-lived caching for hashed assets, and basic security headers.

Steps:

1. **[CONSOLE]** vercel.com → Add New → Project → import the GitHub repo. Framework is detected as Vite; leave the commands as the config provides them.
2. Add the environment variables below under Settings → Environment Variables (Production and Preview), then redeploy.
3. Copy the production URL (e.g. `https://kiros.vercel.app`) into the API's `STOREFRONT_URL` and `CORS_ORIGINS` on Render (no trailing slash). Vercel preview deployments (`*.vercel.app`) are not allowed by the API in production; add a preview's exact address to `CORS_ORIGINS` if you want to test against it.
4. **[CONSOLE]** Firebase → Authentication → Settings → Authorized domains → add the Vercel domain (and any custom domain) so Google and phone sign-in work.
5. **[CONSOLE]** Mapbox → Access tokens → restrict the public token's allowed URLs to the Vercel domain.

Alternatively from the CLI: `npm i -g vercel`, then `vercel` in the repo root (first run links the project), `vercel env add VITE_API_URL production` for each variable, and `vercel --prod` to deploy.

Environment variables:

| Variable | Value |
|---|---|
| `VITE_API_URL` | the Render API URL |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` | from the Firebase web app in §2 |
| `VITE_MAPBOX_TOKEN` | a public Mapbox token (`pk.…`) from account.mapbox.com; restrict it to your domains |
| `VITE_DEFAULT_STORE_SLUG` | optional: the restaurant `/` should redirect to |

The storefront and admin share one origin: `/<slug>` and `/admin`. Netlify, Cloudflare Pages or a Render static site work the same way: build `npm run build` in `client/`, publish `dist`, and rewrite all paths to `index.html`.

## 9. Local development

```bash
cd server && cp .env.example .env
# DATABASE_URL to a local Postgres (or the Aiven URI with DB_SSL=true)
npm install && npm run migration:run && npm run seed && npm run dev
```

Without Firebase credentials: nobody can sign in to the admin (passwords live only in Firebase) and order chat is unavailable (customers can still check out as guests and sign up by email). For Google sign-in, enable the Google provider in Firebase → Authentication → Sign-in method, and add every domain the app is served from under Authentication → Settings → Authorized domains. Without Cloudinary: uploads answer 503. Without email settings: emails are logged and skipped.
