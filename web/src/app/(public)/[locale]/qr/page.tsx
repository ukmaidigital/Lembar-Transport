import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingWizard } from "@/components/booking-wizard";
import { PageLoading } from "@/components/ui/spinner";

export default async function QrPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("qr");
  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto max-w-2xl text-center"><h1 className="text-2xl font-bold">{t("title")}</h1><p className="text-sm text-slate-600">{t("subtitle")}</p></div>
      <Suspense fallback={<PageLoading />}><BookingWizard instant /></Suspense>
    </div>
  );
}
