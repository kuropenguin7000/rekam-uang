@AGENTS.md

# Rekam Uang — Project Context

> **Product name:** "Rekam Uang" (user-facing). The codebase folder is still
> `spend-wise` — an infrastructure identifier, intentionally left unchanged.

A manual-entry **expense tracker** for the Indonesian market (default
locale `id`, also `en`). Users log transactions with an add form; a dashboard
visualizes cash flow; a rule-based "Wawasan" (Insights) panel gives savings
advice. **No AI, no billing, NO SERVER — everything is free** and runs on the
Firebase Spark plan. Native Android/iOS apps planned later (they'd use the
same Firebase Auth + Firestore + rules directly).

## Stack
Next.js 16 **static export** (`output: "export"` — no API routes, no
middleware/proxy, no server components with request APIs) · React 19 ·
TypeScript · Tailwind v4 · **Firebase Auth** (Google sign-in,
client SDK session) · **Cloud Firestore via the browser SDK** guarded by
per-user **security rules** · **Firebase Hosting** (free plan, `out/`).
> **No chart library and no export deps.** The 2026 mobile redesign draws its
> own bars/heatmap in CSS, so recharts, exceljs and pdf-lib were all removed
> (~138 packages). Don't reach for a chart lib without checking whether a
> div with a width percentage does the job.

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
  **categoriesConfig** (native map: custom categories + built-in
  rename/icon/hide overrides), **membersConfig** (same shape, for family
  members), createdAt.
- `users/{uid}/transactions/{autoId}`: amount, category (string id — built-in
  or custom `c_*`), **member** (built-in id or custom `m_*`; "" = untagged),
  type (always "expense" — see below), merchant, note,
  **date (string yyyy-mm-dd — keep it a string; lexicographic ordering + all
  client aggregation depend on it)**, createdAt (Timestamp → millis at the
  data-layer boundary via `txFromSnap`).
- **Income was removed from the product.** `createTransaction` always writes
  `type: "expense"` (firestore.rules still requires the field), and
  `listTransactions` filters out any legacy `type: "income"` docs at that
  single boundary — so nothing downstream needs a type check. `IncomePurge`
  (account page) deletes the leftovers and hides itself once the count is 0.
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
- **App shell** ([src/app/page.tsx](src/app/page.tsx)) — 2026 mobile redesign,
  implemented from the Claude Design doc "Rekam Uang Mobile Redesign"
  (directions **1a + 1b + 1c + 1d**, flat surfaces — note the doc renumbered
  mid-project: the Statistik screen was 1c in the first revision and is 1d now).
  Four tabs + a centre add button:
  **Beranda · Statistik · + · Wawasan · Akun**. On a phone that's a bottom bar
  with the raised `+`; from `sm:` up the *same* items become a fixed 236px
  side rail. Content stays a single `max-w-lg` column at every width, so
  tablet/desktop render the phone layout rather than a re-flowed variant.
- **Manual entry** ([AddSheet.tsx](src/components/AddSheet.tsx), design **1c**):
  a bottom sheet, not a form — headline amount, quick-amount chips
  (25/50/100/250rb), category **tiles** (6 then "•••"), member pills, merchant,
  note, DatePicker. Slides up from the bottom edge below `sm:`; the same content
  centres as a dialog from `sm:` up, since a sheet is a phone idiom. Portalled
  to `<body>` like the other dialogs. **Swipe down to dismiss**: the grip zone
  (handle + title, `touch-action: none`) always drags, and the body drags too
  once it is scrolled to the top so the gesture never steals a live scroll.
  Past 110px a release runs `.sheet-closing`; below it the sheet snaps back.
  The entrance animation is dropped on first touch (`touched`) — otherwise a
  snap-back replays it.
- **Mobile-first inputs** (the owner uses the app daily on a phone):
  [DatePicker.tsx](src/components/DatePicker.tsx) is a button trigger (NO
  free-text typing — no keyboard on mobile) whose calendar renders as a
  centered fixed overlay + backdrop below `sm:`, and as an anchored popover
  (with drop-up near the viewport bottom) on `sm:`+. All money inputs keep raw
  digits in state and display them grouped via `groupDigits`
  ([src/lib/format.ts](src/lib/format.ts)): "1500000" → "1.500.000".
- **Beranda** ([Beranda.tsx](src/components/Beranda.tsx)) has **two layouts**,
  toggled from the header and remembered in localStorage `sw_home_style`:
  - **dense** (design 1a) — gradient "Sisa anggaran" hero, three quick stats
    (Hari ini / Minggu ini / Transaksi), category **bars** (they replaced the
    pie);
  - **ring** (design 1b) — [BudgetRing.tsx](src/components/BudgetRing.tsx), a
    conic-gradient donut segmented by category with spent/budget/left in the
    hole, plus legend chips. Conic stops are cumulative percentages, so there
    is no arc maths and nothing to resync when a category changes.
  Both share the greeting, the **Minggu ini / Bulan ini / Semua** period tabs
  ([PeriodTabs.tsx](src/components/PeriodTabs.tsx)) and the recent list.
  The month chip only appears while the *month* filter is active; the other two
  periods swap it for a static label. "Lihat semua" opens
  [Transactions.tsx](src/components/Transactions.tsx) — the full list with
  member chips, pagination and edit/delete — as a sub-view, not a tab, and it
  **inherits the active period/month** so it never contradicts the screen you
  came from.
- **Statistik** ([Statistik.tsx](src/components/Statistik.tsx), design **1d**):
  spending heatmap calendar (Monday-first, **day numbers in each cell**,
  intensity vs the month's busiest day, red over the daily budget, today
  outlined, future dimmed), per-member split with percentages, and a weekly
  trend with a vs-last-month delta. Cell text colour flips with fill intensity
  so the numerals stay legible at both ends of the ramp.
- **Period control**: both screens are scoped to one **calendar month** via
  `MonthChip` ([period.ts](src/lib/period.ts)); stepping forward past the
  current month is disabled. Derived figures live in
  [stats.ts](src/lib/stats.ts) — all pure folds over the loaded transactions.
- **Member labels** ([src/lib/members.ts](src/lib/members.ts)): every expense is
  tagged with a family member (built-ins Ayah/Ibu/Anak/Bersama, renameable +
  **re-iconable** + hideable, plus custom `m_*`; managed in
  [MemberManager.tsx](src/components/MemberManager.tsx) on the Akun tab).
  Member chips scope the transaction list; Statistik shows the split.
- **Insights**: [InsightsPanel.tsx](src/components/InsightsPanel.tsx) computes
  `generateInsights(transactions, budget, locale)` ([src/lib/insights.ts](src/lib/insights.ts))
  **client-side in a useMemo** — pure rules (spikes, recurring charges, small
  spends, budget benchmark).
- **Per-category budgets** + **editable categories** (rename/re-icon/hide
  built-ins, CRUD custom; delete reassigns to "other") via `effectiveCategories`/
  `resolveCategory`; category logic lives in firestore.ts (addCategory etc.).
- **Notifications**: bell derives budget alerts from store state
  ([src/lib/notifications.ts](src/lib/notifications.ts)); persistent log in
  localStorage **`sw_notif_log_v2`**, capped 20, cleared on logout.
- **Akun** ([AccountPanel.tsx](src/components/AccountPanel.tsx)): profile,
  monthly + daily budget, per-category budgets, member/category managers,
  income purge, logout. The budget *controls* moved here because Beranda now
  shows the budget as a single answer. `/account` still exists for deep links
  and renders the same panel.
- **No export.** Removed in the redesign along with exceljs + pdf-lib.
- **Styling conventions** ([globals.css](src/app/globals.css)): surfaces are
  flat — `.card` (surface + hairline + 20px radius), `.hero-grad` (the Beranda
  hero), `.num` (tabular mono for money). Selected/active controls use
  `.grad-primary` (full three-stop ramp, for the big save button) or
  `.grad-chip` (tighter two-stop, for chips/pills/tabs — the three-stop ramp
  goes muddy at chip size). Category tiles keep their own category colour so
  they stay identifiable.
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
- **No income tracking** (removed deliberately — the monthly budget is set from
  income outside the app). The `type` field survives only to exclude legacy
  income docs; drop it once `IncomePurge` has run and the component is deleted.
- Notification log is **per-browser** (localStorage), not synced server-side.
- Popup sign-in can be blocked in mobile in-app browsers; `signInWithRedirect`
  is future work.
- Signed-out visitors briefly see the app shell before the client-side
  redirect to /login kicks in (no middleware on static hosting).
- Pre-existing lint debt: `react-hooks/set-state-in-effect` errors across
  several components (`npm run lint` was already red before the migration;
  build/tsc are green).

## Gotchas paid for in blood
- **Nothing may bleed past the viewport horizontally.** `html` carries
  `overflow-x: clip` as a backstop (`clip`, not `hidden` — `hidden` makes a
  scroll container and forces the other axis to `auto`, which breaks the fixed
  bottom nav). The bug behind it: a decorative circle at `-right-5` inside the
  hero relied on `overflow-hidden` + `rounded-[22px]` to clip it, and **Safari
  does not reliably clip absolutely-positioned children of a rounded
  overflow-hidden box** — 4px escaped and scrolled the whole page sideways on
  iOS only. Keep decorative elements inside their parent's box.
- **Declare `backdrop-filter` unprefixed only.** Tailwind v4 runs Lightning CSS,
  which adds prefixes per target; hand-writing `-webkit-` alongside it made the
  pair collapse to the prefixed one and silently dropped the effect in Firefox.
- **A hand-rolled CSS class used but not defined fails silently** — no build
  error, no console warning, the element just renders unstyled (this is how the
  save button shipped as bare text after `.grad-primary` was deleted with the
  old backdrop block). When touching globals.css, grep that every `.card` /
  `.grad-*` / `.animate-*` / `.hero-grad` / `.num` used in a component still
  exists.
- **A Next.js route folder starting with `_` is private and will not route.**
  A throwaway probe page at `app/_probe` 404s, which looks exactly like a page
  that renders fine and measures clean.
- **The dev server can serve stale CSS** after a globals.css edit — if a rule
  seems missing, check the built output in `out/` before concluding the
  compiler dropped it.

## Working preferences
- **Verify token-efficiently**: prefer text-based checks (DOM/computed-style via
  the browser console, `tsc`, Invoke-RestMethod, throwaway node scripts) over
  screenshots. Only screenshot if asked.
- Don't commit/push unless asked. End commit messages with the Co-Authored-By
  line.
- Encoding gotcha: don't edit `messages.ts` via PowerShell Get/Set-Content (it
  once produced mojibake) — use the Edit/Write tools (UTF-8).
