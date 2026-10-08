"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, errorMessage } from "@/lib/api";
import { useTicket } from "@/lib/ticket";
import { formatDateTime, formatRupiah, formatTime } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { PageLoading, Spinner } from "@/components/ui/spinner";
import { PhoneGate } from "@/components/phone-gate";
import { MapPin, Phone, MessageCircle, Star } from "lucide-react";

const STEPS = ["created", "paid", "assigned", "en_route", "arrived", "on_trip", "completed"] as const;

export function TicketView({ code }: { code: string }) {
  const t = useTranslations("ticket");
  const locale = useLocale();
  const { order, meta, needGate, error, loading, reload, query } = useTicket(code);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (needGate) return <PhoneGate error={error} onSubmit={(l4) => { sessionStorage.setItem(`ticket:${code}`, l4); reload(); }} />;
  if (loading && !order) return <PageLoading />;
  if (!order) return <Alert tone="danger">{error}</Alert>;

  const steps = STEPS.filter((k) => k !== "paid" || order.payment_method !== "cash");
  const done = (k: string) => {
    if (k === "created") return true;
    if (k === "paid") return order.payment_status === "paid";
    const idx = ["assigned", "en_route", "arrived", "on_trip", "completed"];
    const cur = idx.indexOf(order.status);
    return cur >= idx.indexOf(k) && cur >= 0;
  };
  const terminal = ["cancelled", "expired", "no_show", "completed"].includes(order.status);

  async function docked() {
    setBusy(true); setActionError(null);
    try { await api(`/orders/${code}/docked${query}`, { method: "POST", locale }); reload(); } catch (e) { setActionError(errorMessage(e)); } finally { setBusy(false); }
  }
  const wa = order.driver?.phone ? `https://wa.me/${order.driver.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Halo, saya ${order.customer.name} (${order.code}).`)}` : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="text-xs text-slate-500">{t("code")}</div><div className="text-xl font-bold tracking-wide">{order.code}</div></div>
        <OrderStatusBadge status={order.status} locale={locale} />
      </div>
      {actionError && <Alert tone="danger">{actionError}</Alert>}
      {order.status === "pending_payment" && order.payment_expires_at && (
        <Alert tone="warn">{t("paymentDue", { time: formatDateTime(order.payment_expires_at, locale) })} · <Link href={`/pesanan/${code}/bayar`} className="font-semibold underline">{t("pay")}</Link></Alert>
      )}
      {order.payment_status === "pending_review" && <Alert tone="info">{locale === "en" ? "Payment proof under review" : "Bukti pembayaran sedang ditinjau Finance"}</Alert>}
      {["cancelled", "expired", "no_show"].includes(order.status) && (
        <Alert tone="danger">{order.status_label}{order.cancellation_reason ? ` · ${order.cancellation_reason}` : ""}{order.cancellation_fee > 0 ? ` · ${formatRupiah(order.cancellation_fee)}` : ""}</Alert>
      )}

      <div className="card">
        <div className="flex justify-between text-sm"><span>Lembar → <b>{order.destination?.name}</b></span><span className="font-semibold">{formatDateTime(order.pickup_at, locale)}</span></div>
        <div className="mt-1 text-xs text-slate-500">
          {order.vehicle_class?.name} · {order.passengers} {t("passengers").toLowerCase()} · {order.luggage_units} {t("luggage").toLowerCase()}
          {order.ferry.route && <> · {t("ferry")}: {order.ferry.route} · {t("etaRange")} {formatTime(order.ferry.eta_min_at)}–{formatTime(order.ferry.eta_max_at)}</>}
        </div>
        <ol className="mt-3 flex flex-col gap-2 text-sm">
          {steps.map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span className={`inline-block h-3 w-3 rounded-full border-2 ${done(k) ? "border-green-600 bg-green-600" : order.status === k ? "border-brand-500" : "border-slate-300"}`} />
              <span className={done(k) ? "" : "text-slate-400"}>{t(`h.${k}`)}</span>
              {order.timeline[`${k}_at`] && <span className="ml-auto text-xs text-slate-400">{formatTime(order.timeline[`${k}_at`])}</span>}
            </li>
          ))}
        </ol>
      </div>

      <div className="card">
        <div className="mb-2 text-sm font-semibold">{t("driverCard")}</div>
        {order.driver ? (
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 flex-none rounded-full bg-slate-200" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">{order.driver.name} <span className="font-normal text-slate-500"><Star size={12} className="inline text-amber-500" /> {Number(order.driver.rating_avg).toFixed(1)} · {t("trips", { n: order.driver.trips_completed })}</span></div>
              {order.driver.vehicle && <div className="text-slate-600">{order.driver.vehicle.brand} {order.driver.vehicle.model} {order.driver.vehicle.color ?? ""} · <b>{order.driver.vehicle.plate_number}</b></div>}
            </div>
          </div>
        ) : <p className="text-sm text-slate-500">{t("waitingDriver")}</p>}
        {order.driver?.phone && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a className="btn-ghost" href={wa ?? "#"} target="_blank" rel="noreferrer"><MessageCircle size={16} />{t("contactDriver")}</a>
            <a className="btn-ghost" href={`tel:${order.driver.phone}`}><Phone size={16} />{t("callDriver")}</a>
          </div>
        )}
      </div>

      {order.meeting_point && (
        <div className="card">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><MapPin size={16} className="text-brand-500" />{t("meeting")}: {order.meeting_point.name}</div>
          {order.meeting_point.photo_url && <img src={order.meeting_point.photo_url} alt="" className="mb-2 h-40 w-full rounded-lg object-cover" />}
          <p className="text-sm text-slate-600">{order.meeting_point.instructions}</p>
          <p className="mt-1 text-xs text-slate-500">{t("nameBoard", { name: order.customer.name.toUpperCase() })}</p>
        </div>
      )}

      {!terminal && order.status !== "pending_payment" && (
        order.ferry.docked_at ? <Alert tone="good">{t("dockedDone", { time: formatTime(order.ferry.docked_at) })}</Alert>
        : <div><button className="btn-primary btn w-full py-4 text-base" onClick={docked} disabled={busy || !meta?.docked_available}>{busy ? <Spinner /> : t("docked")}</button><p className="mt-1 text-center text-xs text-slate-500">{t("dockedHint")}</p></div>
      )}

      <div className="flex flex-wrap justify-center gap-4 text-sm">
        {order.status === "pending_payment" && <Link href={`/pesanan/${code}/bayar`} className="font-semibold text-brand-600">{t("pay")}</Link>}
        {meta?.cancellation.cancellable && <Link href={`/pesanan/${code}/batal`} className="text-red-700">{t("cancel")}</Link>}
        {order.status === "completed" && !order.rating && <Link href={`/pesanan/${code}/ulasan`} className="font-semibold text-brand-600">{t("rate")}</Link>}
        <Link href="/faq" className="text-slate-500">{t("help")}</Link>
      </div>
      <div className="text-right text-sm font-semibold">{t("total")}: {formatRupiah(order.total + order.waiting_fee)}</div>
    </div>
  );
}
