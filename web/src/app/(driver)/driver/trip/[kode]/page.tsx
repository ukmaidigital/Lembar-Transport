"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Phone, MessageCircle, MapPin, IdCard, AlertTriangle } from "lucide-react";
import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { useApi } from "@/lib/use-api";
import type { Order } from "@/lib/ticket";
import type { WaitingInfo } from "@/lib/driver";
import { PAYMENT_LABEL } from "@/lib/driver";
import { api, errorMessage } from "@/lib/api";
import { postOrQueue } from "@/lib/offline-queue";
import { formatRupiah, formatDateTime, formatTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { OrderStatusBadge } from "@/components/ui/badge";
import { PageLoading, Spinner } from "@/components/ui/spinner";

export default function TripPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = use(params);
  return <DriverShell><Trip code={kode} /></DriverShell>;
}

const NEXT: Record<string, { status: string; label: string; hint: string }> = {
  assigned: { status: "en_route", label: "Berangkat ke pelabuhan", hint: "Tekan saat Anda mulai menuju Lembar." },
  en_route: { status: "arrived", label: "Tiba di titik temu", hint: "Tekan saat sudah di titik temu; penumpang diberi tahu." },
  arrived: { status: "on_trip", label: "Penumpang naik · mulai perjalanan", hint: "Tekan saat penumpang sudah di dalam kendaraan." },
  on_trip: { status: "completed", label: "Selesai di tujuan", hint: "Tekan saat penumpang turun di tujuan." },
};

function Trip({ code }: { code: string }) {
  const { data: o, meta, loading, reload, error } = useApi<Order>(`/driver/trips/${code}`, { poll: 20000 });
  const waiting = meta?.waiting as WaitingInfo | undefined;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cash, setCash] = useState<string>("");
  const [cashNote, setCashNote] = useState("");
  const [showNoShow, setShowNoShow] = useState(false);
  const [attempts, setAttempts] = useState(3);
  const [noShowNote, setNoShowNote] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");

  if (loading && !o) return <PageLoading />;
  if (!o) return <Alert tone="danger">{error ?? "Trip tidak ditemukan"}</Alert>;
  const next = NEXT[o.status];
  const terminal = ["completed", "cancelled", "no_show", "expired"].includes(o.status);
  const due = o.total + o.waiting_fee;
  const canStart = o.status !== "assigned" || new Date(o.pickup_at).getTime() - Date.now() < 3 * 3600000;

  async function advance() {
    if (!next || !o) return;
    setBusy(true); setErr(null); setInfo(null);
    const body: Record<string, unknown> = { status: next.status };
    if (next.status === "completed" && o.payment_method === "cash") {
      if (!cash) { setErr("Isi jumlah tunai yang diterima."); setBusy(false); return; }
      body.cash_collected = Number(cash.replace(/\D/g, ""));
      if (cashNote) body.cash_note = cashNote;
    }
    try {
      const live = await postOrQueue(`/driver/trips/${code}/status`, body, next.label);
      if (!live) setInfo("Anda offline. Status disimpan dan akan dikirim otomatis saat kembali online.");
      reload();
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  async function noShow() {
    setBusy(true); setErr(null);
    try { await api(`/driver/trips/${code}/no-show`, { method: "POST", body: JSON.stringify({ contact_attempts: attempts, note: noShowNote || undefined }) }); setInfo("Permintaan no-show dikirim ke Ops untuk konfirmasi."); setShowNoShow(false); reload(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  async function withdraw() {
    setBusy(true); setErr(null);
    try { await api(`/driver/trips/${code}/withdraw`, { method: "POST", body: JSON.stringify({ reason: withdrawReason }) }); setInfo("Anda mengundurkan diri dari trip ini. Ops akan mencari driver lain."); setShowWithdraw(false); reload(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  const wa = o.customer.phone && !o.customer.phone.includes("•") ? `https://wa.me/${o.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Halo ${o.customer.name}, saya ${o.driver?.name ?? "driver"} dari Lembar Transport (${o.code}). Saya menunggu di ${o.meeting_point?.name ?? "titik temu"}.`)}` : null;

  return (
    <>
      <DriverHeader title={o.code} back="/driver" right={<OrderStatusBadge status={o.status} />} />
      {err && <Alert tone="danger" className="mb-3">{err}</Alert>}
      {info && <Alert tone="info" className="mb-3">{info}</Alert>}

      <div className="card mb-3">
        <div className="text-xs text-slate-500">Penumpang</div>
        <div className="text-lg font-bold">{o.customer.name}</div>
        <div className="text-sm text-slate-600">{o.passengers} penumpang · {o.luggage_units} bagasi{o.child_seats ? ` · ${o.child_seats} child seat` : ""}{o.needs_roof_rack ? " · roof rack" : ""}</div>
        {o.notes && <p className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-900">Catatan: {o.notes}</p>}
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <a className={`btn-ghost ${!wa ? "pointer-events-none opacity-40" : ""}`} href={wa ?? "#"} target="_blank" rel="noreferrer"><MessageCircle size={16} />WA</a>
          <a className={`btn-ghost ${!o.customer.phone || o.customer.phone.includes("•") ? "pointer-events-none opacity-40" : ""}`} href={`tel:${o.customer.phone}`}><Phone size={16} />Telepon</a>
          <Link className="btn-ghost" href={`/driver/trip/${code}/papan-nama`}><IdCard size={16} />Papan</Link>
        </div>
        {o.customer.phone?.includes("•") && <p className="mt-1 text-[11px] text-slate-500">Nomor penumpang terbuka 24 jam sebelum penjemputan.</p>}
      </div>

      <div className="card mb-3 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Penjemputan</span><b>{formatDateTime(o.pickup_at)}</b></div>
        {o.ferry.route && <div className="flex justify-between"><span className="text-slate-500">Kapal</span><span>{o.ferry.route} · sandar {formatTime(o.ferry.eta_min_at)}–{formatTime(o.ferry.eta_max_at)}</span></div>}
        {o.ferry.docked_at && <div className="flex justify-between text-green-700"><span>Kapal sandar</span><b>{formatTime(o.ferry.docked_at)}</b></div>}
        <div className="flex justify-between"><span className="text-slate-500">Tujuan</span><b>{o.destination?.name} ({o.destination?.zone})</b></div>
        <div className="flex justify-between"><span className="text-slate-500">Titik temu</span><span className="flex items-center gap-1"><MapPin size={14} />{o.meeting_point?.name}</span></div>
        <div className="mt-2 flex justify-between border-t pt-2"><span className="text-slate-500">Pembayaran</span><b>{PAYMENT_LABEL[o.payment_method]} · {formatRupiah(due)}</b></div>
        {o.commission && <div className="flex justify-between text-xs text-slate-500"><span>Komisi {Math.round(Number(o.commission.rate) * 100)} %</span><span>− {formatRupiah(o.commission.amount)} → bersih {formatRupiah(o.commission.driver_net)}</span></div>}
        {o.waiting_fee > 0 && <div className="flex justify-between text-xs text-amber-800"><span>Biaya tunggu disetujui</span><span>{formatRupiah(o.waiting_fee)}</span></div>}
      </div>

      {o.status === "arrived" && waiting && (
        <div className={`card mb-3 text-sm ${waiting.minutes_beyond_free > 0 ? "border-amber-300 bg-amber-50" : ""}`}>
          <div className="font-semibold">Waktu tunggu</div>
          {waiting.anchor_at ? (
            <>
              <div className="text-xs text-slate-600">Jangkar: {formatTime(waiting.anchor_at)} ({waiting.anchor_source === "estimate" ? "estimasi + 60 menit" : waiting.anchor_source})</div>
              {waiting.minutes_beyond_free > 0
                ? <div className="mt-1 text-amber-900">Melewati tunggu gratis <b>{waiting.minutes_beyond_free} menit</b> · estimasi biaya tunggu {formatRupiah(waiting.waiting_fee_estimate)} (perlu persetujuan Ops)</div>
                : <div className="mt-1">Tunggu gratis tersisa <b>{waiting.free_minutes_left} menit</b> (s.d. {formatTime(waiting.free_until)})</div>}
              <div className="mt-1 text-xs text-slate-500">No-show dapat diajukan mulai {formatTime(waiting.no_show_available_at)} setelah ≥ 3 upaya kontak.</div>
            </>
          ) : <div className="text-xs text-slate-600">Menunggu kapal sandar.</div>}
          <button className="mt-2 text-xs font-semibold text-red-700 underline disabled:opacity-40" disabled={!waiting.no_show_available} onClick={() => setShowNoShow(true)}>Ajukan penumpang tidak hadir</button>
        </div>
      )}

      {showNoShow && (
        <div className="card mb-3 border-red-200">
          <div className="font-semibold">Ajukan no-show</div>
          <label className="label mt-2">Jumlah upaya kontak (WA/telepon)</label>
          <input type="number" min={0} max={20} className="input" value={attempts} onChange={(e) => setAttempts(Number(e.target.value))} />
          <label className="label mt-2">Catatan</label>
          <input className="input" value={noShowNote} onChange={(e) => setNoShowNote(e.target.value)} placeholder="Contoh: WA centang satu, telepon tidak diangkat" />
          <div className="mt-3 grid grid-cols-2 gap-2"><button className="btn-ghost" onClick={() => setShowNoShow(false)}>Batal</button><button className="btn-danger" disabled={busy} onClick={noShow}>{busy ? <Spinner /> : "Kirim ke Ops"}</button></div>
        </div>
      )}

      {next && !terminal && (
        <div className="mb-3">
          {next.status === "completed" && o.payment_method === "cash" && (
            <div className="card mb-2">
              <label className="label">Tunai diterima (tagihan {formatRupiah(due)})</label>
              <input className="input text-lg font-bold" inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} placeholder={String(due)} />
              <button type="button" className="mt-1 text-xs text-driver-600 underline" onClick={() => setCash(String(due))}>Isi sesuai tagihan</button>
              {cash && Number(cash.replace(/\D/g, "")) !== due && (<><label className="label mt-2">Alasan jumlah berbeda</label><input className="input" value={cashNote} onChange={(e) => setCashNote(e.target.value)} placeholder="Contoh: penumpang tidak punya uang pas" /></>)}
            </div>
          )}
          <button className="btn-driver w-full py-4 text-base" disabled={busy || !canStart} onClick={advance}>{busy ? <Spinner /> : next.label}</button>
          <p className="mt-1 text-center text-xs text-slate-500">{canStart ? next.hint : "Tombol berangkat aktif 3 jam sebelum penjemputan."}</p>
        </div>
      )}

      {o.status === "completed" && <Alert tone="good" className="mb-3">Trip selesai {formatTime(o.timeline.completed_at)}. {o.payment_method === "cash" ? `Tunai dicatat ${formatRupiah(o.cash_collected ?? 0)}.` : ""} Pendapatan bersih {formatRupiah(o.commission?.driver_net ?? 0)} masuk ke saldo.</Alert>}

      {!terminal && (
        <div className="flex justify-between text-xs">
          <Link href={`/driver/bantuan?trip=${code}`} className="flex items-center gap-1 font-semibold text-red-700"><AlertTriangle size={14} />SOS / lapor masalah</Link>
          {o.status === "assigned" && <button className="text-slate-500 underline" onClick={() => setShowWithdraw(true)}>Undur diri dari trip</button>}
        </div>
      )}
      {showWithdraw && (
        <div className="card mt-3 border-red-200">
          <div className="font-semibold">Undur diri</div>
          <p className="text-xs text-slate-600">Undur diri menurunkan tingkat penerimaan Anda. Sampaikan alasannya.</p>
          <input className="input mt-2" value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} placeholder="Alasan" />
          <div className="mt-3 grid grid-cols-2 gap-2"><button className="btn-ghost" onClick={() => setShowWithdraw(false)}>Batal</button><button className="btn-danger" disabled={busy || withdrawReason.trim().length < 3} onClick={withdraw}>{busy ? <Spinner /> : "Ya, undur diri"}</button></div>
        </div>
      )}
    </>
  );
}
