import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: { default: "Lembar Transport", template: "%s · Lembar Transport" },
  description: "Pesan mobil dari Pelabuhan Lembar, Lombok Barat, dengan harga pasti dan driver terverifikasi.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PublicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-white text-slate-900">
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
              <SiteFooter />
            </div>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
