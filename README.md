# Speckboard

Own a speck of the internet — a 500×200 (100,000 pixel) advertising board at **$0.25 per pixel** ($25,000 capacity).

## Stack

- **Client:** Vite + React + TypeScript (`client/`)
- **API:** Express + TypeScript (`server/`)
- **Persistence:** JSON file store at `data/speckboard.json` (no native build tools required)
- **Payments:** Stripe Checkout Sessions (+ webhook); **demo mode** if keys are unset
- **Auth:** Email + password sessions (optional — guest checkout allowed)

## Quick start (Windows / PowerShell)

```powershell
cd c:\Users\Voltr\Downloads\Pixels
copy .env.example .env
npm run install:all
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:3001  

Without Stripe keys, purchases complete in **demo mode** and persist locally so you can test the full flow.

## Environment

Copy `.env.example` → `.env` at the repo root:

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `3001`) |
| `CLIENT_URL` | Frontend origin for CORS + Stripe redirects (`http://localhost:5173`) |
| `SESSION_SECRET` | Express session secret |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_…`) |
| `STRIPE_PUBLISHABLE_KEY` | Publishable key (`pk_test_…`) — exposed via `/api/config` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_…`) |
| `DEMO_CHECKOUT` | Force demo purchases (`true`) even if Stripe keys exist |

### Stripe setup

1. Create a [Stripe test account](https://dashboard.stripe.com/test/apikeys) and paste keys into `.env`.
2. For local webhooks: `stripe listen --forward-to localhost:3001/api/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET`.
3. Success URL also calls `/api/checkout/confirm` so local testing works without a webhook.
4. Restart `npm run dev` after editing `.env`.

## Product behavior

- **Selection tools:** rectangle, square, brush; enable **Mass select** to add multiple regions.
- **Live price:** `$0.25 × selected pixels`.
- **Sold pixels** cannot be selected.
- **Creative required before pay** (title, image URL, link) + ToS checkbox.
- **Guest purchase:** creative locked forever after buy.
- **Signed-in purchase:** attached to account → editable in **Dashboard**; can buy more.
- Legal pages: Terms, Privacy, Acceptable Use, DMCA (footer links).

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run install:all` | Install root + client + server deps |
| `npm run dev` | Run API + Vite together |
| `npm run build` | Build client + compile server |
| `npm run start` | Run compiled server (serves `client/dist` in production) |

## Key files

- `client/src/components/PixelBoard.tsx` — interactive canvas board
- `client/src/pages/HomePage.tsx` — hero + selection + checkout
- `client/src/components/CheckoutModal.tsx` — creative + ToS + Stripe/demo pay
- `server/src/api.ts` — board, checkout, ads, Stripe session
- `server/src/auth.ts` — register / login / session
- `server/src/db.ts` — JSON persistence + grid constants
- `brand/` — Speckboard marks (copied to `client/public/brand/`)

## Optional demo seed

With the API running:

```powershell
Invoke-RestMethod -Method Post http://localhost:3001/api/demo/seed
```

## Production notes

**Fastest public go-live:** one Docker web service on [Render](https://render.com) or [Railway](https://railway.app) (see `Dockerfile`, `render.yaml`, `railway.toml`). Cursor Share / Origin only backs up the repo — it does **not** give a public website.

1. Push this repo to GitHub (init git if needed).
2. Create a Web Service from the repo (Render Blueprint `render.yaml`, or Railway with the Dockerfile).
3. Attach a **persistent disk/volume at `/data`** and set `DATA_DIR=/data` (JSON store is wiped on every redeploy without this).
4. Set env vars (no secrets in git):

| Variable | Production value |
|----------|------------------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` (or host-provided) |
| `CLIENT_URL` | Public HTTPS URL of this same service |
| `SESSION_SECRET` | Long random string |
| `DATA_DIR` | `/data` |
| `STRIPE_SECRET_KEY` | `sk_live_…` (or `sk_test_…` to start) |
| `STRIPE_PUBLISHABLE_KEY` | Matching `pk_…` |
| `STRIPE_WEBHOOK_SECRET` | From Stripe webhook endpoint |

5. In Stripe Dashboard → Webhooks: endpoint `https://YOUR_HOST/api/stripe/webhook`, event `checkout.session.completed`. Paste signing secret into `STRIPE_WEBHOOK_SECRET`.
6. After deploy, set `CLIENT_URL` to the real HTTPS URL and redeploy once if needed.

Also: replace legal-page placeholders; plan a real DB when you outgrow the JSON file.
