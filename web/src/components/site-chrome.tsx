"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import NextLink from "next/link";
import { Ship } from "lucide-react";

export function LocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="flex items-center rounded-full border border-slate-300 text-xs">
      {(["id", "en"] as const).map((l) => (
        <button key={l} onClick={() => router.replace(pathname, { locale: l })}
          className={`rounded-full px-2.5 py-1 font-semibold ${locale === l ? "bg-slate-900 text-white" : "text-slate-500"}`} aria-pressed={locale === l}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function SiteHeader() {
  const t = useTranslations("nav");
  const { user, logout } = useAuth();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold"><span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-500 text-white"><Ship size={16} /></span>Lembar Transport</Link>
        <nav className="hidden items-center gap-5 text-sm text-slate-600 md:flex">
          <Link href="/harga">{t("prices")}</Link>
          <Link href="/pesanan">{t("track")}</Link>
          <Link href="/faq">{t("help")}</Link>
          <NextLink href="/driver" className="text-slate-500">{t("driverArea")}</NextLink>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {user && user.role === "customer" ? (
            <>
              <Link href="/akun" className="font-medium">{t("account")}</Link>
              <button onClick={logout} className="text-slate-500">{t("logout")}</button>
            </>
          ) : (
            <Link href="/masuk" className="font-medium">{t("login")}</Link>
          )}
          <LocaleSwitch />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
        <span>© {new Date().getFullYear()} Lembar Transport · {t("tagline")}</span>
        <nav className="flex flex-wrap gap-4">
          <Link href="/faq">{t("faq")}</Link>
          <Link href="/kebijakan-pembatalan">{t("cancellation")}</Link>
          <Link href="/syarat">{t("terms")}</Link>
          <Link href="/privasi">{t("privacy")}</Link>
          <span>{t("ops")}</span>
        </nav>
      </div>
    </footer>
  );
}
