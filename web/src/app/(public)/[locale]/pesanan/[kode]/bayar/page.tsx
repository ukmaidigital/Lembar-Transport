"use client";

import { use, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, errorMessage } from "@/lib/api";
import { useTicket } from "@/lib/ticket";
import { formatDateTime, formatRupiah } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { PageLoading, Spinner } from "@/components/ui/spinner";
import { PhoneGate } from "@/components/phone-gate";

export default function PayPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = use(params);
  const t = useTranslations("payment");
  const locale = useLocale();
  const { order, meta, needGate, error, loading, reload, query } = useTicket(kode);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (needGate) return <PhoneGate error={error} onSubmit={(l4) => { sessionStorage.setItem(`ticket:${kode}`, l4); reload(); }} />;
  if (loading && !order) return <PageLoading />;
  if (!order) return <Alert tone="danger">{error}</Alert>;
  const p = meta?.payment;

  async function upload() {
    if (!file) return;
    setBusy(true); setErr(null);
    const fd = new FormData(); fd.append("file", file);
    try { await api(`/orders/${kode}/payment-proof${query}`, { method: "POST", body: fd, locale }); setSent(true); reload(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  const copy = (v: string) => navigator.clipboard?.writeText(v);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-bold">{t("title")} · {order.code}</h1>
      {order.payment_status === "paid" && <Alert tone="good">{t("paid")}</Alert>}
      {order.payment_status === "pending_review" && !sent && <Alert tone="info">{t("reviewing")}</Alert>}
      {sent && <Alert tone="good">{t("sent")}</Alert>}
      {order.status === "pending_payment" && p && (
        <>
          <div className="card text-sm">
            <p className="mb-3 text-slate-600">{t("instructions")}</p>
            {[[t("bank"), p.bank], [t("account"), p.account_number], [t("holder"), p.account_holder], [t("amount"), formatRupiah(p.amount)], [t("note"), p.transfer_note]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-t py-2 first:border-0"><span className="text-slate-500">{k}</span><span className="flex items-center gap-2 font-semibold">{v}<button className="text-xs font-normal text-brand-600" onClick={() => copy(String(v))}>{t("copy")}</button></span></div>
            ))}
            {p.expires_at && <Alert tone="warn" className="mt-3">{locale === "en" ? "Pay before" : "Bayar sebelum"} <b>{formatDateTime(p.expires_at, locale)}</b></Alert>}
            <p className="mt-2 text-xs text-slate-500">{t("qris")}</p>
          </div>
          <div className="card flex flex-col gap-2">
            <div className="font-semibold">{t("upload")}</div>
            <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
            <p className="text-xs text-slate-500">{t("uploadHint")}</p>
            {err && <Alert tone="danger">{err}</Alert>}
            <button className="btn-primary" disabled={!file || busy} onClick={upload}>{busy ? <Spinner /> : t("submit")}</button>
          </div>
        </>
      )}
      <Link href={`/pesanan/${kode}`} className="text-center text-sm text-brand-600">← {locale === "en" ? "Back to ticket" : "Kembali ke tiket"}</Link>
    </div>
  );
}
