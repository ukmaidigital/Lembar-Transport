"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/shell";
import { Table, Th, Td, Tabs, Modal, Field } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import { PAYMENT_STATUS_LABEL } from "@/lib/admin";
import { formatRupiah, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";

type Payment = { id: number; order_code: string; order_id: number; customer: string; phone: string; method: string; amount: number; order_total: number; status: string; proof_url: string | null; pickup_at: string | null; destination: string | null; payment_expires_at: string | null; rejection_reason: string | null; updated_at: string };
type Refund = { id: number; order_id: number; amount: number; method: string | null; reason: string | null; status: string; reference: string | null; created_at: string; order?: { code: string; guest_name: string; total: number } };

export default function PaymentsPage() { return <AdminShell title="Pembayaran"><Inner /></AdminShell>; }

function Inner() {
  const { can } = useAuth();
  const [tab, setTab] = useState<"pending_review" | "confirmed" | "rejected" | "all" | "refunds">("pending_review");
  const { data, meta, reload } = useApi<Payment[]>(tab === "refunds" ? null : `/admin/payments?status=${tab}`, { poll: 30000 });
  const { data: refunds, reload: reloadRefunds } = useApi<{ data: Refund[] }>(tab === "refunds" && can("payments.refund") ? "/admin/refunds" : null);
  const [view, setView] = useState<Payment | null>(null);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm(p: Payment) {
    setBusy(true); setErr(null);
    try { await api(`/admin/payments/${p.id}/confirm`, { method: "POST", body: JSON.stringify({ reference: reference || undefined }) }); setView(null); setReference(""); reload(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  async function reject(p: Payment) {
    setBusy(true); setErr(null);
    try { await api(`/admin/payments/${p.id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }); setView(null); setReason(""); reload(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  async function updateRefund(r: Refund, status: string) {
    setBusy(true); setErr(null);
    try { await api(`/admin/refunds/${r.id}`, { method: "PATCH", body: JSON.stringify({ status, reference: reference || undefined }) }); reloadRefunds(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  const refundList = refunds?.data ?? [];

  return (
    <>
      <Tabs value={tab} onChange={setTab} items={[{ value: "pending_review", label: "Menunggu review", count: tab === "pending_review" ? Number(meta?.total ?? 0) : undefined }, { value: "confirmed", label: "Dikonfirmasi" }, { value: "rejected", label: "Ditolak" }, { value: "all", label: "Semua" }, ...(can("payments.refund") ? [{ value: "refunds" as const, label: "Refund" }] : [])]} />
      {err && <Alert tone="danger" className="mb-3">{err}</Alert>}
      {tab !== "refunds" ? (
        <Table empty={!data?.length} head={<><Th>Pesanan</Th><Th>Customer</Th><Th>Metode</Th><Th className="text-right">Jumlah</Th><Th>Jemput</Th><Th>Batas bayar</Th><Th>Status</Th><Th /></>}>
          {data?.map((p) => (
            <tr key={p.id}>
              <Td><Link href={`/admin/pesanan/${p.order_code}`} className="font-mono text-admin-600">{p.order_code}</Link><div className="text-xs text-slate-500">{p.destination}</div></Td>
              <Td>{p.customer}<div className="text-xs text-slate-500">{p.phone}</div></Td>
              <Td>{p.method}</Td>
              <Td className="text-right tabular-nums">{formatRupiah(p.amount)}{p.amount !== p.order_total && <div className="text-[11px] text-amber-700">tarif {formatRupiah(p.order_total)}</div>}</Td>
              <Td>{formatDateTime(p.pickup_at)}</Td>
              <Td className={p.payment_expires_at && new Date(p.payment_expires_at) < new Date() ? "text-red-700" : ""}>{formatDateTime(p.payment_expires_at)}</Td>
              <Td><Badge tone={p.status === "confirmed" ? "good" : p.status === "rejected" || p.status === "expired" ? "danger" : "warn"}>{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</Badge>{p.rejection_reason && <div className="text-[11px] text-slate-500">{p.rejection_reason}</div>}</Td>
              <Td>{p.proof_url ? <button className="text-admin-600" onClick={() => setView(p)}>Lihat bukti</button> : <span className="text-xs text-slate-400">tanpa bukti</span>}</Td>
            </tr>
          ))}
        </Table>
      ) : (
        <Table empty={!refundList.length} head={<><Th>Pesanan</Th><Th className="text-right">Jumlah</Th><Th>Alasan</Th><Th>Status</Th><Th>Dibuat</Th><Th /></>}>
          {refundList.map((r) => (
            <tr key={r.id}>
              <Td><Link href={`/admin/pesanan/${r.order?.code}`} className="font-mono text-admin-600">{r.order?.code}</Link><div className="text-xs text-slate-500">{r.order?.guest_name}</div></Td>
              <Td className="text-right">{formatRupiah(r.amount)}</Td><Td>{r.reason}</Td>
              <Td><Badge tone={r.status === "processed" ? "good" : r.status === "failed" ? "danger" : "warn"}>{PAYMENT_STATUS_LABEL[r.status] ?? r.status}</Badge>{r.reference && <div className="text-[11px] text-slate-500">ref {r.reference}</div>}</Td>
              <Td>{formatDateTime(r.created_at)}</Td>
              <Td>{r.status === "pending" && <div className="flex items-center gap-2"><input className="input !w-32 !py-1 text-xs" placeholder="No. referensi" value={reference} onChange={(e) => setReference(e.target.value)} /><button className="btn-success !min-h-8 text-xs" disabled={busy} onClick={() => updateRefund(r, "processed")}>Diproses</button><button className="btn-ghost !min-h-8 text-xs" disabled={busy} onClick={() => updateRefund(r, "failed")}>Gagal</button></div>}</Td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={Boolean(view)} onClose={() => setView(null)} title={`Bukti transfer · ${view?.order_code ?? ""}`} wide>
        {view && (
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div>{view.proof_url?.includes(".pdf") ? <iframe src={view.proof_url} className="h-[520px] w-full rounded border" title="bukti" /> : <img src={view.proof_url ?? ""} alt="bukti transfer" className="max-h-[520px] w-full rounded border object-contain" />}</div>
            <div className="flex flex-col gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="flex justify-between"><span className="text-slate-500">Customer</span><b>{view.customer}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Tarif pesanan</span><b>{formatRupiah(view.order_total)}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Nominal dicatat</span><b>{formatRupiah(view.amount)}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Berita</span><b className="font-mono">{view.order_code}</b></div>
                <div className="flex justify-between"><span className="text-slate-500">Diunggah</span><span>{formatDateTime(view.updated_at)}</span></div>
              </div>
              <p className="text-xs text-slate-500">Cocokkan nominal, nama pengirim, dan berita transfer dengan mutasi rekening. Konfirmasi memicu dispatch otomatis dan notifikasi ke customer.</p>
              {view.status === "pending_review" && (
                <>
                  <Field label="Referensi mutasi (opsional)"><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
                  <button className="btn-success" disabled={busy} onClick={() => confirm(view)}>{busy ? <Spinner /> : "Konfirmasi pembayaran"}</button>
                  <Field label="Alasan penolakan"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: nominal tidak sesuai" /></Field>
                  <button className="btn-danger" disabled={busy || reason.trim().length < 3} onClick={() => reject(view)}>Tolak bukti</button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
