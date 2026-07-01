# Rekam Uang — Chat-Based Money Tracker

A conversational **income & expense tracker** for the Indonesian market: type
transactions in natural language, AI classifies income/expense + category, a
dashboard visualizes **cash flow**, and an AI **"Wawasan"** (Insights) assistant
gives savings advice. UI in **Indonesian** (and English).

> Product name is **Rekam Uang**. The repo folder is still `spend-wise` and the
> Postgres database/user/container are still `spendwise` — those are
> infrastructure identifiers, intentionally left unchanged.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind
v4 · Recharts · Prisma 6 + **PostgreSQL** (Docker) · `jose` (JWT-cookie auth) +
Google OAuth · **Google Gemini** (`@google/genai`) · exceljs + pdf-lib (export) ·
Midtrans (mocked).

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL)

## Running

```bash
docker compose up -d      # PostgreSQL on host port 5433 (container spendwise-db)
npm install               # also runs `prisma generate` (postinstall)
cp .env.example .env      # then fill in credentials (see "Environment variables")
npm run db:push           # create / sync tables in Postgres
npm run dev               # http://localhost:3000
```

> Use `npm run dev`, **not** `npm start` — production mode sets a `Secure` cookie
> that won't persist over plain http during local development.

### Minimum credentials to sign in

- **Login requires Google OAuth** (demo login has been removed). Fill in
  `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`, then register
  `${APP_URL}/api/auth/google/callback` as an *Authorized redirect URI* in the
  Google Cloud Console.
- **Gemini is optional** — without `GEMINI_API_KEY`, the app uses a **local**
  regex parser/insights engine as a fallback, so it still runs end-to-end.
- **Midtrans is mocked** — keep `MIDTRANS_MOCK="true"` for the simulated payment
  flow (no real charges).
- **Master account** — set `MASTER_EMAIL` to your email to unlock every feature
  (equivalent to unlimited Pro).

> Local DB via [docker-compose.yml](docker-compose.yml) (Postgres on port **5433**
> so it doesn't clash with another Postgres on 5432). Stop it with
> `docker compose down` (add `-v` to delete its data). Inspect data with
> `npm run db:studio`, or IntelliJ Database — Host `localhost`, Port `5433`,
> Database/User/Password all `spendwise`.

## Environment variables

See [.env.example](.env.example) for the full template.

| Variable | Required? | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection (default already matches docker-compose). |
| `AUTH_SECRET` | yes | JWT session signing key (`sw_session` cookie). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes (to sign in) | Google OAuth credentials. |
| `APP_URL` | yes | Public base URL; drives the OAuth redirect (e.g. tunnel/deploy URL). |
| `MASTER_EMAIL` | optional | Master account email (all features unlocked). |
| `GEMINI_API_KEY` (+ `_2`/`_3`, `GEMINI_API_KEYS`) | optional | AI parsing/analysis; empty → local fallback. Multiple keys = automatic failover. |
| `GEMINI_MODEL` | optional | Defaults to `gemini-2.5-flash`. |
| `MIDTRANS_MOCK` | yes | `"true"` for the simulated payment flow. |
| `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` | optional | Only when `MIDTRANS_MOCK=false`. |

## Features

| Feature | Location |
| --- | --- |
| Chat to log transactions (**income & expense**) | [ChatPanel.tsx](src/components/ChatPanel.tsx) → `POST /api/parse` |
| **Edit / Confirm / Discard** receipt card | [ReceiptCard.tsx](src/components/ReceiptCard.tsx) |
| Cash-flow dashboard (**Income / Expense / Net**), pie + daily charts, period filters | [Dashboard.tsx](src/components/Dashboard.tsx) |
| Monthly budget **+ per-category budgets** | [CategoryBudgets.tsx](src/components/CategoryBudgets.tsx) |
| **Category management** — rename/hide built-ins, add/edit/delete custom | [CategoryManager.tsx](src/components/CategoryManager.tsx), [lib/categories.ts](src/lib/categories.ts) |
| Edit & delete transactions | [EditTransactionModal.tsx](src/components/EditTransactionModal.tsx) |
| **Notifications** (bell + persistent log) | [NotificationBell.tsx](src/components/NotificationBell.tsx), [lib/notifications.ts](src/lib/notifications.ts) |
| AI insights (savings advice) | [InsightsPanel.tsx](src/components/InsightsPanel.tsx) → `POST /api/analyze` |
| **Excel / PDF / CSV export** (Pro) | [ExportMenu.tsx](src/components/ExportMenu.tsx) → `GET /api/export`, [lib/export.ts](src/lib/export.ts) |
| Google login + JWT session | [login/page.tsx](src/app/login/page.tsx), [lib/google.ts](src/lib/google.ts), [lib/session.ts](src/lib/session.ts) |
| Pricing, Pro subscription, **renewal & auto-downgrade** | [pricing/page.tsx](src/app/pricing/page.tsx), [api/billing](src/app/api/billing) |
| **Bilingual (ID/EN)** + light/dark theme | [I18nProvider.tsx](src/components/I18nProvider.tsx), [ThemeProvider.tsx](src/components/ThemeProvider.tsx) |

App routes are protected by [src/proxy.ts](src/proxy.ts) (Next 16 middleware);
public routes: `/login`, `/pricing`, `/terms`.

## Plans & limits

Defined in [src/lib/plans.ts](src/lib/plans.ts):

- **Free** — 5 AI parses/day, 1 AI analysis/day, weekly & monthly filters.
- **Pro** (Rp 49,000/mo or Rp 490,000/yr) — unlimited AI parsing & analysis,
  subscription/benchmark detection, custom date-range filters, Excel/PDF/CSV
  export.
- **Master** (`MASTER_EMAIL`) — everything unlocked, no limits.

Limits are enforced per-day on the server ([lib/usage.ts](src/lib/usage.ts)), plus
a per-signature result cache, per-request cooldown, and a hard daily cap for all.

## AI: Gemini + failover

Parsing & analysis use `gemini-2.5-flash` via `@google/genai` (see
[lib/ai.ts](src/lib/ai.ts)):

- **Structured JSON output** (`responseSchema`) with thinking disabled → token
  efficient, no prose.
- **Multi-key failover** — reads `GEMINI_API_KEY` + `_2`/`_3` (and an optional
  comma-separated `GEMINI_API_KEYS`). On quota/rate-limit (429), overload (503),
  or an invalid key (401/403), it rotates to the next key automatically.
- **Parse** classifies income vs expense, picks a built-in category, extracts the
  merchant/source, and resolves **relative dates** ("kemarin", "senin kemarin",
  "3 hari lalu" …).
- **Analyze** sends a pre-aggregated summary, not every transaction row.
- **Local fallback** ([lib/parser.ts](src/lib/parser.ts), [lib/insights.ts](src/lib/insights.ts))
  when all keys fail or none are set — the app keeps working.

## API

| Route | Purpose |
| --- | --- |
| `POST /api/auth/google` · `/google/callback` · `POST /api/auth/logout` | Google auth + session |
| `GET/PATCH /api/me` | Profile, entitlements, usage, budgets, categories |
| `GET/POST /api/transactions`, `PATCH/DELETE /api/transactions/[id]` | Transaction CRUD |
| `POST/PATCH/DELETE /api/categories` | Manage categories (custom + built-in overrides) |
| `POST /api/parse` | Parse a transaction (gated + metered) |
| `POST /api/analyze` | AI insights (gated + metered) |
| `GET /api/export` | Export Excel/PDF/CSV (Pro) |
| `POST /api/billing/checkout` · `/webhook` · `/expire` | Midtrans payment (mock) + auto-downgrade |

## Enabling real integrations

- **Google OAuth** — fill in `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`; add
  `${APP_URL}/api/auth/google/callback` as a redirect URI.
- **Gemini** — set `GEMINI_API_KEY` (and `_2`/`_3` for failover). Override
  `GEMINI_MODEL` if needed.
- **Midtrans** — set `MIDTRANS_MOCK=false` + `MIDTRANS_SERVER_KEY`, then replace
  the body of `createTransaction()` in [lib/midtrans.ts](src/lib/midtrans.ts) with
  a Snap API call (the webhook contract already matches Midtrans).
- **Production PostgreSQL** — point `DATABASE_URL` at a managed Postgres/VPS. The
  schema is synced with `npx prisma db push` (this project has no migration files).

## Sharing & deploy

- **Quick public sharing** — Cloudflare quick tunnel:
  `cloudflared tunnel --url http://localhost:3000`. Each run gives a new random URL
  → update `APP_URL`, restart dev, and re-add the Google redirect URI.
- **Free hosting** — Vercel (app) + Neon (Postgres); needs Prisma
  `binaryTargets`/`directUrl` tweaks and the Google redirect for the deploy URL.
