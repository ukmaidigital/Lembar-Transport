"use client";

import { use, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/shell";
import { Modal, Field, Table, Th, Td } from "@/components/admin/ui";
import type { AdminOrder } from "@/components/admin/order-row";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import type { WaitingInfo } from "@/lib/driver";
import { PAYMENT_LABEL } from "@/lib/driver";
import type { TicketMeta } from "@/lib/ticket";
import { formatRupiah, formatDateTime, formatTime } from "@/lib/utils";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { PageLoading, Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";

type Candidate = { driver: { id: number; name: string; phone?: string; rating_avg: number; trips_completed: number; is_online: boolean; balance?: number; vehicle: { brand: string; model: string; plate_number: string; vehicle_class_name: string } | null }; eligible: boolean; reasons: string[]; score: number };
type ModalKind = "assign" | "unassign" | "cancel" | "docked" | "waiting" | "noshow" | null;

export default function OrderDetailPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = use(params);
  return <AdminShell title={`Pesanan ${kode}`}><Inner code={kode} /></AdminShell>;
}

function Inner({ code }: { code: string }) {
  const { can } = useAuth();
  const { data: o, meta, reload, loading } = useApi<AdminOrder>(`/admin/orders/${code}`, { poll: 20000 });
  const cancellation = (meta?.cancellation as TicketMeta["cancellation"] | undefined);
  const waiting = meta?.waiting as WaitingInfo | undefined;
  const [modal, setModal] = useState<ModalKind>(null);
  const { data: cands } = useApi<Candidate[]>(modal === "assign" ? `/admin/orders/${code}/eligible-drivers` : null);
  const [reason, setReason] = useState("");
  const [waive, setWaive] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [dockedAt, setDockedAt] = useState("");
  const [pick, setPick] = useState<Candidate | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (loading && !o) return <PageLoading />;
  if (!o) return <Alert tone="danger">Pesanan tidak ditemukan</Alert>;
  const terminal = ["completed", "cancelled", "expired", "no_show"].includes(o.status);

  async function run(fn: () => Promise<unknown>) { setBusy(true); setErr(null); try { await fn(); setModal(null); setReason(""); setPick(null); reload(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); } }
  const post = (path: string, body?: unknown, method = "POST") => api(`/admin/orders/${code}${path}`, { method, body: body ? JSON.stringify(body) : undefined });

  return (
    <div className="flex flex-col gap-4">
      {err && <Alert tone="danger">{err}</Alert>}
      {o.needs_attention && <Alert tone="danger"><b>Perlu perhatian:</b> dispatch otomatis belum menemukan driver (gelombang {o.dispatch?.wave}, siklus {o.dispatch?.cycle}). Tugaskan manual atau ulangi dispatch.{o.dispatch?.next_at && ` Percobaan berikutnya ${formatTime(o.dispatch.next_at)}.`}</Alert>}
      <div className="card flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold"><span className="font-mono">{o.code}</span><OrderStatusBadge status={o.status} /><Badge tone={o.payment_status === "paid" ? "good" : o.payment_status === "pending_review" ? "warn" : "neutral"}>{PAYMENT_LABEL[o.payment_method]} · {o.payment_status}</Badge></div>
          <div className="text-sm text-slate-600">Dibuat {formatDateTime(o.timeline.created_at)} · kanal {o.channel} · bahasa {o.locale}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("orders.assign") && !terminal && ["confirmed", "dispatching", "assigned"].includes(o.status) && <button className="btn-admin !min-h-9 text-xs" onClick={() => setModal("assign")}>{o.driver ? "Ganti driver" : "Tugaskan driver"}</button>}
          {can("orders.assign") && o.driver && ["assigned", "en_route", "arrived"].includes(o.status) && <button className="btn-ghost !min-h-9 text-xs" onClick={() => setModal("unassign")}>Lepas driver</button>}
          {can("orders.assign") && ["confirmed", "dispatching"].includes(o.status) && <button className="btn-ghost !min-h-9 text-xs" disabled={busy} onClick={() => run(() => post("/redispatch"))}>Ulangi dispatch</button>}
          {can("orders.manage") && !terminal && !o.ferry.docked_at && ["assigned", "en_route", "arrived", "confirmed", "dispatching"].includes(o.status) && <button className="btn-ghost !min-h-9 text-xs" onClick={() => setModal("docked")}>Tandai kapal sandar</button>}
          {can("orders.manage") && o.status === "arrived" && <button className="btn-ghost !min-h-9 text-xs" onClick={() => setModal("waiting")}>Setujui biaya tunggu</button>}
          {can("orders.manage") && o.status === "arrived" && <button className="btn-danger !min-h-9 text-xs" onClick={() => setModal("noshow")}>Konfirmasi no-show</button>}
          {can("orders.manage") && !terminal && <button className="btn-danger !min-h-9 text-xs" onClick={() => setModal("cancel")}>Batalkan</button>}
          <a href={o.ticket_url} target="_blank" rel="noreferrer" className="btn-ghost !min-h-9 text-xs">Tiket customer ↗</a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card text-sm">
          <div className="mb-2 font-semibold">Perjalanan</div>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1">
            <dt className="text-slate-500">Jemput</dt><dd><b>{formatDateTime(o.pickup_at)}</b></dd>
            {o.ferry.route && <><dt className="text-slate-500">Kapal</dt><dd>{o.ferry.route} ({o.ferry.operator})<br /><span className="text-xs text-slate-500">berangkat {formatDateTime(o.ferry.departure_at)} · sandar {formatTime(o.ferry.eta_min_at)}–{formatTime(o.ferry.eta_max_at)}</span></dd></>}
            <dt className="text-slate-500">Sandar</dt><dd>{o.ferry.docked_at ? `${formatTime(o.ferry.docked_at)} (${o.ferry.docked_source})` : <span className="text-slate-400">belum</span>}</dd>
            <dt className="text-slate-500">Titik temu</dt><dd>{o.meeting_point?.name}</dd>
            <dt className="text-slate-500">Tujuan</dt><dd>{o.destination?.name} <span className="text-xs text-slate-500">({o.destination?.zone}{o.destination?.duration_min_est ? ` · ±${o.destination.duration_min_est} menit` : ""})</span></dd>
            <dt className="text-slate-500">Kendaraan</dt><dd>{o.vehicle_class?.name} · {o.passengers} pax · {o.luggage_units} bagasi{o.child_seats ? ` · ${o.child_seats} child seat` : ""}{o.needs_roof_rack ? " · roof rack" : ""}</dd>
            {o.notes && <><dt className="text-slate-500">Catatan</dt><dd>{o.notes}</dd></>}
          </dl>
          {waiting && o.status === "arrived" && <div className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-900">Tunggu: jangkar {formatTime(waiting.anchor_at)} ({waiting.anchor_source}) · gratis s.d. {formatTime(waiting.free_until)} · lewat {waiting.minutes_beyond_free} menit → estimasi {formatRupiah(waiting.waiting_fee_estimate)} · no-show {waiting.no_show_available ? "sudah bisa" : `mulai ${formatTime(waiting.no_show_available_at)}`}</div>}
        </div>
        <div className="card text-sm">
          <div className="mb-2 font-semibold">Customer</div>
          <div><b>{o.customer.name}</b><div className="text-slate-600">{o.customer.phone} {o.customer.email && `· ${o.customer.email}`}</div></div>
          <div className="mb-2 mt-4 font-semibold">Driver</div>
          {o.driver ? <div><Link href={`/admin/driver/${o.driver.id}`} className="font-semibold text-admin-600">{o.driver.name}</Link> <span className="text-xs text-slate-500">★ {Number(o.driver.rating_avg).toFixed(1)} · {o.driver.trips_completed} trip</span><div className="text-slate-600">{o.driver.phone}</div>{o.driver.vehicle && <div className="text-xs text-slate-500">{o.driver.vehicle.brand} {o.driver.vehicle.model} · {o.driver.vehicle.plate_number}</div>}</div> : <span className="text-slate-400">Belum ditugaskan</span>}
          <div className="mb-2 mt-4 font-semibold">Harga</div>
          <div className="flex justify-between"><span>Dasar</span><span>{formatRupiah(o.price_breakdown.base)}</span></div>
          {o.price_breakdown.surcharges.map((s) => <div key={s.code} className="flex justify-between text-slate-600"><span>{s.label_id}</span><span>+ {formatRupiah(s.amount)}</span></div>)}
          {o.waiting_fee > 0 && <div className="flex justify-between text-slate-600"><span>Biaya tunggu</span><span>+ {formatRupiah(o.waiting_fee)}</span></div>}
          <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span>{formatRupiah(o.total + o.waiting_fee)}</span></div>
          {o.commission && <div className="flex justify-between text-xs text-slate-500"><span>Komisi {Math.round(Number(o.commission.rate) * 100)} % / bersih driver</span><span>{formatRupiah(o.commission.amount)} / {formatRupiah(o.commission.driver_net)}</span></div>}
          {o.cash_collected != null && <div className="flex justify-between text-xs text-slate-500"><span>Tunai dicatat</span><span>{formatRupiah(o.cash_collected)}</span></div>}
          {o.cancellation_fee > 0 && <div className="flex justify-between text-xs text-red-700"><span>Biaya pembatalan ({o.cancelled_by})</span><span>{formatRupiah(o.cancellation_fee)}</span></div>}
          {o.cancellation_reason && <div className="text-xs text-slate-500">Alasan: {o.cancellation_reason}</div>}
          {o.rating && <div className="mt-2 text-xs">Rating ★ {o.rating.score} {o.rating.comment && `· "${o.rating.comment}"`}</div>}
        </div>
        <div className="card text-sm">
          <div className="mb-2 font-semibold">Riwayat status</div>
          <ol className="relative ml-2 border-l border-slate-200 pl-4">
            {(o.histories ?? []).map((h, i) => <li key={i} className="mb-2"><span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-admin-500" /><div><b>{h.to}</b> <span className="text-xs text-slate-500">oleh {h.actor_type} · {formatDateTime(h.at)}</span></div>{h.reason && <div className="text-xs text-slate-600">{h.reason}</div>}</li>)}
          </ol>
          {o.issues && o.issues.length > 0 && (
            <>
              <div className="mb-2 mt-3 font-semibold">Laporan / masalah</div>
              <ul className="divide-y">{o.issues.map((i) => <li key={i.id} className="flex items-start justify-between gap-2 py-1.5"><div><Badge tone={i.status === "open" ? "danger" : "neutral"}>{i.type}</Badge><div className="text-xs">{i.message}</div><div className="text-[11px] text-slate-500">{formatDateTime(i.created_at)}</div></div>{i.status === "open" && can("orders.manage") && <button className="text-xs text-admin-600" disabled={busy} onClick={() => run(() => post(`/issues/${i.id}/resolve`))}>Selesai</button>}</li>)}</ul>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Tawaran dispatch</h2>
          <Table empty={!o.offers?.length} head={<><Th>Gelombang</Th><Th>Driver</Th><Th>Ditawarkan</Th><Th>Respons</Th></>}>
            {o.offers?.map((f) => <tr key={f.id}><Td>{f.wave}</Td><Td>{f.driver_name ?? `#${f.driver_id}`}</Td><Td>{formatTime(f.offered_at)}</Td><Td><Badge tone={f.response === "accepted" ? "good" : f.response === "declined" ? "danger" : "neutral"}>{f.response}</Badge></Td></tr>)}
          </Table>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Pembayaran</h2>
          <Table empty={!o.payments?.length} head={<><Th>Metode</Th><Th className="text-right">Jumlah</Th><Th>Status</Th><Th>Dibayar</Th></>}>
            {o.payments?.map((p) => <tr key={p.id}><Td>{p.method}</Td><Td className="text-right">{formatRupiah(p.amount)}</Td><Td><Badge tone={p.status === "confirmed" ? "good" : p.status === "rejected" ? "danger" : "warn"}>{p.status}</Badge></Td><Td>{formatDateTime(p.paid_at)}{p.rejection_reason && <div className="text-[11px] text-slate-500">{p.rejection_reason}</div>}</Td></tr>)}
          </Table>
        </div>
      </div>

      <Modal open={modal === "assign"} onClose={() => setModal(null)} title="Tugaskan driver" wide>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />Tampilkan driver yang tidak layak (override dengan alasan)</label>
          <Table empty={!cands?.length} head={<><Th>Driver</Th><Th>Kendaraan</Th><Th>Rating</Th><Th>Skor</Th><Th>Kelayakan</Th><Th /></>}>
            {cands?.filter((c) => showAll || c.eligible).map((c) => (
              <tr key={c.driver.id} className={pick?.driver.id === c.driver.id ? "bg-admin-50/50" : ""}>
                <Td><b>{c.driver.name}</b><div className="text-xs text-slate-500">{c.driver.is_online ? "online" : "offline"}</div></Td>
                <Td>{c.driver.vehicle ? `${c.driver.vehicle.brand} ${c.driver.vehicle.model}` : "–"}<div className="text-xs text-slate-500">{c.driver.vehicle?.plate_number} · {c.driver.vehicle?.vehicle_class_name}</div></Td>
                <Td>{Number(c.driver.rating_avg).toFixed(1)} <span className="text-xs text-slate-500">({c.driver.trips_completed})</span></Td>
                <Td>{c.score.toFixed(1)}</Td>
                <Td>{c.eligible ? <Badge tone="good">layak</Badge> : <span className="text-xs text-red-700">{c.reasons.join("; ")}</span>}</Td>
                <Td><button className="btn-ghost !min-h-8 text-xs" onClick={() => setPick(c)}>Pilih</button></Td>
              </tr>
            ))}
          </Table>
          {pick && (
            <div className="rounded-lg bg-slate-50 p-3">
              <div>Tugaskan <b>{pick.driver.name}</b> ke {o.code}{!pick.eligible && <span className="text-red-700"> (tidak layak: {pick.reasons.join("; ")})</span>}</div>
              {!pick.eligible && <Field label="Alasan override (wajib)" className="mt-2"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
              <button className="btn-admin mt-3" disabled={busy || (!pick.eligible && reason.length < 3)} onClick={() => run(() => post("/assign", { driver_id: pick.driver.id, override_reason: reason || undefined }))}>{busy ? <Spinner /> : "Konfirmasi penugasan"}</button>
            </div>
          )}
        </div>
      </Modal>
      <Modal open={modal === "unassign"} onClose={() => setModal(null)} title="Lepas driver dari pesanan">
        <div className="flex flex-col gap-3"><p className="text-sm text-slate-600">Driver dilepas dan pesanan kembali ke dispatch otomatis.</p><Field label="Alasan"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field><button className="btn-danger" disabled={busy || reason.length < 3} onClick={() => run(() => post("/unassign", { reason }))}>{busy ? <Spinner /> : "Lepas driver"}</button></div>
      </Modal>
      <Modal open={modal === "cancel"} onClose={() => setModal(null)} title="Batalkan pesanan">
        <div className="flex flex-col gap-3 text-sm">
          {cancellation && <div className="rounded bg-slate-50 p-3"><div className="flex justify-between"><span>{cancellation.hours_before_pickup} jam sebelum jemput</span><span>{cancellation.fee_percent} %</span></div><div className="flex justify-between font-semibold"><span>Biaya pembatalan</span><span>{formatRupiah(waive ? 0 : cancellation.fee)}</span></div><div className="flex justify-between"><span>Refund</span><span>{formatRupiah(waive ? cancellation.paid : cancellation.refund)}</span></div></div>}
          <label className="flex items-center gap-2"><input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} />Bebaskan biaya (force majeure / kesalahan operasional)</label>
          <Field label="Alasan (wajib)"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="btn-danger" disabled={busy || reason.length < 3} onClick={() => run(() => post("/cancel", { reason, waive_fee: waive }))}>{busy ? <Spinner /> : "Batalkan pesanan"}</button>
        </div>
      </Modal>
      <Modal open={modal === "docked"} onClose={() => setModal(null)} title="Tandai kapal sandar">
        <div className="flex flex-col gap-3"><Field label="Waktu sandar (kosongkan = sekarang)"><input type="datetime-local" className="input" value={dockedAt} onChange={(e) => setDockedAt(e.target.value)} /></Field><Field label="Sumber info"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: info ASDP / driver" /></Field><button className="btn-admin" disabled={busy} onClick={() => run(() => post("/docked", { docked_at: dockedAt ? new Date(dockedAt).toISOString() : undefined, reason: reason || undefined }, "PATCH"))}>{busy ? <Spinner /> : "Simpan"}</button></div>
      </Modal>
      <Modal open={modal === "waiting"} onClose={() => setModal(null)} title="Setujui biaya tunggu">
        <div className="flex flex-col gap-3"><p className="text-sm text-slate-600">Menit melewati tunggu gratis (dibulatkan ke 30 menit). Estimasi sistem: {waiting?.minutes_beyond_free ?? 0} menit.</p><Field label="Menit"><input type="number" className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></Field><button className="btn-admin" disabled={busy} onClick={() => run(() => post("/waiting-fee/approve", { minutes_beyond_free: minutes }))}>{busy ? <Spinner /> : "Setujui"}</button></div>
      </Modal>
      <Modal open={modal === "noshow"} onClose={() => setModal(null)} title="Konfirmasi penumpang tidak hadir">
        <div className="flex flex-col gap-3 text-sm"><p className="text-slate-600">Pesanan ditutup sebagai no-show dengan biaya 100 %. Driver menerima kompensasi bila trip prabayar.</p><Field label="Catatan"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field><button className="btn-danger" disabled={busy} onClick={() => run(() => post("/no-show/confirm", { note: reason || undefined }))}>{busy ? <Spinner /> : "Konfirmasi no-show"}</button></div>
      </Modal>
    </div>
  );
}
