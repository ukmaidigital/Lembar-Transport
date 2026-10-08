import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SearchCard } from "@/components/search-card";
import { PopularPrices } from "@/components/popular-prices";
import { BadgeCheck, MapPin, Clock } from "lucide-react";

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  return (
    <div className="flex flex-col gap-10">
      <section className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-start">
        <div className="flex flex-col gap-4 pt-2">
          <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">{t("title")}</h1>
          <p className="text-slate-600">{t("subtitle")}</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm text-slate-700">
            <li className="flex items-center gap-2"><BadgeCheck size={18} className="text-brand-500" />{t("trust1")}</li>
            <li className="flex items-center gap-2"><MapPin size={18} className="text-brand-500" />{t("trust2")}</li>
            <li className="flex items-center gap-2"><Clock size={18} className="text-brand-500" />{t("trust3")}</li>
          </ul>
          <Link href="/qr" className="mt-2 text-sm font-semibold text-brand-600 underline">{t("instant")} →</Link>
        </div>
        <SearchCard />
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("popular")}</h2>
        <PopularPrices />
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="card">
            <div className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-600">{n}</div>
            <div className="font-semibold">{t(`step${n}` as "step1")}</div>
            <p className="mt-1 text-sm text-slate-600">{t(`step${n}d` as "step1d")}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
