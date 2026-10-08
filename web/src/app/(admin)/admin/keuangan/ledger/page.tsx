"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/shell";
import { Table, Th, Td, Tabs, Modal, Field, Toolbar } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import { qs } from "@/lib/admin";
import { formatRupiah, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

type Entry = { id: number; driver_id: number; type: string; amount: number; balance_after: number; note: string | null; created_at: string; driver?: { user?: { name: string } }; order?: { code: string } | null };
type Balance = { driver_id: number; name: string; balance: number; status: string };
type TopUp = { id: number; driver_id: number; driver_name: string; driver_phone: string; balance: number; amount: number; status: string; proof_url: string | null; created_at: string; rejection_reason: string | null };

export default function LedgerPage() { return <AdminShell title="Ledger & top-up"><Inner /></AdminShell>; }

function Inner() {
  const [tab, setTab] = useState<"topups" | "entries" | "balances">("topups");
  const [driverId, setDriverId] = useState("");
  const [type, setType] = useState("");
  const [topStatus, setTopStatus] = useState("pending_review");
  const { data: entries, meta, reload } = useApi<Entry[]>(`/admin/ledger${qs({ driver_id: driverId, type })}`);
  const { data: topUps, reload: reloadTopUps } = useApi<TopUp[]>(`/admin/top-ups?status=${topStatus}`, { poll: 30000 });
  const balances = (meta?.balances as Balance[] | undefined) ?? [];
  const threshold = Number(meta?.threshold ?? 0);
  const [adjust, setAdjust] = useState<{ driver_id: string; amount: string; note: string } | null>(null);
  const [view, setView] = useState<TopUp | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); } }

  return (
    <>
      <Tabs value={tab} onChange={setTab} items={[{ value: "topups", label: "Top-up", count: topStatus === "pending_review" ? topUps?.length : undefined }, { value: "entries", label: "Mutasi ledger" }, { value: "balances", label: "Saldo driver" }]} />
      {err && <Alert tone="danger" className="mb-3">{err}</Alert>}
      {tab === "topups" && (
        <>
          <Toolbar><Field label="Status"><select className="input !py-1.5" value={topStatus} onChange={(e) => setTopStatus(e.target.value)}><option value="pending_review">Menunggu</option><option value="confirmed">Dikonfirmasi</option><option value="rejected">Ditolak</option><option value="all">Semua</option></select></Field></Toolbar>
          <Table empty={!topUps?.length} head={<><Th>Driver</Th><Th className="text-right">Saldo saat ini</Th><Th className="text-right">Top-up</Th><Th>Diajukan</Th><Th>Status</Th><Th /></>}>
            {topUps?.map((t) => (
              <tr key={t.id}>
                <Td><b>{t.driver_name}</b><div className="text-xs text-slate-500">{t.driver_phone}</div></Td>
                <Td className={`text-right tabular-nums ${t.balance < threshold ? "text-red-700" : ""}`}>{formatRupiah(t.balance)}</Td>
                <Td className="text-right font-semibold tabular-nums">{formatRupiah(t.amount)}</Td>
                <Td>{formatDateTime(t.created_at)}</Td>
                <Td><Badge tone={t.status === "confirmed" ? "good" : t.status === "rejected" ? "danger" : "warn"}>{t.status}</Badge>{t.rejection_reason && <div className="text-[11px] text-slate-500">{t.rejection_reason}</div>}</Td>
                <Td>{t.status === "pending_review" && <button className="btn-admin !min-h-8 text-xs" onClick={() => setView(t)}>Review</button>}</Td>
              </tr>
            ))}
          </Table>
        </>
      )}
      {tab === "entries" && (
        <>
          <Toolbar>
            <Field label="Driver ID"><input className="input !w-28 !py-1.5" value={driverId} onChange={(e) => setDriverId(e.target.value)} /></Field>
            <Field label="Jenis"><select className="input !py-1.5" value={type} onChange={(e) => setType(e.target.value)}><option value="">Semua</option>{["trip_earning", "commission", "waiting_fee", "cancellation_compensation", "top_up", "payout", "adjustment"].map((t) => <option key={t}>{t}</option>)}</select></Field>
            <button className="btn-admin !min-h-9 text-xs" onClick={() => setAdjust({ driver_id: driverId, amount: "", note: "" })}>+ Penyesuaian manual</button>
          </Toolbar>
          <Table empty={!entries?.length} head={<><Th>Waktu</Th><Th>Driver</Th><Th>Jenis</Th><Th>Keterangan</Th><Th className="text-right">Jumlah</Th><Th className="text-right">Saldo</Th></>}>
            {entries?.map((e) => <tr key={e.id}><Td>{formatDateTime(e.created_at)}</Td><Td>{e.driver?.user?.name ?? `#${e.driver_id}`}</Td><Td>{e.type}</Td><Td>{e.note}{e.order ? ` · ${e.order.code}` : ""}</Td><Td className={`text-right tabular-nums ${e.amount < 0 ? "text-red-700" : "text-green-700"}`}>{formatRupiah(e.amount)}</Td><Td className="text-right tabular-nums">{formatRupiah(e.balance_after)}</Td></tr>)}
          </Table>
        </>
      )}
      {tab === "balances" && (
        <Table empty={!balances.length} head={<><Th>Driver</Th><Th>Status</Th><Th className="text-right">Saldo</Th><Th /></>}>
          {balances.map((b) => <tr key={b.driver_id} className={b.balance < threshold ? "bg-red-50/40" : ""}><Td>{b.name}</Td><Td>{b.status}</Td><Td className={`text-right tabular-nums ${b.balance < threshold ? "font-semibold text-red-700" : ""}`}>{formatRupiah(b.balance)}</Td><Td><button className="text-admin-600" onClick={() => { setDriverId(String(b.driver_id)); setTab("entries"); }}>Mutasi</button></Td></tr>)}
        </Table>
      )}
      <Modal open={Boolean(adjust)} onClose={() => setAdjust(null)} title="Penyesuaian ledger manual">
        {adjust && (
          <div className="flex flex-col gap-3">
            <Field label="Driver ID"><input className="input" value={adjust.driver_id} onChange={(e) => setAdjust({ ...adjust, driver_id: e.target.value })} /></Field>
            <Field label="Jumlah (negatif untuk potongan)"><input className="input" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} /></Field>
            <Field label="Alasan (wajib, masuk audit log)"><input className="input" value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} /></Field>
            <button className="btn-admin" disabled={busy || !adjust.driver_id || !adjust.amount || adjust.note.length < 3} onClick={() => run(async () => { await api("/admin/ledger/adjustments", { method: "POST", body: JSON.stringify({ driver_id: Number(adjust.driver_id), amount: Number(adjust.amount), note: adjust.note }) }); setAdjust(null); reload(); })}>{busy ? <Spinner /> : "Simpan"}</button>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(view)} onClose={() => setView(null)} title={`Top-up ${view?.driver_name ?? ""} · ${view ? formatRupiah(view.amount) : ""}`} wide>
        {view && (
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div>{view.proof_url ? (view.proof_url.includes(".pdf") ? <iframe src={view.proof_url} className="h-[480px] w-full rounded border" title="bukti" /> : <img src={view.proof_url} alt="bukti" className="max-h-[480px] w-full rounded border object-contain" />) : <p className="text-sm text-slate-500">Tanpa bukti</p>}</div>
            <div className="flex flex-col gap-3 text-sm">
              <p>Saldo saat ini <b>{formatRupiah(view.balance)}</b> → setelah konfirmasi <b>{formatRupiah(view.balance + view.amount)}</b>.</p>
              <button className="btn-success" disabled={busy} onClick={() => run(async () => { await api(`/admin/top-ups/${view.id}/confirm`, { method: "POST" }); setView(null); reloadTopUps(); reload(); })}>{busy ? <Spinner /> : "Konfirmasi top-up"}</button>
              <Field label="Alasan penolakan"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
              <button className="btn-danger" disabled={busy || reason.length < 3} onClick={() => run(async () => { await api(`/admin/top-ups/${view.id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }); setView(null); setReason(""); reloadTopUps(); })}>Tolak</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
