@AGENTS.md

# Rekam Uang — Project Context

> **Product name:** "Rekam Uang" (user-facing). The codebase folder is still
> `spend-wise` — an infrastructure identifier, intentionally left unchanged.

A manual-entry **expense + income tracker** for the Indonesian market (default
locale `id`, also `en`). Users log transactions with an add form; a dashboard
visualizes cash flow; a rule-based "Wawasan" (Insights) panel gives savings
advice. **No AI, no billing, NO SERVER — everything is free** and runs on the
Firebase Spark plan. Native Android/iOS apps planned later (they'd use the
same Firebase Auth + Firestore + rules directly).

## Stack
Next.js 16 **static export** (`output: "export"` — no API routes, no
middleware/proxy, no server components with request APIs) · React 19 ·
TypeScript · Tailwind v4 · Recharts · **Firebase Auth** (Google sign-in,
client SDK session) · **Cloud Firestore via the browser SDK** guarded by
per-user **security rules** · exceljs + pdf-lib (in-browser export) ·
**Firebase Hosting** (free plan, `out/`).

> Read `node_modules/next/dist/docs/` before writing Next code — this is Next 16
> with breaking changes from older versions (see AGENTS.md).

## How to run
```bash
npm install
npm run dev                 # http://localhost:3000
```
- Needs `.env` with `NEXT_PUBLIC_FIREBASE_*` (web app config) — nothing else.
  No service account: the browser SDK is the only Firebase client.
- Deploy rules/indexes before first use against a fresh project:
  `firebase deploy --only firestore` (the composite index builds async;
  the transactions query throws FAILED_PRECONDITION until ready).
- **Local E2E without a real Firebase project**: set
  `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=1` in `.env`, then run
  `npx -y firebase-tools@13.35.1 emulators:start --only auth,firestore
  --project demo-rekam` (global firebase-tools 15 needs Java 21; this machine
  has Java 17, and v13 works — ports in firebase.json: auth 9099, firestore
  8089). The auth emulator's Google popup lets you invent a fake account.
  Note: the Firestore emulator DOES enforce security rules, but does NOT
  enforce composite indexes — index errors only appear against the real
  service.
- The PowerShell tool's cwd defaults to `…\project`; always use the absolute
  project path `C:\Users\rrahman.c\Documents\project\spend-wise`.
- The Bash-tool sandbox can't reach localhost (curl returns 000) — use
  PowerShell `Invoke-RestMethod`/`Invoke-WebRequest -UseBasicParsing` for HTTP
  tests, in one call.

## Auth (all client-side)
- **Firebase Auth, Google sign-in only.** [src/app/login/page.tsx](src/app/login/page.tsx)
  → `signInWithPopup`; the SDK persists the session in IndexedDB and refreshes
  tokens itself — there is no cookie and no session endpoint.
- **Page guarding is client-side** (static hosting has no middleware):
  [src/store/ExpenseStore.tsx](src/store/ExpenseStore.tsx) (for `/`) and
  [src/app/account/page.tsx](src/app/account/page.tsx) subscribe to
  `onAuthStateChanged` and redirect to `/login` when signed out; the login
  page redirects signed-in visitors to `/`.
- [src/lib/firebaseClient.ts](src/lib/firebaseClient.ts) — app singleton,
  `clientAuth()` / `clientDb()`, emulator wiring via
  `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=1`.

## Data model ([src/lib/firestore.ts](src/lib/firestore.ts) — all data access, browser SDK)
- `users/{uid}`: email, name, image, budget (default 5,000,000), dailyBudget
  (0 = auto = budget/30), **categoryBudgets** (native map {cat: amount}),
  **categoriesConfig** (native map: custom categories + built-in rename/hide
  overrides), createdAt.
- `users/{uid}/transactions/{autoId}`: amount, category (string id — built-in
  or custom `c_*`), type ("expense" | "income"), merchant, note,
  **date (string yyyy-mm-dd — keep it a string; lexicographic ordering + all
  client aggregation depend on it)**, createdAt (Timestamp → millis at the
  data-layer boundary via `txFromSnap`).
- One composite index ([firestore.indexes.json](firestore.indexes.json)):
  `(date desc, createdAt desc)`.
- `updateUser` uses `updateDoc` (not merge) so map fields are replaced
  wholesale — callers send the full next map; merge would resurrect deleted
  keys. Category delete = `deleteCategory` (query + batched writes,
  transactions-first then config, retry-safe).
- **[firestore.rules](firestore.rules) are the server-side validation**: each
  user owns exactly `users/{uid}`; writes are field-validated (amount int > 0,
  type whitelist, length caps, date regex, createdAt immutable on update).
  Client-side sanitizing (`sanitizeNewTransaction`, caps, category-vs-effective
  -list) lives in firestore.ts — keep the two in sync.

## Features
- **Manual entry**: [AddTransactionModal.tsx](src/components/AddTransactionModal.tsx)
  (+ header button and mobile FAB in [src/app/page.tsx](src/app/page.tsx));
  expense/income toggle (income has no category — forced "other"), optional
  note, DatePicker. 2 tabs: Dashboard (default) + Wawasan.
- **Mobile-first inputs** (the owner uses the app daily on a phone):
  [DatePicker.tsx](src/components/DatePicker.tsx) is a button trigger (NO
  free-text typing — no keyboard on mobile) whose calendar renders as a
  centered fixed overlay + backdrop below `sm:`, and as an anchored popover
  (with drop-up near the viewport bottom) on `sm:`+. All money inputs keep raw
  digits in state and display them grouped via `groupDigits`
  ([src/lib/format.ts](src/lib/format.ts)): "1500000" → "1.500.000".
- **Dashboard**: Pemasukan/Pengeluaran/Selisih; charts, budget bar, category
  breakdown are expense-only; pagination (10/page, filler rows); custom date
  range for everyone.
- **Insights**: [InsightsPanel.tsx](src/components/InsightsPanel.tsx) computes
  `generateInsights(transactions, budget, locale)` ([src/lib/insights.ts](src/lib/insights.ts))
  **client-side in a useMemo** — pure rules (spikes, recurring charges, small
  spends, budget benchmark), income filtered out.
- **Per-category budgets** + **editable categories** (rename/hide built-ins,
  CRUD custom; delete reassigns to "other") via `effectiveCategories`/
  `resolveCategory`; category logic lives in firestore.ts (addCategory etc.).
- **Notifications**: bell derives budget alerts from store state
  ([src/lib/notifications.ts](src/lib/notifications.ts)); persistent log in
  localStorage **`sw_notif_log_v2`**, capped 20, cleared on logout.
- **Export**: built **in the browser** from store data —
  [ExportMenu.tsx](src/components/ExportMenu.tsx) dynamically imports
  [src/lib/export.ts](src/lib/export.ts) (exceljs resolves to its browser
  bundle via the package "browser" field; pdf-lib is browser-first).
  Expense-only, localized category names.
- **i18n**: static HTML prerenders in `id`; [I18nProvider.tsx](src/components/I18nProvider.tsx)
  restores the stored locale from localStorage in a post-hydration effect
  (NOT a state initializer — avoids hydration mismatches).

## Config / env ([.env](.env))
`NEXT_PUBLIC_FIREBASE_API_KEY/_AUTH_DOMAIN/_PROJECT_ID/_APP_ID` (public web
config); optional `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=1`.
- [next.config.ts](next.config.ts): `output: "export"`,
  `allowedDevOrigins: ['*.trycloudflare.com']`.

## Deploy
- **Firebase Hosting, Spark (free) plan — no card**: `npm run build` →
  `out/`, then `firebase deploy --only hosting` → `https://<project>.web.app`
  ([firebase.json](firebase.json): public `out`, cleanUrls). `web.app`/
  `firebaseapp.com` are pre-authorized for Google sign-in; add any custom
  domain to Auth authorized domains.
- **Dev sharing**: Cloudflare quick tunnel; add the tunnel domain to Firebase
  Auth authorized domains.

## Known limitations / follow-ups
- **Export is expense-only** (income export = follow-up).
- **Income has no sub-categories** (just amount + source).
- Notification log is **per-browser** (localStorage), not synced server-side.
- Popup sign-in can be blocked in mobile in-app browsers; `signInWithRedirect`
  is future work.
- Signed-out visitors briefly see the app shell before the client-side
  redirect to /login kicks in (no middleware on static hosting).
- Pre-existing lint debt: `react-hooks/set-state-in-effect` errors across
  several components (`npm run lint` was already red before the migration;
  build/tsc are green).

## Working preferences
- **Verify token-efficiently**: prefer text-based checks (DOM/computed-style via
  the browser console, `tsc`, Invoke-RestMethod, throwaway node scripts) over
  screenshots. Only screenshot if asked.
- Don't commit/push unless asked. End commit messages with the Co-Authored-By
  line.
- Encoding gotcha: don't edit `messages.ts` via PowerShell Get/Set-Content (it
  once produced mojibake) — use the Edit/Write tools (UTF-8).
