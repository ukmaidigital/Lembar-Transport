import { getTranslations, setRequestLocale } from "next-intl/server";
import { PriceTable } from "@/components/price-table";

export default async function PricesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("prices");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-sm text-slate-600">{t("subtitle")}</p>
      <PriceTable />
    </div>
  );
}
