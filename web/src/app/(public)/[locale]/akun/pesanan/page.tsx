"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useApi } from "@/lib/use-api";
import type { Order } from "@/lib/ticket";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { PageLoading } from "@/components/ui/spinner";

export default function OrdersPage() {
  const t = useTranslations("account");
  const locale = useLocale();
  const { data, loading } = useApi<Order[]>("/orders");
  if (loading) return <PageLoading />;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <h1 className="text-xl font-bold">{t("orders")}</h1>
      {!data?.length ? <Empty title={t("noOrders")} action={<Link href="/pesan" className="btn-primary">{t("book")}</Link>} /> : data.map((o) => (
        <Link key={o.code} href={`/pesanan/${o.code}`} className="card flex items-center justify-between gap-3 hover:border-brand-500">
          <div><div className="font-semibold">{o.code} · Lembar → {o.destination?.name}</div><div className="text-xs text-slate-500">{formatDateTime(o.pickup_at, locale)} · {o.vehicle_class?.name}</div></div>
          <div className="text-right"><OrderStatusBadge status={o.status} locale={locale} /><div className="mt-1 text-sm font-semibold">{formatRupiah(o.total)}</div></div>
        </Link>
      ))}
    </div>
  );
}
