"use client";

import { useState } from "react";
import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import { formatRupiah, formatDateTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

type Policies = { bank_account?: { bank: string; number: string; holder: string } };

export default function TopUpPage() { return <DriverShell><Inner /></DriverShell>; }

function Inner() {
  const { meta } = useApi<unknown[]>("/driver/ledger?period=today");
  const { data: policies } = useApi<Policies>("/public/policies");
  const { data: topUps, reload } = useApi<{ id: number; amount: number; status: string; created_at: string; rejection_reason?: string | null }[]>("/driver/top-ups");
  const min = Number(meta?.top_up_min ?? 50000);
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "danger"; text: string } | null>(null);
  const bank = policies?.bank_account;
  async function submit() {
    if (!file) return;
    setBusy(true); setMsg(null);
    const fd = new FormData(); fd.append("amount", amount.replace(/\D/g, "")); fd.append("file", file);
    try { await api("/driver/top-ups", { method: "POST", body: fd }); setMsg({ tone: "good", text: "Top-up dikirim. Saldo bertambah setelah dikonfirmasi Finance." }); setAmount(""); setFile(null); reload(); } catch (e) { setMsg({ tone: "danger", text: errorMessage(e) }); } finally { setBusy(false); }
  }
  return (
    <>
      <DriverHeader title="Top-up saldo" back="/driver/pendapatan" />
      {bank && (
        <div className="card mb-3 text-sm">
          <div className="mb-1 font-semibold">Transfer ke rekening Lembar Transport</div>
          <div className="flex justify-between"><span className="text-slate-500">Bank</span><b>{bank.bank}</b></div>
          <div className="flex justify-between"><span className="text-slate-500">No. rekening</span><b>{bank.number}</b></div>
          <div className="flex justify-between"><span className="text-slate-500">Atas nama</span><b>{bank.holder}</b></div>
          <p className="mt-2 text-xs text-slate-500">Tulis nama Anda di berita transfer. Minimum top-up {formatRupiah(min)}.</p>
        </div>
      )}
      <div className="card mb-3 flex flex-col gap-2">
        <label className="label">Jumlah transfer</label>
        <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(min)} />
        <div className="flex gap-2">{[50000, 100000, 200000].map((v) => <button key={v} type="button" className="rounded-full border px-3 py-1 text-xs" onClick={() => setAmount(String(v))}>{formatRupiah(v)}</button>)}</div>
        <label className="label mt-1">Bukti transfer (JPG/PNG/PDF ≤ 5 MB)</label>
        <input type="file" accept="image/jpeg,image/png,application/pdf" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <button className="btn-driver" disabled={busy || !file || Number(amount.replace(/\D/g, "")) < min} onClick={submit}>{busy ? <Spinner /> : "Kirim bukti top-up"}</button>
      </div>
      <h2 className="mb-2 text-sm font-semibold">Riwayat top-up</h2>
      <div className="card divide-y !p-0 text-sm">
        {!topUps?.length ? <p className="p-3 text-slate-500">Belum ada top-up.</p> : topUps.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-3 py-2"><div><b>{formatRupiah(t.amount)}</b><div className="text-xs text-slate-500">{formatDateTime(t.created_at)}{t.rejection_reason ? ` · ${t.rejection_reason}` : ""}</div></div><Badge tone={t.status === "confirmed" ? "good" : t.status === "rejected" ? "danger" : "warn"}>{t.status === "confirmed" ? "Dikonfirmasi" : t.status === "rejected" ? "Ditolak" : "Menunggu"}</Badge></div>
        ))}
      </div>
    </>
  );
}
