"use client";

import { use, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, errorMessage } from "@/lib/api";
import { useTicket } from "@/lib/ticket";
import { Alert } from "@/components/ui/alert";
import { PageLoading, Spinner } from "@/components/ui/spinner";
import { PhoneGate } from "@/components/phone-gate";
import { Star } from "lucide-react";

export default function RatingPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = use(params);
  const t = useTranslations("rating");
  const locale = useLocale();
  const { order, needGate, error, loading, reload, query } = useTicket(kode);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (needGate) return <PhoneGate error={error} onSubmit={(l4) => { sessionStorage.setItem(`ticket:${kode}`, l4); reload(); }} />;
  if (loading && !order) return <PageLoading />;
  if (!order) return <Alert tone="danger">{error}</Alert>;
  async function submit() {
    setBusy(true); setErr(null);
    try { await api(`/orders/${kode}/rating${query}`, { method: "POST", locale, body: JSON.stringify({ score, comment: comment || undefined }) }); setDone(true); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <div className="card mx-auto flex max-w-xl flex-col gap-3 text-center">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-sm text-slate-600">{order.driver?.name} · Lembar → {order.destination?.name}</p>
      {done || order.rating ? <Alert tone="good">{t("done")}</Alert> : (
        <>
          <div className="flex justify-center gap-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setScore(n)} aria-label={`${n}`}><Star size={36} className={n <= score ? "fill-amber-400 text-amber-400" : "text-slate-300"} /></button>)}</div>
          <textarea className="input" rows={3} placeholder={t("comment")} value={comment} onChange={(e) => setComment(e.target.value)} />
          {err && <Alert tone="danger">{err}</Alert>}
          <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? <Spinner /> : t("submit")}</button>
          <p className="text-xs text-slate-500">{t("window")}</p>
        </>
      )}
      <Link href={`/pesanan/${kode}`} className="text-sm text-brand-600">← {locale === "en" ? "Back to ticket" : "Kembali ke tiket"}</Link>
    </div>
  );
}
