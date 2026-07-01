# Rekam Uang — Conversational Expense Tracker

Aplikasi pencatat pengeluaran berbasis chat: ketik/ucapkan pengeluaran dengan
bahasa natural, AI mengkategorikan otomatis, dashboard menampilkan grafik, dan
asisten AI memberi saran hemat. Antarmuka dalam **Bahasa Indonesia**.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind · Recharts ·
Prisma + **PostgreSQL** (Docker) · Claude Haiku · Midtrans (mock) · auth
berbasis JWT cookie (`jose`) dengan Google OAuth.

## Menjalankan

```bash
docker compose up -d   # PostgreSQL di host port 5433
npm install            # juga menjalankan `prisma generate`
cp .env.example .env   # opsional — default sudah jalan tanpa kredensial
npm run db:push        # buat tabel di Postgres
npm run dev            # http://localhost:3000
```

Tanpa kredensial apa pun aplikasi tetap berjalan penuh: **demo login**, **mock
parser**, dan **mock Midtrans**. Masuk dengan email mana saja di mode demo;
masuk sebagai `ctlvechocolatoz@gmail.com` untuk **akun master** (semua fitur).

> DB lokal lewat [docker-compose.yml](docker-compose.yml) (Postgres di host port
> **5433** agar tidak bentrok dengan Postgres lain di 5432). Hentikan dengan
> `docker compose down` (tambah `-v` untuk menghapus datanya).
>
> **Lihat data via IntelliJ** (Database tool): Host `localhost`, Port `5433`,
> Database `spendwise`, User `spendwise`, Password `spendwise`.

## Fitur & cakupan PRD

| Fitur | Lokasi |
| --- | --- |
| Chat catat pengeluaran (Workflow A) | [ChatPanel.tsx](src/components/ChatPanel.tsx) → `POST /api/parse` |
| Kartu struk **Edit / Konfirmasi** | [ReceiptCard.tsx](src/components/ReceiptCard.tsx) |
| Input suara | Web Speech API (`id-ID`) di ChatPanel |
| Dashboard, pie + grafik harian, filter (Workflow B) | [Dashboard.tsx](src/components/Dashboard.tsx) |
| 🔴 merah / 🟢 hijau batang anggaran | [DailyBars.tsx](src/components/charts/DailyBars.tsx) |
| **Edit & hapus** transaksi | [EditTransactionModal.tsx](src/components/EditTransactionModal.tsx) |
| Saran Efisiensi AI (Workflow C) | [InsightsPanel.tsx](src/components/InsightsPanel.tsx) → `POST /api/analyze` |
| Login Google + demo | [login/page.tsx](src/app/login/page.tsx), [lib/google.ts](src/lib/google.ts) |
| Halaman harga + trial gratis | [pricing/page.tsx](src/app/pricing/page.tsx), [lib/plans.ts](src/lib/plans.ts) |
| Profil akun | [account/page.tsx](src/app/account/page.tsx) |
| Akun master (semua fitur) | `MASTER_EMAIL` di [lib/plans.ts](src/lib/plans.ts) |
| Pembayaran Midtrans (mock) | [lib/midtrans.ts](src/lib/midtrans.ts), [api/billing](src/app/api/billing) |
| Mode terang/gelap | [ThemeProvider.tsx](src/components/ThemeProvider.tsx) |

## Paket & batas trial

Didefinisikan di [src/lib/plans.ts](src/lib/plans.ts):

- **Gratis** — 5 parsing AI/hari, 1 analisa AI/hari, filter mingguan/bulanan.
- **Pro** (Rp 49.000/bln) — AI tanpa batas, deteksi langganan/benchmark, filter
  rentang tanggal kustom, ekspor CSV.
- **Master** (`ctlvechocolatoz@gmail.com`) — semua fitur terbuka tanpa batas.

Batas trial ditegakkan per hari di server ([lib/usage.ts](src/lib/usage.ts)).

## Efisiensi token Claude Haiku

Parsing memakai `claude-haiku-4-5` dengan teknik hemat token (lihat
[lib/ai.ts](src/lib/ai.ts)):

- **Tool use** (`tool_choice` paksa) → keluaran terstruktur, tanpa token prosa.
- **System prompt ringkas + `cache_control`** agar prefix bisa di-cache.
- **`max_tokens` kecil** (200 untuk parse) dan hanya 1 ucapan dikirim (tanpa
  riwayat).
- **Analisa** mengirim ringkasan teragregasi, bukan seluruh baris transaksi.
- Otomatis **fallback ke parser/insight lokal** bila tidak ada API key atau
  permintaan gagal — aplikasi tetap jalan.

## API

| Route | Fungsi |
| --- | --- |
| `POST /api/auth/google` · `/google/callback` · `/demo` · `/logout` | Autentikasi |
| `GET/PATCH /api/me` | Profil, entitlement, pemakaian, anggaran |
| `GET/POST /api/transactions`, `PATCH/DELETE /api/transactions/[id]` | CRUD transaksi |
| `POST /api/parse` | Parse pengeluaran (gated + dihitung) |
| `POST /api/analyze` | Insight AI (gated + dihitung) |
| `POST /api/billing/checkout` · `/webhook` | Pembayaran Midtrans (mock) |

Rute aplikasi dilindungi oleh [src/proxy.ts](src/proxy.ts) (middleware/proxy).

## Mengaktifkan integrasi nyata

- **Google OAuth** — isi `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`; tambahkan
  `${APP_URL}/api/auth/google/callback` sebagai redirect URI.
- **Claude Haiku** — isi `ANTHROPIC_API_KEY`.
- **Midtrans** — set `MIDTRANS_MOCK=false` + `MIDTRANS_SERVER_KEY`, lalu ganti
  isi `createTransaction()` di [lib/midtrans.ts](src/lib/midtrans.ts) dengan
  panggilan Snap API (kontrak webhook sudah sesuai Midtrans).
- **PostgreSQL produksi** — DB lokal sudah Postgres (Docker). Untuk produksi,
  arahkan `DATABASE_URL` ke Postgres terkelola/VPS, lalu jalankan migrasi:
  `npx prisma migrate deploy` (buat migrasi awal dengan `npx prisma migrate dev
  --name init`).
