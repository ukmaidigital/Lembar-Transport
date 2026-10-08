"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useApi } from "@/lib/use-api";
import { formatRupiah } from "@/lib/utils";
import { PageLoading } from "@/components/ui/spinner";

type PriceList = { classes: { code: string; name_id: string; name_en: string; example_vehicles: string; max_passengers: number; max_luggage: number }[]; rows: { zone: { id: number; code: string; name: string; description: string | null }; prices: Record<string, number | null> }[] };

export function PriceTable() {
  const { data, loading } = useApi<PriceList>("/public/tariffs");
  const t = useTranslations("prices");
  const locale = useLocale();
  if (loading || !data) return <PageLoading />;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2">{t("zone")}</th>
            {data.classes.map((c) => (
              <th key={c.code} className="px-3 py-2 text-right">{locale === "en" ? c.name_en : c.name_id}<div className="text-[10px] font-normal normal-case text-slate-400">{c.example_vehicles} · {c.max_passengers} pax</div></th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.zone.id} className="border-t border-slate-100">
              <td className="px-3 py-2"><b>{r.zone.code}</b> {r.zone.name}<div className="text-xs text-slate-500">{r.zone.description}</div></td>
              {data.classes.map((c) => <td key={c.code} className="px-3 py-2 text-right font-medium tabular-nums">{formatRupiah(r.prices[c.code])}</td>)}
              <td className="px-3 py-2 text-right"><Link href={`/pesan?zone=${r.zone.id}`} className="text-brand-600 font-semibold">{t("book")} →</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
