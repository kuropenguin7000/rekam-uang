# Rekam Uang — Money Tracker

A simple **expense tracker** for the Indonesian market: log spending with a
quick manual form, tag each expense to a **family member**, and read it back on
a mobile-first dashboard — with a rule-based **"Wawasan"** (Insights) panel for
savings advice. UI in **Indonesian** (and English). No AI, no paid plans, no
server — the whole app runs free on the Firebase **Spark** plan.

Four tabs around a centre add button — **Beranda · Statistik · + · Wawasan ·
Akun** — as a bottom bar on a phone and the same items as a side rail on
tablet/desktop, with an identical single-column layout at every width.

> **Expenses only.** Income tracking was removed deliberately: the monthly
> budget is set from income *outside* the app, so nothing on screen reveals
> what comes in.

> Product name is **Rekam Uang**. The repo folder is still `spend-wise` — an
> infrastructure identifier, intentionally left unchanged.

**Stack:** Next.js 16 static export (App Router, Turbopack) · React 19 ·
TypeScript · Tailwind v4 · **Firebase Auth** (Google sign-in) ·
**Cloud Firestore** (browser SDK + per-user security rules) ·
**Firebase Hosting** (free plan).

Runtime dependencies are just `next`, `react`, `react-dom` and `firebase` —
the charts are plain CSS, so there is no charting or spreadsheet library.

## Architecture (no server)

The build (`next build`, `output: "export"`) produces plain static files in
`out/`. The browser talks to Firebase directly:

- **Auth**: Google sign-in popup; the Firebase SDK persists the session
  (IndexedDB) and refreshes tokens itself. Pages guard themselves client-side
  (`onAuthStateChanged` → redirect to `/login`).
- **Data**: [src/lib/firestore.ts](src/lib/firestore.ts) (web SDK) reads/writes
  `users/{uid}` and `users/{uid}/transactions/{id}`.
  [firestore.rules](firestore.rules) are the server-side enforcement: each user
  can only touch their own subtree, with field validation on every write.
- **Stats**: every figure on Beranda and Statistik is a pure fold over the
  already-loaded transactions ([src/lib/stats.ts](src/lib/stats.ts)) — no
  aggregation endpoint, no query beyond the initial read.

## Prerequisites

- Node.js 20+
- A Firebase project on the **free Spark plan** (no credit card)
- `firebase-tools` CLI (`npm i -g firebase-tools`) for deploys

## Firebase project setup (one-time)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add
   project** (Spark plan is fine).
2. **Authentication → Sign-in method → enable Google.**
3. **Firestore Database → Create database** (production mode; pick a region
   close to your users, e.g. `asia-southeast2` Jakarta).
4. **Project settings → General → Your apps → Add app → Web.** Copy the config
   values into `.env` (see `.env.example`).
5. Deploy rules + indexes **before first use** (the composite index builds
   asynchronously):

   ```bash
   firebase login
   firebase use <your-project-id>
   firebase deploy --only firestore
   ```

## Running locally

```bash
npm install
cp .env.example .env      # fill in the NEXT_PUBLIC_FIREBASE_* values
npm run dev               # http://localhost:3000
```

`localhost` is already an authorized domain for Google sign-in, and the
browser SDK needs no service account — `.env` is genuinely all of it.

To develop against the **local emulators** instead of the real project:
`NEXT_PUBLIC_FIREBASE_USE_EMULATORS=1` in `.env`, then
`firebase emulators:start --only auth,firestore --project demo-rekam`.

## Environment variables

| Variable | Required? | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | yes | Firebase web app config (public identifiers, inlined client-side). |
| `NEXT_PUBLIC_FIREBASE_USE_EMULATORS` | optional | `1` = use the local Auth/Firestore emulators. |

## Features

| Feature | Location |
| --- | --- |
| **Swipe-up add sheet** — headline amount, quick-amount chips, category tiles, member pills, merchant, note (a centred dialog on desktop) | [AddSheet.tsx](src/components/AddSheet.tsx) |
| **Mobile-first inputs** — tap-only date picker (centered calendar overlay on phones), money fields grouped while typing (`1.500.000`) | [DatePicker.tsx](src/components/DatePicker.tsx), [lib/format.ts](src/lib/format.ts) |
| **Beranda** — two switchable layouts: dense ("budget left" hero, quick stats, category bars) or a budget **ring**; both with This week / This month / All time tabs | [Beranda.tsx](src/components/Beranda.tsx), [BudgetRing.tsx](src/components/BudgetRing.tsx) |
| **Statistik** — spending heatmap calendar, per-member split, weekly trend vs last month | [Statistik.tsx](src/components/Statistik.tsx), [lib/stats.ts](src/lib/stats.ts) |
| Full transaction list with member chips + pagination, opening on whatever period Beranda was showing | [Transactions.tsx](src/components/Transactions.tsx) |
| **Per-member labels & filter** — tag every expense to Ayah / Ibu / Anak / Bersama (or a custom member) and filter the list by person | [MemberManager.tsx](src/components/MemberManager.tsx), [lib/members.ts](src/lib/members.ts) |
| Monthly budget **+ per-category budgets** | [CategoryBudgets.tsx](src/components/CategoryBudgets.tsx) |
| **Category management** — rename/hide built-ins, add/edit/delete custom | [CategoryManager.tsx](src/components/CategoryManager.tsx), [lib/categories.ts](src/lib/categories.ts) |
| Edit & delete transactions | [EditTransactionModal.tsx](src/components/EditTransactionModal.tsx) |
| **Notifications** (bell + persistent log) | [NotificationBell.tsx](src/components/NotificationBell.tsx), [lib/notifications.ts](src/lib/notifications.ts) |
| Rule-based insights (savings advice, computed client-side) | [InsightsPanel.tsx](src/components/InsightsPanel.tsx), [lib/insights.ts](src/lib/insights.ts) |
| Google sign-in (Firebase Auth, client SDK session) | [login/page.tsx](src/app/login/page.tsx), [lib/firebaseClient.ts](src/lib/firebaseClient.ts) |
| **Bilingual (ID/EN)** + light/dark theme | [I18nProvider.tsx](src/components/I18nProvider.tsx), [ThemeProvider.tsx](src/components/ThemeProvider.tsx) |

## Deploy — Firebase Hosting (free)

```bash
npm run build                     # static site → out/
firebase deploy --only hosting    # serves it at https://<project-id>.web.app
```

The `web.app` / `firebaseapp.com` domains are pre-authorized for Google
sign-in. If you add a **custom domain** later, also add it under
**Authentication → Settings → Authorized domains**.

## Data model

- `users/{uid}`: email, name, image, budget, dailyBudget, categoryBudgets
  (map), categoriesConfig (custom categories + built-in overrides),
  membersConfig (same shape, for family members), createdAt.
- `users/{uid}/transactions/{autoId}`: amount, category, member (built-in id or
  custom `m_*`; `""` = untagged), type, merchant, note, date (`yyyy-mm-dd`
  string), createdAt (Timestamp).
- One composite index: `(date desc, createdAt desc)` on `transactions`
  ([firestore.indexes.json](firestore.indexes.json)).

`type` is always `"expense"` for anything written today. It survives only so
`listTransactions` can recognise and exclude `"income"` documents saved before
income tracking was removed — one filter at the data-layer boundary, so nothing
downstream needs a type check. The Account page shows a one-time purge card
while any such documents remain, and hides itself once they're gone.

Spark free quotas (50k reads / 20k writes per day, 1 GiB storage) are far
beyond personal use.
