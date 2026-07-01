@AGENTS.md

# Rekam Uang — Project Context

> **Product name:** "Rekam Uang" (user-facing). The codebase folder is still
> `spend-wise` and the Postgres DB/user/container are still `spendwise` — those
> are infrastructure identifiers, intentionally left unchanged.

A conversational **expense + income tracker** for the Indonesian market (default
locale `id`, also `en`). Users log transactions by chatting in natural language;
AI parses them; a dashboard visualizes cash flow; an AI "Wawasan" (Insights)
feature gives savings advice. Goal: launch to the Indonesian market; native
Android/iOS apps planned later (the Next.js API + JWT auth already make a mobile
client feasible).

## Stack
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
Recharts · Prisma 6 (**pinned** — Prisma 7 dropped the classic datasource URL) +
PostgreSQL · jose (JWT-cookie auth, not NextAuth) · `@google/genai` (Gemini) ·
exceljs + pdf-lib (export) · Midtrans (mocked).

> Read `node_modules/next/dist/docs/` before writing Next code — this is Next 16
> with breaking changes from older versions (see AGENTS.md).

## How to run
```bash
docker compose up -d        # Postgres on :5433 (container spendwise-db; db/user/pass all "spendwise")
npm install
npm run dev                 # http://localhost:3000 — use dev, NOT start
```
- Use `npm run dev` locally. `npm run start` (production) sets a `Secure` cookie
  that won't persist over plain http.
- There's an unrelated `dev-stack-rrp` Postgres on :5432 — don't touch it.
- The PowerShell tool's cwd defaults to `…\project`; always use the absolute
  project path `C:\Users\rrahman.c\Documents\project\spend-wise`.
- The Bash-tool sandbox can't reach localhost (curl returns 000) — use PowerShell
  `Invoke-RestMethod`/`Invoke-WebRequest` for HTTP tests, in one call.
- DB schema changes use `npx prisma db push` (no migration files). After push run
  `npx prisma generate` — but the **dev server locks the query-engine DLL**, so
  stop node first (EPERM otherwise), generate, then restart dev.

## Auth & accounts
- Google OAuth only (demo login removed). Real flow via [src/lib/google.ts](src/lib/google.ts);
  redirect URI is `${APP_URL}/api/auth/google/callback`.
- Sessions: jose JWT in `sw_session` httpOnly cookie ([src/lib/session.ts](src/lib/session.ts)),
  secret `AUTH_SECRET`. `secure` only in production.
- [src/lib/auth.ts](src/lib/auth.ts) — `getAuthUser` (also runs the lazy
  auto-downgrade), `upsertUser`, master detection. AuthUser carries budget,
  dailyBudget, planExpiresAt, categoryBudgets, **categories** (effective list).
- [src/proxy.ts](src/proxy.ts) — middleware (Next 16 "proxy" convention).
  Protects routes; public = `/login`, `/pricing`, `/terms`. Redirects are built
  from `publicBaseUrl` so they stay on the tunnel/domain, not internal localhost.
- Master account: `MASTER_EMAIL` env → role=master, treated as pro everywhere.

## Data model ([prisma/schema.prisma](prisma/schema.prisma))
- **User**: role, plan, budget, dailyBudget, analysisSig/analysisJson (insights
  cache), **planExpiresAt** (Pro period end), **categoryBudgets** (JSON
  {cat:amount}), **categoriesConfig** (JSON: custom categories + built-in
  rename/hide overrides).
- **Transaction**: amount, category (string id — built-in or custom `c_*`),
  **type** ("expense" | "income"), merchant, note, date (ISO yyyy-mm-dd).
- **Subscription** (Midtrans, mocked): plan, status, **cycle**, orderId,
  grossAmount, **currentPeriodEnd**.
- **Usage**: per-day per-feature counter (+ updatedAt) for AI cost protection.

## AI ([src/lib/ai.ts](src/lib/ai.ts))
- **Gemini** via `@google/genai`, default model `gemini-2.5-flash` (env
  `GEMINI_MODEL`). Structured JSON output (`responseSchema`), thinking disabled.
- **Multi-key failover**: reads `GEMINI_API_KEY` + `GEMINI_API_KEY_2/_3` (and an
  optional comma-separated `GEMINI_API_KEYS`). On quota/rate-limit (429),
  overload (503), or an unusable key (401/403/invalid) it rotates to the next key
  and remembers the working one. All keys failing → falls back to local engine.
- **Parse** classifies income vs expense (`kind`), picks a built-in category,
  extracts merchant/source, and resolves **relative dates** ("kemarin", "senin
  kemarin", "3 hari lalu" …) using today + weekday injected into the prompt.
- **Analyze** sends a pre-aggregated summary; falls back to [src/lib/insights.ts](src/lib/insights.ts).
- **Local fallback** [src/lib/parser.ts](src/lib/parser.ts): regex parser with
  income keyword detection, relative-date resolver, and a merchant extractor that
  stops at amounts/date-words. The local parser only auto-detects **built-in**
  categories.
- Cost protection in [src/lib/usage.ts](src/lib/usage.ts) + analyze route: result
  cache by data+locale signature, per-request cooldown, per-plan daily limits
  (free 5 parse / 1 analyze), hard daily cap for everyone.

## Features built (this session)
- **Income & cash flow**: transactions have a type; chat + local parser detect
  income; receipt shows income green with a 💰 badge and "Sumber"; dashboard top
  row = **Pemasukan / Pengeluaran / Selisih** (net). Charts, budget bar, and
  category breakdown are **expense-only**.
- **Per-category budgets**: caps stored in `categoryBudgets`; dashboard
  "Anggaran per kategori" card sets caps + shows progress vs **last-30-days**
  expense spend; over-cap fires a notification.
- **Editable categories** (defaults + custom): 8 built-ins can be **renamed /
  hidden** (not deleted); custom categories can be added/edited/deleted; deleting
  a custom category **reassigns its transactions to "other"**. Managed in the
  **"Kelola kategori"** card on the Account page. Resolved dynamically everywhere
  via `effectiveCategories`/`resolveCategory` + `categoryDisplayName`
  ([src/lib/categories.ts](src/lib/categories.ts), [src/lib/categoryName.ts](src/lib/categoryName.ts)).
- **Notifications**: global bell ([src/components/NotificationBell.tsx](src/components/NotificationBell.tsx))
  derives alerts from store state via [src/lib/notifications.ts](src/lib/notifications.ts)
  (subscription ending/expired, monthly exceeded/approaching, daily reached,
  category over-budget) and **materializes them into a persistent log**
  (localStorage `sw_notif_log`, newest-first, capped at **20** FIFO; read entries
  stay; badge = unread; cleared on logout).
- **Subscriptions/billing**: Pro period tracking; **renewal** (Pro users can buy
  again via `/pricing?renew=1`; webhook **stacks** the new period on remaining
  time); **auto-downgrade** (lazy in `getAuthUser` + batch [/api/billing/expire](src/app/api/billing/expire/route.ts));
  account subscription card shows active-until date + days left + renew.
- **Export** (Pro-gated [/api/export](src/app/api/export/route.ts), [src/lib/export.ts](src/lib/export.ts)):
  Excel (exceljs, transactions-first sheet), PDF (pdf-lib), CSV; localized
  category names; **expense-only** for now.
- **Dashboard**: transaction list **pagination** (10/page, invisible filler rows
  so the pager never shifts); budget proration on a single basis
  (`monthly ÷ 30 × days`) with an explanatory caption.
- **UI/mobile fixes**: number inputs are digit-only + `inputMode="numeric"`;
  mobile dropdown positioning for export/notification; plan badge moved from the
  header into the Account profile (clickable → pricing, single badge); chart
  click focus outline removed; microphone removed from chat; chat transcript
  persists per-tab (`sw_chat_messages`, cleared on logout); `/terms` page (public).

## Config / env ([.env](.env))
`DATABASE_URL`, `AUTH_SECRET`, `MASTER_EMAIL`, `GOOGLE_CLIENT_ID/SECRET`,
`APP_URL` (public base — set to the tunnel/deploy URL; drives OAuth redirect),
`GEMINI_API_KEY` (+ `_2`/`_3`), `GEMINI_MODEL`, `MIDTRANS_MOCK="true"`.
- [next.config.ts](next.config.ts) `allowedDevOrigins: ['*.trycloudflare.com']`
  (wildcard so a changing Cloudflare quick-tunnel keeps working in dev).

## Sharing / deploy
- **Quick public sharing**: Cloudflare quick tunnel — `cloudflared` is installed
  at `%LOCALAPPDATA%\cloudflared\cloudflared.exe` (also on the user PATH), run
  `cloudflared tunnel --url http://localhost:3000`. Each run gives a **new random
  URL** → update `APP_URL`, restart dev, and re-add the Google OAuth redirect.
- **Stable free URL**: ngrok free static domain, or a Cloudflare named tunnel
  (needs a domain). `publicBaseUrl` makes post-login redirects work behind any
  tunnel via `APP_URL`/forwarded headers.
- **Always-on free hosting**: Vercel (app) + Neon (Postgres) — needs
  `binaryTargets`/`directUrl` tweaks + the Google redirect for the deploy URL.

## Known limitations / follow-ups
- **Chat AI doesn't auto-assign custom categories** yet (built-ins only); custom
  categories are selectable in the receipt/edit dropdowns. Feeding the user's
  category list into the Gemini enum is a clean follow-up.
- **Export is expense-only** (income excluded; income export = follow-up).
- **Income has no sub-categories** (just amount + source).
- Notification read-state / log and chat transcript are **per-browser**
  (localStorage), not synced server-side.
- Switching UI language can re-log a category alert in the new language (cosmetic,
  capped at 20).

## Working preferences
- **Verify token-efficiently**: prefer text-based checks (DOM/computed-style via
  the browser console, `tsc`, `curl`/Invoke-RestMethod, throwaway node scripts
  with a minted `sw_session` cookie) over screenshots. Only screenshot if asked.
- Don't commit/push unless asked. End commit messages with the Co-Authored-By
  line.
- Encoding gotcha: don't edit `messages.ts` via PowerShell Get/Set-Content (it
  once produced mojibake) — use the Edit/Write tools (UTF-8).
