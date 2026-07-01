# Rekam Uang — Pelacak Uang Berbasis Chat

Aplikasi pencatat **pemasukan & pengeluaran** untuk pasar Indonesia: ketik
transaksi dengan bahasa natural, AI mengklasifikasikan pemasukan/pengeluaran +
kategori, dashboard menampilkan **arus kas**, dan asisten AI **"Wawasan"** memberi
saran hemat. Antarmuka **Bahasa Indonesia** (dan Inggris).

> Nama produk **Rekam Uang**. Folder repo tetap `spend-wise` dan database/user/
> container Postgres tetap `spendwise` — itu identitas infrastruktur, sengaja
> tidak diubah.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind
v4 · Recharts · Prisma 6 + **PostgreSQL** (Docker) · `jose` (auth JWT-cookie) +
Google OAuth · **Google Gemini** (`@google/genai`) · exceljs + pdf-lib (ekspor) ·
Midtrans (mock).

## Prasyarat

- Node.js 20+
- Docker (untuk PostgreSQL lokal)

## Menjalankan

```bash
docker compose up -d      # PostgreSQL di host port 5433 (container spendwise-db)
npm install               # otomatis menjalankan `prisma generate` (postinstall)
cp .env.example .env      # lalu isi kredensial (lihat "Variabel lingkungan")
npm run db:push           # buat / selaraskan tabel di Postgres
npm run dev               # http://localhost:3000
```

> Gunakan `npm run dev`, **bukan** `npm start` — mode produksi memasang cookie
> `Secure` yang tidak bertahan di http polos saat pengembangan lokal.

### Kredensial minimum untuk masuk

- **Login membutuhkan Google OAuth** (login demo sudah dihapus). Isi
  `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`, lalu daftarkan
  `${APP_URL}/api/auth/google/callback` sebagai *Authorized redirect URI* di
  Google Cloud Console.
- **Gemini opsional** — tanpa `GEMINI_API_KEY`, aplikasi memakai parser/insight
  **lokal** (regex) sebagai fallback, jadi tetap berjalan penuh.
- **Midtrans di-mock** — biarkan `MIDTRANS_MOCK="true"` untuk alur pembayaran
  simulasi (tanpa penagihan nyata).
- **Akun master** — set `MASTER_EMAIL` ke emailmu untuk membuka semua fitur
  (setara Pro tanpa batas).

> DB lokal via [docker-compose.yml](docker-compose.yml) (Postgres di port **5433**
> agar tak bentrok dengan Postgres lain di 5432). Hentikan dengan
> `docker compose down` (tambah `-v` untuk menghapus datanya). Lihat data lewat
> `npm run db:studio`, atau IntelliJ Database — Host `localhost`, Port `5433`,
> Database/User/Password semuanya `spendwise`.

## Variabel lingkungan

Lihat [.env.example](.env.example) untuk template lengkap.

| Variabel | Wajib? | Fungsi |
| --- | --- | --- |
| `DATABASE_URL` | ya | Koneksi Postgres (default sudah cocok dengan docker-compose). |
| `AUTH_SECRET` | ya | Kunci tanda tangan JWT sesi (cookie `sw_session`). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ya (untuk login) | Kredensial Google OAuth. |
| `APP_URL` | ya | Base URL publik; menentukan redirect OAuth (mis. URL tunnel/deploy). |
| `MASTER_EMAIL` | opsional | Email akun master (semua fitur terbuka). |
| `GEMINI_API_KEY` (+ `_2`/`_3`, `GEMINI_API_KEYS`) | opsional | Parsing/analisa AI; kosong → fallback lokal. Beberapa key = failover otomatis. |
| `GEMINI_MODEL` | opsional | Default `gemini-2.5-flash`. |
| `MIDTRANS_MOCK` | ya | `"true"` untuk pembayaran simulasi. |
| `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` | opsional | Hanya bila `MIDTRANS_MOCK=false`. |

## Fitur

| Fitur | Lokasi |
| --- | --- |
| Chat catat transaksi (**pemasukan & pengeluaran**) | [ChatPanel.tsx](src/components/ChatPanel.tsx) → `POST /api/parse` |
| Kartu struk **Edit / Konfirmasi / Batal** | [ReceiptCard.tsx](src/components/ReceiptCard.tsx) |
| Dashboard arus kas (**Pemasukan / Pengeluaran / Selisih**), pie + grafik harian, filter periode | [Dashboard.tsx](src/components/Dashboard.tsx) |
| Anggaran bulanan **+ per-kategori** | [CategoryBudgets.tsx](src/components/CategoryBudgets.tsx) |
| **Kelola kategori** — rename/sembunyikan bawaan, tambah/edit/hapus custom | [CategoryManager.tsx](src/components/CategoryManager.tsx), [lib/categories.ts](src/lib/categories.ts) |
| Edit & hapus transaksi | [EditTransactionModal.tsx](src/components/EditTransactionModal.tsx) |
| **Notifikasi** (lonceng + log persisten) | [NotificationBell.tsx](src/components/NotificationBell.tsx), [lib/notifications.ts](src/lib/notifications.ts) |
| Wawasan AI (saran hemat) | [InsightsPanel.tsx](src/components/InsightsPanel.tsx) → `POST /api/analyze` |
| **Ekspor Excel / PDF / CSV** (Pro) | [ExportMenu.tsx](src/components/ExportMenu.tsx) → `GET /api/export`, [lib/export.ts](src/lib/export.ts) |
| Login Google + sesi JWT | [login/page.tsx](src/app/login/page.tsx), [lib/google.ts](src/lib/google.ts), [lib/session.ts](src/lib/session.ts) |
| Harga, langganan Pro, **perpanjangan & auto-downgrade** | [pricing/page.tsx](src/app/pricing/page.tsx), [api/billing](src/app/api/billing) |
| **Dwibahasa (ID/EN)** + tema terang/gelap | [I18nProvider.tsx](src/components/I18nProvider.tsx), [ThemeProvider.tsx](src/components/ThemeProvider.tsx) |

Rute aplikasi dilindungi oleh [src/proxy.ts](src/proxy.ts) (middleware Next 16);
rute publik: `/login`, `/pricing`, `/terms`.

## Paket & batas

Didefinisikan di [src/lib/plans.ts](src/lib/plans.ts):

- **Gratis** — 5 parsing AI/hari, 1 analisa AI/hari, filter mingguan & bulanan.
- **Pro** (Rp 49.000/bln atau Rp 490.000/thn) — parsing & analisa AI tanpa batas,
  deteksi langganan/benchmark, filter periode tanggal kustom, ekspor Excel/PDF/CSV.
- **Master** (`MASTER_EMAIL`) — semua fitur terbuka tanpa batas.

Batas ditegakkan per hari di server ([lib/usage.ts](src/lib/usage.ts)), plus cache
hasil per-signature, cooldown per-request, dan batas keras harian untuk semua.

## AI: Gemini + failover

Parsing & analisa memakai `gemini-2.5-flash` via `@google/genai` (lihat
[lib/ai.ts](src/lib/ai.ts)):

- **Keluaran JSON terstruktur** (`responseSchema`) dengan *thinking* dinonaktifkan
  → hemat token, tanpa prosa.
- **Failover multi-key** — membaca `GEMINI_API_KEY` + `_2`/`_3` (dan opsional
  `GEMINI_API_KEYS` dipisah koma). Saat kena kuota/limit (429), overload (503),
  atau key tak valid (401/403), otomatis berpindah ke key berikutnya.
- **Parse** mengklasifikasikan pemasukan vs pengeluaran, memilih kategori bawaan,
  mengekstrak merchant/sumber, dan menyelesaikan **tanggal relatif** ("kemarin",
  "senin kemarin", "3 hari lalu" …).
- **Analisa** mengirim ringkasan teragregasi, bukan seluruh baris transaksi.
- **Fallback lokal** ([lib/parser.ts](src/lib/parser.ts), [lib/insights.ts](src/lib/insights.ts))
  saat semua key gagal atau tidak diset — aplikasi tetap jalan.

## API

| Route | Fungsi |
| --- | --- |
| `POST /api/auth/google` · `/google/callback` · `POST /api/auth/logout` | Autentikasi Google + sesi |
| `GET/PATCH /api/me` | Profil, entitlement, pemakaian, anggaran, kategori |
| `GET/POST /api/transactions`, `PATCH/DELETE /api/transactions/[id]` | CRUD transaksi |
| `POST/PATCH/DELETE /api/categories` | Kelola kategori (custom + override bawaan) |
| `POST /api/parse` | Parse transaksi (gated + dihitung) |
| `POST /api/analyze` | Wawasan AI (gated + dihitung) |
| `GET /api/export` | Ekspor Excel/PDF/CSV (Pro) |
| `POST /api/billing/checkout` · `/webhook` · `/expire` | Pembayaran Midtrans (mock) + auto-downgrade |

## Mengaktifkan integrasi nyata

- **Google OAuth** — isi `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`; tambahkan
  `${APP_URL}/api/auth/google/callback` sebagai redirect URI.
- **Gemini** — isi `GEMINI_API_KEY` (dan `_2`/`_3` untuk failover). Ganti
  `GEMINI_MODEL` bila perlu.
- **Midtrans** — set `MIDTRANS_MOCK=false` + `MIDTRANS_SERVER_KEY`, lalu ganti isi
  `createTransaction()` di [lib/midtrans.ts](src/lib/midtrans.ts) dengan panggilan
  Snap API (kontrak webhook sudah sesuai Midtrans).
- **PostgreSQL produksi** — arahkan `DATABASE_URL` ke Postgres terkelola/VPS.
  Skema disinkronkan dengan `npx prisma db push` (proyek ini tanpa file migrasi).

## Berbagi & deploy

- **Sharing publik cepat** — Cloudflare quick tunnel:
  `cloudflared tunnel --url http://localhost:3000`. Tiap run memberi URL acak baru
  → perbarui `APP_URL`, restart dev, dan tambahkan ulang redirect URI Google.
- **Hosting gratis** — Vercel (app) + Neon (Postgres); perlu penyesuaian
  `binaryTargets`/`directUrl` Prisma dan redirect Google untuk URL deploy.
