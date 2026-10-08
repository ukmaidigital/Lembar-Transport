import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { BookingWizard } from "@/components/booking-wizard";
import { PageLoading } from "@/components/ui/spinner";

export default async function BookPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Suspense fallback={<PageLoading />}><BookingWizard /></Suspense>;
}
