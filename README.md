# Kiros

Multi-branch restaurant ordering: storefront + admin portal + API.

- `server/` — Node/Express/TypeScript API (TypeORM + PostgreSQL, Firebase Auth + Firestore chat, Socket.io, Paystack + bank transfer, Cloudinary, email). See `server/README.md`.
- `client/` — Vite + React storefront (`/:slug`) and admin portal (`/admin`) with Mapbox maps, Firebase sign-in and live updates. See `client/README.md`.
- `docs/DEPLOYMENT.md` — Render free plan + Aiven PostgreSQL + Firebase + Cloudinary + email setup.
- `render.yaml` — Render Blueprint for the API.
- `firebase.json`, `firestore.rules`, `firestore.indexes.json` — Firestore rules and the composite index for order chat.
- `ai_agent_flow_backend.md`, `ai_agent_flow_firebase.md`, `ai_agent_flow_frontend.md` — engineering standards the code follows.
