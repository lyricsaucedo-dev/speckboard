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
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_…`) — must not contain `...` |
| `STRIPE_PUBLISHABLE_KEY` | Publishable key (`pk_test_…`) — exposed via `/api/config` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_…`) |
| `DEMO_CHECKOUT` | Force demo purchases (`true`) even if Stripe keys exist |

### Stripe test mode (start here)

1. Open [Stripe test API keys](https://dashboard.stripe.com/test/apikeys) (Test mode toggle **ON**), **or** run `stripe sandbox create --from-git` for a temporary claimable sandbox (`sk_test_…` / `rkcs_test_…` + `pk_test_…`).
2. Paste secret + publishable keys into `.env` (replace any `REPLACE_ME` / `...` placeholders). Restricted sandbox secrets (`rkcs_test_…`) are supported.
3. Leave `DEMO_CHECKOUT` unset (or `false`).
4. Local webhook (optional but recommended):
   ```powershell
   stripe listen --forward-to localhost:3001/api/stripe/webhook
   ```
   Copy the CLI `whsec_…` into `STRIPE_WEBHOOK_SECRET` (or use `stripe listen --print-secret`).
5. Restart `npm run dev`. Check `GET /api/config` → `demoCheckout: false`.
6. On `/buy`, complete a purchase — CTA should say **Pay with Stripe**. Use test card `4242 4242 4242 4242`.
7. Success URL also calls `/api/checkout/confirm`, so local testing works even without `stripe listen`.
8. If you used `stripe sandbox create`, **claim** the sandbox before it expires (`stripe sandbox claim` or the claim URL printed by the CLI) so keys stay yours.

### Stripe on Render (test keys first)

1. In the Render service → Environment, set:
   - `STRIPE_SECRET_KEY` = `sk_test_…`
   - `STRIPE_PUBLISHABLE_KEY` = `pk_test_…`
   - `CLIENT_URL` = `https://YOUR_HOST` (same public URL as the service)
   - `STRIPE_WEBHOOK_SECRET` = from step 2 (after webhook exists)
2. Stripe Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://YOUR_HOST/api/stripe/webhook`
   - Event: `checkout.session.completed`
   - Paste the endpoint signing secret into Render `STRIPE_WEBHOOK_SECRET`
3. Redeploy / restart. Buy a speck with a test card on the live site.
4. When ready for real charges, swap to `sk_live_` / `pk_live_` and a live-mode webhook secret (same endpoint URL).

Do **not** commit `.env` or live secrets.

## Product behavior

- **Selection tools:** rectangle, square, brush; enable **Mass select** to add multiple regions.
- **Live price:** `$0.25 × selected pixels`.
- **Sold pixels** cannot be selected.
- **Creative required before pay** (title + image URL) + ToS checkbox. Destination link is optional at $5+ (20 px).
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

Pop Cat (`Dont tell my dad i used his card`, 20×20) is **auto-seeded on server start** if missing — including production / Render. You can also force it:

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
| `STRIPE_SECRET_KEY` | `sk_test_…` first; later `sk_live_…` |
| `STRIPE_PUBLISHABLE_KEY` | Matching `pk_test_…` / `pk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | From Stripe webhook endpoint (test or live mode) |

5. In Stripe Dashboard → Webhooks: endpoint `https://YOUR_HOST/api/stripe/webhook`, event `checkout.session.completed`. Paste signing secret into `STRIPE_WEBHOOK_SECRET`. Use **test mode** webhook while keys are `sk_test_`.
6. After deploy, set `CLIENT_URL` to the real HTTPS URL and redeploy once if needed.

Also: replace legal-page placeholders; plan a real DB when you outgrow the JSON file.
