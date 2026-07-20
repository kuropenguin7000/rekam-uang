"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeProvider";
import type { Locale } from "@/i18n/config";

interface TermsContent {
  title: string;
  updated: string;
  intro: string;
  sections: { h: string; p: string }[];
  back: string;
}

// Plain-language terms, colocated so the big prose stays out of the shared
// dictionary. Update the contact email and effective date to suit you.
const CONTENT: Record<Locale, TermsContent> = {
  id: {
    title: "Ketentuan Layanan",
    updated: "Berlaku sejak 26 Juni 2026",
    back: "Kembali",
    intro:
      "Selamat datang di Rekam Uang. Dengan membuat akun atau menggunakan aplikasi ini, kamu setuju dengan ketentuan di bawah. Jika kamu tidak setuju, mohon untuk tidak menggunakan layanan ini.",
    sections: [
      {
        h: "1. Tentang Layanan",
        p: "Rekam Uang adalah aplikasi pencatat pengeluaran pribadi. Kamu mencatat pengeluaran secara manual, melihat ringkasan di dashboard, dan mendapat saran hemat otomatis. Layanan disediakan apa adanya dan dapat berubah sewaktu-waktu.",
      },
      {
        h: "2. Akun & Masuk",
        p: "Kamu masuk menggunakan akun Google. Kamu bertanggung jawab atas keamanan akunmu dan semua aktivitas di dalamnya. Jaga kerahasiaan akun Google-mu.",
      },
      {
        h: "3. Data & Privasi",
        p: "Kami menyimpan data transaksi yang kamu catat serta informasi dasar dari Google (nama, email, foto profil). Kami tidak menjual datamu, dan kamu dapat menghapus transaksimu kapan saja di dalam aplikasi.",
      },
      {
        h: "4. Penggunaan yang Wajar",
        p: "Jangan menyalahgunakan layanan, mencoba merusaknya, atau menggunakannya untuk hal yang melanggar hukum.",
      },
      {
        h: "5. Penafian",
        p: "Rekam Uang adalah alat bantu anggaran, bukan nasihat keuangan. Saran otomatis bisa saja tidak akurat. Kami tidak bertanggung jawab atas keputusan yang kamu ambil berdasarkan aplikasi ini. Layanan disediakan tanpa jaminan apa pun.",
      },
      {
        h: "6. Perubahan",
        p: "Kami dapat memperbarui layanan dan ketentuan ini dari waktu ke waktu. Dengan terus menggunakan Rekam Uang, kamu dianggap menyetujui versi terbaru.",
      },
      {
        h: "7. Kontak",
        p: "Ada pertanyaan tentang ketentuan ini? Hubungi kami di support@rekamuang.app.",
      },
    ],
  },
  en: {
    title: "Terms of Service",
    updated: "Effective 26 June 2026",
    back: "Back",
    intro:
      "Welcome to Rekam Uang. By creating an account or using this app, you agree to the terms below. If you do not agree, please do not use the service.",
    sections: [
      {
        h: "1. About the Service",
        p: "Rekam Uang is a personal expense tracker. You log expenses manually, view a dashboard, and get automatic savings insights. The service is provided as-is and may change at any time.",
      },
      {
        h: "2. Accounts & Sign-in",
        p: "You sign in with your Google account. You are responsible for your account's security and all activity under it. Keep your Google account credentials safe.",
      },
      {
        h: "3. Data & Privacy",
        p: "We store the transactions you create and basic profile information from Google (name, email, avatar). We do not sell your data, and you can delete your transactions at any time inside the app.",
      },
      {
        h: "4. Acceptable Use",
        p: "Do not misuse the service, attempt to break it, or use it for anything unlawful.",
      },
      {
        h: "5. Disclaimer",
        p: "Rekam Uang is a budgeting aid, not financial advice. Automatic insights may be inaccurate. We are not liable for decisions you make based on the app. The service is provided without warranties of any kind.",
      },
      {
        h: "6. Changes",
        p: "We may update the service and these terms from time to time. Continuing to use Rekam Uang means you accept the latest version.",
      },
      {
        h: "7. Contact",
        p: "Questions about these terms? Reach us at support@rekamuang.app.",
      },
    ],
  },
};

export default function TermsPage() {
  const { locale } = useI18n();
  const c = CONTENT[locale] ?? CONTENT.id;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/login"
          className="text-sm font-medium text-muted hover:text-foreground"
        >
          ← {c.back}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <h1 className="text-2xl font-bold">{c.title}</h1>
      <p className="mt-1 text-xs text-muted">{c.updated}</p>
      <p className="mt-4 text-sm leading-relaxed text-foreground/80">{c.intro}</p>

      <div className="mt-6 space-y-5">
        {c.sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-sm font-semibold">{s.h}</h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
