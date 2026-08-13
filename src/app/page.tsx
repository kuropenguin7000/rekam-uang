"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { clientAuth, firebaseConfigured } from "@/lib/firebaseClient";
import {
  BellIcon,
  CheckIcon,
  DashboardIcon,
  HomeIcon,
  InsightIcon,
  PlusIcon,
  SparkIcon,
  StatsIcon,
  UserIcon,
} from "@/components/icons";
import { BrandMark } from "@/components/Logo";
import { DemoApp } from "@/components/DemoApp";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";
import { markSignedIn } from "@/lib/signedInHint";
import { formatCurrency } from "@/lib/format";
import type { MessageKey } from "@/i18n/messages";

/**
 * The public landing page — the root route, and the first thing a new visitor
 * sees. The app itself lives at /app.
 *
 * Section ids are English (#features, #how-it-works) to match the route names;
 * only the visible copy is localised. Every below-the-fold block is wrapped in
 * <Reveal>, whose class starts invisible — so the <noscript> override and the
 * component's fail-opens are load-bearing, not decoration.
 */
export default function LandingPage() {
  const { t } = useI18n();
  // Undecided until Firebase answers. Drives the CTA wording only — the page
  // renders immediately either way, because making a new visitor wait on an
  // auth round-trip to read a marketing page is backwards.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!firebaseConfigured()) {
      setSignedIn(false);
      return;
    }
    return onAuthStateChanged(clientAuth(), (u) => {
      markSignedIn(!!u);
      setSignedIn(!!u);
      // Forward a live session to the app — but never when the visitor got
      // here with the back button. Redirecting then would make the landing
      // page unreachable for anyone signed in (see layout.tsx).
      if (u && !arrivedViaBackForward()) window.location.replace("/app");
    });
  }, []);

  const ctaHref = signedIn ? "/app" : "/login";
  const ctaLabel = signedIn ? t("land.openApp") : t("land.signIn");
  const heroCta = signedIn ? t("land.openApp") : t("land.ctaPrimary");

  return (
    <div className="flex min-h-screen flex-col">
      {/* .reveal starts invisible; without JS the observer never runs, so the
          whole page would be blank. Scripting off ⇒ everything visible. */}
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      <SiteHeader ctaHref={ctaHref} ctaLabel={ctaLabel} />

      <main className="flex-1">
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                              */}
        {/* ---------------------------------------------------------------- */}
        <section className="glow-hero grid-tex">
          <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16">
            <div className="grid items-center gap-12 md:grid-cols-[1.05fr_1fr] md:gap-8">
              <div className="animate-rise">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  {t("land.badge")}
                </span>

                <h1 className="mt-5 text-[36px] font-bold leading-[1.08] tracking-tight sm:text-[52px]">
                  <AccentedHeadline
                    full={t("land.heroTitle")}
                    accent={t("land.heroTitleAccent")}
                  />
                </h1>

                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted sm:text-[17px]">
                  {t("land.heroBody")}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-2.5">
                  <Link
                    href={ctaHref}
                    className="grad-primary rounded-[14px] px-6 py-3.5 text-sm font-semibold shadow-[0_14px_30px_-12px_rgb(79_70_229/0.8)] transition"
                  >
                    {heroCta}
                  </Link>
                  <a
                    href="#demo"
                    className="card px-6 py-3.5 text-sm font-semibold text-muted transition hover:text-foreground"
                  >
                    {t("land.ctaSecondary")}
                  </a>
                </div>

                <p className="mt-4 text-xs text-muted">{t("land.ctaNote")}</p>
              </div>

              {/* The real app on a real phone, built from the same .hero-grad
                  and .card the product uses — so the promise here and the first
                  screen after sign-in are visibly one thing. Floating chips are
                  md+ only, so they never risk bleeding past a narrow viewport. */}
              <div
                className="animate-rise mx-auto w-full max-w-[300px]"
                style={{ animationDelay: "120ms" }}
              >
                <div className="relative">
                  <PhoneMock />

                  <div
                    className="animate-float absolute -left-6 top-16 hidden md:block"
                    style={{ animationDelay: "0.2s" }}
                  >
                    <div className="card flex items-center gap-2 px-3 py-2 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.5)]">
                      <span
                        className="grid h-7 w-7 place-items-center rounded-lg text-sm"
                        style={{ background: "#f973161f" }}
                      >
                        🍽️
                      </span>
                      <span className="num text-[12px] font-semibold">
                        {formatCurrency(38_000)}
                      </span>
                    </div>
                  </div>

                  <div
                    className="animate-float absolute -right-5 bottom-24 hidden md:block"
                    style={{ animationDelay: "1.1s" }}
                  >
                    <span className="grad-chip flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold shadow-[0_18px_40px_-18px_rgb(79_70_229/0.7)]">
                      <PlusIcon className="h-3.5 w-3.5" /> 50rb
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Stat band                                                         */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <Reveal>
            <div className="card overflow-hidden">
              {/* gap-px over a border-coloured track draws clean 1px rules
                  between surface cells, at both 2- and 4-up. */}
              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                {STATS.map((s) => (
                  <div
                    key={s.key}
                    className="bg-surface px-3 py-7 text-center sm:py-8"
                  >
                    <p className="grad-text num text-[30px] font-bold leading-none sm:text-[36px]">
                      {s.value}
                    </p>
                    <p className="mt-2 text-[12px] font-medium text-muted">
                      {t(s.key)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Playable demo — the real screens, on throwaway in-memory data      */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="demo"
          className="scroll-anchor border-y border-border bg-surface/40 py-16 sm:py-24"
        >
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <Reveal>
              <Eyebrow>{t("land.eyebrowDemo")}</Eyebrow>
              <div className="mt-3 max-w-xl">
                <h2 className="text-[27px] font-bold leading-tight tracking-tight sm:text-[36px]">
                  {t("land.demoTitle")}
                </h2>
                <p className="mt-3.5 text-[15px] leading-relaxed text-muted">
                  {t("land.demoBody")}
                </p>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="mt-9">
                <DemoApp />
              </div>
            </Reveal>

            <Reveal delay={140}>
              <p className="mx-auto mt-6 max-w-md text-center text-[12.5px] leading-relaxed text-muted">
                {t("land.demoFootnote")}
              </p>
              <div className="mt-4 flex justify-center">
                <Link
                  href={ctaHref}
                  className="grad-primary rounded-[14px] px-6 py-3 text-sm font-semibold transition"
                >
                  {heroCta}
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Features — a bento grid where each cell shows the feature          */}
        {/* ---------------------------------------------------------------- */}
        <section id="features" className="scroll-anchor py-16 sm:py-24">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <Reveal>
              <Eyebrow>{t("land.eyebrowFeatures")}</Eyebrow>
              <div className="mt-3 max-w-xl">
                <h2 className="text-[27px] font-bold leading-tight tracking-tight sm:text-[36px]">
                  {t("land.featTitle")}
                </h2>
                <p className="mt-3.5 text-[15px] leading-relaxed text-muted">
                  {t("land.featBody")}
                </p>
              </div>
            </Reveal>

            <div className="mt-10 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-6">
              {FEATURES.map((f, i) => (
                <FeatureCard
                  key={f.title}
                  color={f.color}
                  icon={f.icon}
                  title={t(f.title)}
                  body={t(f.body)}
                  span={f.span}
                  featured={f.featured}
                  visual={f.visual}
                  delay={i * 60}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* How it works                                                      */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="how-it-works"
          className="scroll-anchor border-y border-border bg-surface/40 py-16 sm:py-24"
        >
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <Reveal>
              <Eyebrow>{t("land.eyebrowHow")}</Eyebrow>
              <h2 className="mt-3 text-[27px] font-bold leading-tight tracking-tight sm:text-[36px]">
                {t("land.howTitle")}
              </h2>
            </Reveal>

            <ol className="mt-10 grid gap-3.5 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 90} className="h-full">
                  <li className="card lift h-full p-5">
                    <div className="flex items-center gap-3">
                      <span className="grad-primary num grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold">
                        {i + 1}
                      </span>
                      <span className="h-px flex-1 rounded-full bg-border" />
                    </div>
                    <h3 className="mt-4 text-[15px] font-semibold">
                      {t(s.title)}
                    </h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                      {t(s.body)}
                    </p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Trust                                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <Reveal>
              <Eyebrow>{t("land.eyebrowTrust")}</Eyebrow>
              <h2 className="mt-3 text-[27px] font-bold leading-tight tracking-tight sm:text-[36px]">
                {t("land.trustTitle")}
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-3.5 md:grid-cols-3">
              {TRUST.map((tr, i) => (
                <Reveal key={tr.title} delay={i * 70} className="h-full">
                  <div className="card lift h-full p-5">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-success-soft text-success">
                      <CheckIcon className="h-[18px] w-[18px]" />
                    </span>
                    <h3 className="mt-4 text-[15px] font-semibold">
                      {t(tr.title)}
                    </h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                      {t(tr.body)}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Closing CTA                                                       */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
          <Reveal>
            {/* No absolutely-positioned children inside this rounded box — a
                stray one escaping is what once scrolled iOS sideways. */}
            <div className="hero-grad rounded-[28px] px-6 py-16 text-center">
              <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
                <BrandMark className="h-8 w-8" />
              </span>
              <h2 className="text-[27px] font-bold leading-tight tracking-tight sm:text-[36px]">
                {t("land.finalTitle")}
              </h2>
              <p className="mx-auto mt-3.5 max-w-md text-[15px] leading-relaxed opacity-90">
                {t("land.finalBody")}
              </p>
              <Link
                href={ctaHref}
                className="mt-8 inline-block rounded-[14px] bg-white px-7 py-3.5 text-sm font-bold text-[#4f46e5] shadow-lg transition hover:opacity-90"
              >
                {heroCta}
              </Link>
              <p className="mt-4 text-[12px] opacity-80">{t("land.ctaNote")}</p>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border py-9">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-7 w-7 shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">Rekam Uang</p>
              <p className="text-[11px] text-muted">{t("land.footerTagline")}</p>
            </div>
          </div>
          <div className="flex items-center gap-5 sm:ms-auto">
            <Link
              href="/terms"
              className="text-[12.5px] font-medium text-muted transition hover:text-foreground"
            >
              {t("login.termsLink")}
            </Link>
            <Link
              href={ctaHref}
              className="text-[12.5px] font-semibold text-primary transition hover:underline"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * True when this document was reached with the back/forward buttons, in which
 * case any "helpful" redirect would be undoing what the visitor just asked for.
 */
function arrivedViaBackForward(): boolean {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    return nav?.type === "back_forward";
  } catch {
    return false;
  }
}

function SiteHeader({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  const { t } = useI18n();
  // The header is transparent over the hero and grows a hairline + blur once
  // the page moves, so it never draws a line across the artwork at rest.
  //
  // `border-b` stays on permanently and only the COLOUR changes. Toggling the
  // border on instead flashed a white line across the header: with no colour
  // class the border falls back to currentColor (the near-white foreground in
  // dark mode), and `transition-colors` animates border-color — so the width
  // snapped 0→1px at full text colour and then faded to var(--border).
  // Always give a transitioned border an explicit colour on BOTH sides.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 border-b transition-colors duration-200 ${
        stuck
          ? "border-border bg-background/85 backdrop-blur"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark className="h-8 w-8 shrink-0" />
          <span className="text-[15px] font-bold">Rekam Uang</span>
        </Link>

        <nav className="ms-auto hidden items-center gap-1 sm:flex">
          <a
            href="#demo"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-foreground"
          >
            {t("land.navDemo")}
          </a>
          <a
            href="#features"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-foreground"
          >
            {t("land.navFeatures")}
          </a>
          <a
            href="#how-it-works"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-foreground"
          >
            {t("land.navHow")}
          </a>
        </nav>

        <div className="ms-auto flex items-center gap-2 sm:ms-3">
          <LanguageSwitcher />
          <Link
            href={ctaHref}
            className="grad-primary rounded-xl px-4 py-2 text-sm font-semibold transition"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Fade-and-rise a block the first time it scrolls into view. */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // `.reveal` starts at opacity 0, so every path that ends without the class
    // being added is a permanently blank section. Fail open, twice over:
    //   1. no IntersectionObserver at all → just show it;
    //   2. already within the viewport at mount → show it without waiting for
    //      a callback, since an observer that only fires on *change* would
    //      leave above-the-fold blocks hidden until the visitor scrolls.
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }
    if (el.getBoundingClientRect().top < window.innerHeight) {
      el.classList.add("is-visible");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          el.classList.add("is-visible");
          io.unobserve(e.target); // one-way: re-hiding on scroll-up is nauseating
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
      {children}
    </span>
  );
}

/**
 * Paint one phrase of the headline in the brand gradient. Falls back to the
 * plain headline when the accent phrase isn't found (a translation may word
 * it differently), rather than dropping text on the floor.
 */
function AccentedHeadline({ full, accent }: { full: string; accent: string }) {
  const at = accent ? full.indexOf(accent) : -1;
  if (at === -1) return <>{full}</>;
  return (
    <>
      {full.slice(0, at)}
      <span className="grad-text">{accent}</span>
      {full.slice(at + accent.length)}
    </>
  );
}

/* --------------------------------------------------------------------------
   Feature bento
   -------------------------------------------------------------------------- */

function FeatureCard({
  color,
  icon,
  title,
  body,
  span,
  featured,
  visual,
  delay,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  span: string;
  featured?: boolean;
  visual: React.ReactNode;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className={`${span} h-full`}>
      <div
        className={`lift flex h-full flex-col rounded-[20px] p-5 ${
          featured ? "grad-outline" : "card"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px]"
            style={{ background: color + "1f", color }}
          >
            {icon}
          </span>
          <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
        </div>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">{body}</p>
        {/* mt-auto floats the demo to the card's foot, so demos line up across
            a row even when the copy above them differs in length. */}
        <div className="mt-auto pt-4">{visual}</div>
      </div>
    </Reveal>
  );
}

/** Quick-amount chips + category tiles — the add sheet, in miniature. */
function ChipsVisual() {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {["25rb", "50rb", "100rb", "250rb"].map((a, i) => (
          <span
            key={a}
            className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold ${
              i === 1 ? "grad-chip" : "bg-surface-muted text-muted"
            }`}
          >
            {a}
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        {CATS.map(([e, c]) => (
          <span
            key={e}
            className="grid h-9 w-9 place-items-center rounded-xl text-[15px]"
            style={{ background: c + "1f" }}
          >
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A conic budget ring — the "how much is left" answer, at a glance. */
function RingVisual() {
  const { t } = useI18n();
  const pct = 63;
  return (
    <div className="flex items-center gap-4">
      <div
        className="relative h-[68px] w-[68px] shrink-0 rounded-full"
        style={{
          background: `conic-gradient(#4f46e5 ${pct * 3.6}deg, var(--surface-muted) 0deg)`,
        }}
      >
        <div className="absolute inset-[7px] grid place-items-center rounded-full bg-surface">
          <span className="num text-[13px] font-bold">{pct}%</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted">{t("home.remaining")}</p>
        <p className="num text-[16px] font-bold">{formatCurrency(3_150_000)}</p>
        <div className="mt-1.5 flex gap-1">
          {["#4f46e5", "#0ea5e9", "#f97316", "#22c55e"].map((c) => (
            <span
              key={c}
              className="h-1.5 w-6 rounded-full"
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A spending heatmap, exactly like the one on the Statistik screen. */
function HeatmapVisual() {
  return (
    <div className="grid grid-cols-7 gap-1">
      {HEAT.map((v, i) => {
        const bg =
          v === 0
            ? "var(--surface-muted)"
            : v >= 5
              ? "var(--danger)"
              : `rgb(79 70 229 / ${0.16 * v + 0.12})`;
        return (
          <span
            key={i}
            className="aspect-square rounded-[5px]"
            style={{ background: bg }}
          />
        );
      })}
    </div>
  );
}

/**
 * Two "generated insight" rows — abstract placeholder bars on purpose. Real
 * copy here would be untranslated, and the product must never imply AI: these
 * are plain rules, so we show the shape, not invented sentences.
 */
function InsightVisual() {
  const rows: [string, number][] = [
    ["#f97316", 74],
    ["#4f46e5", 58],
  ];
  return (
    <div className="space-y-2">
      {rows.map(([c, w], i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 rounded-xl bg-surface-muted p-2.5"
        >
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
            style={{ background: c + "26", color: c }}
          >
            <SparkIcon className="h-3.5 w-3.5" />
          </span>
          <div className="flex-1 space-y-1.5">
            <div
              className="h-1.5 rounded-full bg-foreground/15"
              style={{ width: `${w}%` }}
            />
            <div className="h-1.5 w-1/2 rounded-full bg-foreground/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Family-member pills, plus the "add your own" affordance. */
function MembersVisual() {
  const members: [string, string][] = [
    ["👨", "#4f46e5"],
    ["👩", "#ec4899"],
    ["🧒", "#0ea5e9"],
    ["👥", "#22c55e"],
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {members.map(([e, c]) => (
        <span
          key={e}
          className="grid h-9 w-9 place-items-center rounded-full text-[15px]"
          style={{ background: c + "22" }}
        >
          {e}
        </span>
      ))}
      <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-border text-muted">
        <PlusIcon className="h-4 w-4" />
      </span>
    </div>
  );
}

/** Per-category spend bars — the Beranda bars, scaled down. */
/**
 * Six months of committed spending, with the step where an intro price lapses.
 * The shape is the point: a single "per month" figure hides that cliff.
 */
const OUTLOOK: [string, number][] = [
  ["Sep", 46],
  ["Okt", 46],
  ["Nov", 72],
  ["Des", 72],
  ["Jan", 100],
  ["Feb", 58],
];

function OutlookVisual() {
  return (
    <div className="flex h-[86px] items-end gap-1.5">
      {OUTLOOK.map(([m, h], i) => (
        <div key={m} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-[5px]"
            style={{
              height: `${h}%`,
              background: i === 4 ? "#14b8a6" : "rgb(20 184 166 / 0.45)",
            }}
          />
          <span className="text-[9px] text-muted">{m}</span>
        </div>
      ))}
    </div>
  );
}

/** Recurring-charge glyph for the commitments card. */
function RepeatIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function BarsVisual() {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {BARS.map(([e, c, p]) => (
        <div key={e} className="flex items-center gap-2.5">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs"
            style={{ background: c + "1f" }}
          >
            {e}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${p}%`, background: c }}
            />
          </div>
          <span className="num w-9 shrink-0 text-right text-[11px] font-semibold text-muted">
            {p}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
   The hero device — the real app screen inside a phone frame.
   -------------------------------------------------------------------------- */

function PhoneMock() {
  const { t } = useI18n();
  return (
    <div className="phone-frame mx-auto w-[268px]">
      <div className="phone-screen">
        {/* status bar */}
        <div className="flex items-center justify-between px-5 pb-1 pt-3 text-[10px] font-semibold text-muted">
          <span className="num">9:41</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-muted/60" />
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted/60" />
            <span className="inline-block h-2 w-4 rounded-[3px] bg-muted/60" />
          </span>
        </div>

        {/* app content */}
        <div className="px-3.5 pb-2">
          <div className="mb-2.5 flex items-center gap-2 px-1 pt-1">
            <BrandMark className="h-6 w-6" />
            <span className="text-[12px] font-bold">Rekam Uang</span>
            <BellIcon className="ms-auto h-4 w-4 text-muted" />
          </div>

          <div className="hero-grad rounded-[16px] p-3.5">
            <p className="text-[10px] opacity-80">{t("home.remaining")}</p>
            <p className="num mt-0.5 text-[26px] font-bold leading-none tracking-tight">
              {formatCurrency(3_150_000)}
            </p>
            <p className="mt-2 text-[9.5px] opacity-80">
              {t("land.mockUsed", {
                used: formatCurrency(1_850_000),
                budget: formatCurrency(5_000_000),
              })}
            </p>
            {/* Plain flow child of the padded box — no absolute positioning,
                nothing for a rounded parent to fail to clip. */}
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full w-[37%] rounded-full bg-white/90" />
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <MockStat label={t("land.mockToday")} value={formatCurrency(145_000)} />
            <MockStat label={t("land.mockWeek")} value={formatCurrency(820_000)} />
          </div>

          <div className="mt-2.5 space-y-2">
            <MockRow icon="🍽️" color="#f97316" name="Warung Padang" amount={formatCurrency(38_000)} />
            <MockRow icon="🚗" color="#0ea5e9" name="Bensin" amount={formatCurrency(100_000)} />
            <MockRow icon="🛒" color="#22c55e" name="Indomaret" amount={formatCurrency(87_500)} />
          </div>
        </div>

        {/* bottom nav — the real five tabs, with the raised + */}
        <div className="mt-1 flex items-center justify-around border-t border-border px-3 pb-3 pt-2">
          <HomeIcon className="h-[18px] w-[18px] text-primary" />
          <StatsIcon className="h-[18px] w-[18px] text-muted" />
          <span className="grad-primary -mt-4 grid h-9 w-9 place-items-center rounded-full shadow-lg">
            <PlusIcon className="h-4 w-4" />
          </span>
          <InsightIcon className="h-[18px] w-[18px] text-muted" />
          <UserIcon className="h-[18px] w-[18px] text-muted" />
        </div>
      </div>
    </div>
  );
}

const CATS: [string, string][] = [
  ["🍽️", "#f97316"],
  ["🚗", "#0ea5e9"],
  ["🛒", "#22c55e"],
  ["🏠", "#a855f7"],
  ["🎬", "#ec4899"],
];

// Four weeks of made-up spend intensity (0 = quiet, 5 = over the daily cap).
const HEAT = [
  1, 0, 2, 1, 3, 0, 1, 0, 2, 4, 1, 0, 2, 1, 3, 1, 0, 2, 5, 1, 0, 1, 2, 1, 0, 3,
  2, 4,
];

const BARS: [string, string, number][] = [
  ["🍽️", "#f97316", 78],
  ["🚗", "#0ea5e9", 54],
  ["🛒", "#22c55e", 41],
  ["🎬", "#a855f7", 23],
];

const STATS: { value: string; key: MessageKey }[] = [
  { value: "Rp0", key: "land.stat1" },
  { value: "3", key: "land.stat2" },
  { value: "2", key: "land.stat3" },
  { value: "0", key: "land.stat4" },
];

const FEATURES: {
  color: string;
  icon: React.ReactNode;
  title: MessageKey;
  body: MessageKey;
  span: string;
  featured?: boolean;
  visual: React.ReactNode;
}[] = [
  {
    color: "#4f46e5",
    icon: <PlusIcon className="h-5 w-5" />,
    title: "land.f1Title",
    body: "land.f1Body",
    span: "lg:col-span-3",
    featured: true,
    visual: <ChipsVisual />,
  },
  {
    color: "#0ea5e9",
    icon: <HomeIcon className="h-5 w-5" />,
    title: "land.f2Title",
    body: "land.f2Body",
    span: "lg:col-span-3",
    visual: <RingVisual />,
  },
  {
    color: "#a855f7",
    icon: <StatsIcon className="h-5 w-5" />,
    title: "land.f3Title",
    body: "land.f3Body",
    span: "lg:col-span-2",
    visual: <HeatmapVisual />,
  },
  {
    color: "#f97316",
    icon: <InsightIcon className="h-5 w-5" />,
    title: "land.f4Title",
    body: "land.f4Body",
    span: "lg:col-span-2",
    visual: <InsightVisual />,
  },
  {
    color: "#ec4899",
    icon: <UserIcon className="h-5 w-5" />,
    title: "land.f5Title",
    body: "land.f5Body",
    span: "sm:col-span-2 lg:col-span-2",
    visual: <MembersVisual />,
  },
  {
    color: "#22c55e",
    icon: <DashboardIcon className="h-5 w-5" />,
    title: "land.f6Title",
    body: "land.f6Body",
    span: "sm:col-span-2 lg:col-span-3",
    visual: <BarsVisual />,
  },
  {
    color: "#14b8a6",
    icon: <RepeatIcon className="h-5 w-5" />,
    title: "land.f7Title",
    body: "land.f7Body",
    span: "sm:col-span-2 lg:col-span-3",
    visual: <OutlookVisual />,
  },
];

const STEPS: { title: MessageKey; body: MessageKey }[] = [
  { title: "land.how1Title", body: "land.how1Body" },
  { title: "land.how2Title", body: "land.how2Body" },
  { title: "land.how3Title", body: "land.how3Body" },
];

const TRUST: { title: MessageKey; body: MessageKey }[] = [
  { title: "land.t1Title", body: "land.t1Body" },
  { title: "land.t2Title", body: "land.t2Body" },
  { title: "land.t3Title", body: "land.t3Body" },
];

function MockStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-surface-muted px-3 py-2.5">
      <p className="text-[10.5px] text-muted">{label}</p>
      <p className="num mt-0.5 text-[13.5px] font-bold">{value}</p>
    </div>
  );
}

function MockRow({
  icon,
  color,
  name,
  amount,
}: {
  icon: string;
  color: string;
  name: string;
  amount: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm"
        style={{ background: color + "22" }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{name}</span>
      <span className="num shrink-0 text-[12.5px] font-semibold">{amount}</span>
    </div>
  );
}
