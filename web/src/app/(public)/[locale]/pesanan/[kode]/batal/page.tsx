"use client";

import { use, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { api, errorMessage } from "@/lib/api";
import { useTicket } from "@/lib/ticket";
import { formatRupiah } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { PageLoading, Spinner } from "@/components/ui/spinner";
import { PhoneGate } from "@/components/phone-gate";

export default function CancelPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = use(params);
  const t = useTranslations("cancel");
  const locale = useLocale();
  const router = useRouter();
  const { order, meta, needGate, error, loading, reload, query } = useTicket(kode);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (needGate) return <PhoneGate error={error} onSubmit={(l4) => { sessionStorage.setItem(`ticket:${kode}`, l4); reload(); }} />;
  if (loading && !order) return <PageLoading />;
  if (!order || !meta) return <Alert tone="danger">{error}</Alert>;
  const c = meta.cancellation;
  async function confirm() {
    setBusy(true); setErr(null);
    try { await api(`/orders/${kode}/cancel${query}`, { method: "POST", locale, body: JSON.stringify({ reason }) }); router.push(`/pesanan/${kode}`); } catch (e) { setErr(errorMessage(e)); setBusy(false); }
  }
  return (
    <div className="card mx-auto flex max-w-xl flex-col gap-3">
      <h1 className="text-xl font-bold">{t("title")} · {order.code}</h1>
      {!c.cancellable ? <Alert tone="warn">{t("notCancellable")}</Alert> : (
        <>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between"><span>{t("hours", { h: c.hours_before_pickup })}</span><span>{c.fee_percent} %</span></div>
            <div className="flex justify-between font-semibold"><span>{t("fee")}</span><span>{formatRupiah(c.fee)}</span></div>
            <div className="flex justify-between"><span>{t("refund")}</span><span>{formatRupiah(c.refund)}</span></div>
          </div>
          <div><label className="label">{t("reason")}</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPh")} /></div>
          {err && <Alert tone="danger">{err}</Alert>}
          <div className="flex gap-2">
            <Link href={`/pesanan/${kode}`} className="btn-ghost flex-1">{t("keep")}</Link>
            <button className="btn-danger flex-1" disabled={busy || reason.trim().length < 3} onClick={confirm}>{busy ? <Spinner /> : t("confirm")}</button>
          </div>
        </>
      )}
    </div>
  );
}
