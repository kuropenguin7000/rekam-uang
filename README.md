# Rekam Uang — Money Tracker

A simple **income & expense tracker** for the Indonesian market: log
transactions with a quick manual form, a dashboard visualizes **cash flow**,
and a rule-based **"Wawasan"** (Insights) panel gives savings advice. UI in
**Indonesian** (and English). No AI, no paid plans, no server — the whole app
runs free on the Firebase **Spark** plan.

> Product name is **Rekam Uang**. The repo folder is still `spend-wise` — an
> infrastructure identifier, intentionally left unchanged.

**Stack:** Next.js 16 static export (App Router, Turbopack) · React 19 ·
TypeScript · Tailwind v4 · Recharts · **Firebase Auth** (Google sign-in) ·
**Cloud Firestore** (browser SDK + per-user security rules) · exceljs +
pdf-lib (in-browser export) · **Firebase Hosting** (free plan).

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
- **Export**: Excel/PDF/CSV files are generated **in the browser** from the
  already-loaded data ([src/lib/export.ts](src/lib/export.ts), dynamically
  imported) — no endpoint involved.

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
| **Manual add form** (expense/income toggle, category, note, date) | [AddTransactionModal.tsx](src/components/AddTransactionModal.tsx) |
| **Mobile-first inputs** — tap-only date picker (centered calendar overlay on phones), money fields grouped while typing (`1.500.000`) | [DatePicker.tsx](src/components/DatePicker.tsx), [lib/format.ts](src/lib/format.ts) |
| Cash-flow dashboard (**Income / Expense / Net**), pie + daily charts, period filters | [Dashboard.tsx](src/components/Dashboard.tsx) |
| Monthly budget **+ per-category budgets** | [CategoryBudgets.tsx](src/components/CategoryBudgets.tsx) |
| **Category management** — rename/hide built-ins, add/edit/delete custom | [CategoryManager.tsx](src/components/CategoryManager.tsx), [lib/categories.ts](src/lib/categories.ts) |
| Edit & delete transactions | [EditTransactionModal.tsx](src/components/EditTransactionModal.tsx) |
| **Notifications** (bell + persistent log) | [NotificationBell.tsx](src/components/NotificationBell.tsx), [lib/notifications.ts](src/lib/notifications.ts) |
| Rule-based insights (savings advice, computed client-side) | [InsightsPanel.tsx](src/components/InsightsPanel.tsx), [lib/insights.ts](src/lib/insights.ts) |
| **Excel / PDF / CSV export** (built in the browser) | [ExportMenu.tsx](src/components/ExportMenu.tsx), [lib/export.ts](src/lib/export.ts) |
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
  (map), categoriesConfig (custom categories + built-in overrides), createdAt.
- `users/{uid}/transactions/{autoId}`: amount, category, type
  (expense/income), merchant, note, date (`yyyy-mm-dd` string), createdAt
  (Timestamp).
- One composite index: `(date desc, createdAt desc)` on `transactions`
  ([firestore.indexes.json](firestore.indexes.json)).

Spark free quotas (50k reads / 20k writes per day, 1 GiB storage) are far
beyond personal use.
