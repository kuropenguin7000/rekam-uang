import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { I18nProvider } from "@/components/I18nProvider";
import { DEFAULT_LOCALE, dirOf } from "@/i18n/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rekam Uang",
  description:
    "Catat pengeluaran dengan mudah. Dashboard visual, anggaran per kategori, dan saran hemat otomatis.",
};

// Tint the mobile browser chrome (iOS Safari's bottom address bar, Chrome's
// top bar) to the page background so there's no white seam between the toolbar
// and the page — the strip that flashed at the bottom until the toolbar
// auto-hid on scroll. Matches the --background tokens in globals.css. The
// media query tracks the OS theme, which is what the theme defaults to.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
};

// Set the theme class before paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('spendwise.theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

// "/" is the public landing page, so a signed-in visitor arriving there wants
// the app, not the pitch. Firebase resolves its session asynchronously — far
// too late to prevent the landing page painting first — so this reads the
// synchronous hint written by src/lib/signedInHint.ts and leaves before paint.
// Purely cosmetic: /app does the real auth check regardless (see signedInHint).
//
// The back_forward check is not optional. Without it this redirect fights the
// back button: pressing back from /app lands on "/", which instantly forwards
// to /app again, making the landing page unreachable for anyone signed in.
// A deliberate back/forward navigation always wins over the convenience hop.
const landingScript = `(function(){try{var p=location.pathname;if(p!=='/'&&p!=='/index.html')return;var n=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0]);var back=n?n.type==='back_forward':(performance.navigation&&performance.navigation.type===2);if(back)return;if(localStorage.getItem('sw_signed_in')==='1'){location.replace('/app');}}catch(e){}})();`;

// Static export: there is no request to read a locale cookie from, so the
// shell renders in the default locale and I18nProvider switches to the
// visitor's stored preference on the client right after hydration.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      dir={dirOf(DEFAULT_LOCALE)}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: landingScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider initialLocale={DEFAULT_LOCALE}>
          <ThemeProvider>{children}</ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
