"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useApi } from "@/lib/use-api";
import { formatRupiah } from "@/lib/utils";

type PriceList = { classes: { code: string; name_id: string; name_en: string }[]; rows: { zone: { id: number; code: string; name: string }; prices: Record<string, number | null> }[] };

export function PopularPrices() {
  const { data } = useApi<PriceList>("/public/tariffs");
  const t = useTranslations("prices");
  const locale = useLocale();
  if (!data) return <div className="h-10 animate-pulse rounded-lg bg-slate-100" />;
  return (
    <div className="flex flex-wrap gap-2">
      {data.rows.slice(0, 6).map((r) => (
        <Link key={r.zone.id} href={`/pesan?zone=${r.zone.id}`} className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:border-brand-500">
          {r.zone.name} · <b>{formatRupiah(r.prices.mpv_standard)}</b>
        </Link>
      ))}
      <Link href="/harga" className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-600">{locale === "en" ? "All prices" : "Semua harga"} →</Link>
      <span className="sr-only">{t("zone")}</span>
    </div>
  );
}
