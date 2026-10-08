"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api";
import type { Offer } from "@/lib/driver";
import { PAYMENT_LABEL } from "@/lib/driver";
import { formatRupiah, formatDateTime, formatTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export function useCountdown(expiresAt: string) {
  const [left, setLeft] = useState(() => Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000))), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return left;
}

export function OfferCard({ offer, compact = false, onDone }: { offer: Offer; compact?: boolean; onDone?: () => void }) {
  const left = useCountdown(offer.expires_at);
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const o = offer.order;
  const expired = left === 0;

  async function act(kind: "accept" | "decline") {
    setBusy(kind); setErr(null);
    try {
      await api(`/driver/offers/${offer.id}/${kind}`, { method: "POST" });
      if (kind === "accept") router.push(`/driver/trip/${o.code}`); else onDone?.();
    } catch (e) { setErr(errorMessage(e)); onDone?.(); } finally { setBusy(null); }
  }
  const pct = Math.min(100, Math.round((left / 120) * 100));

  return (
    <div className={`card border-driver-500/40 ${expired ? "opacity-60" : ""}`}>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wide text-driver-600">Tawaran · gelombang {offer.wave}{o.channel === "qr" ? " · instan" : ""}</span>
        <span className={`font-mono text-sm font-bold ${left < 30 ? "text-red-600" : "text-slate-700"}`}>{expired ? "habis" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</span>
      </div>
      <div className="mb-2 h-1 w-full rounded bg-slate-100"><div className="h-1 rounded bg-driver-500 transition-all" style={{ width: `${pct}%` }} /></div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold">Lembar → {o.destination}</div>
          <div className="text-xs text-slate-600">{formatDateTime(o.pickup_at)}{o.ferry_eta_max_at ? ` (sandar s.d. ${formatTime(o.ferry_eta_max_at)})` : ""}</div>
          <div className="mt-1 text-xs text-slate-600">{o.vehicle_class} · {o.passengers} pax · {o.luggage_units} bagasi{o.child_seats ? ` · ${o.child_seats} child seat` : ""}{o.needs_roof_rack ? " · roof rack" : ""}{o.duration_min_est ? ` · ± ${o.duration_min_est} menit` : ""}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-green-700">{formatRupiah(o.driver_net)}</div>
          <div className="text-[11px] text-slate-500">{PAYMENT_LABEL[o.payment_method]} · tarif {formatRupiah(o.total)}</div>
        </div>
      </div>
      {!compact && o.notes && <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">Catatan: {o.notes}</p>}
      {!compact && o.payment_method === "cash" && <p className="mt-2 text-[11px] text-slate-500">Tunai: Anda menerima {formatRupiah(o.total)} dari penumpang; komisi {formatRupiah(o.commission_amount)} dipotong dari saldo.</p>}
      {err && <Alert tone="danger" className="mt-2">{err}</Alert>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="btn-ghost" disabled={busy !== null || expired} onClick={() => act("decline")}>{busy === "decline" ? <Spinner /> : "Tolak"}</button>
        <button className="btn-driver" disabled={busy !== null || expired} onClick={() => act("accept")}>{busy === "accept" ? <Spinner /> : "Terima"}</button>
      </div>
      {compact && <Link href={`/driver/tawaran/${offer.id}`} className="mt-2 block text-center text-xs text-driver-600">Lihat detail</Link>}
    </div>
  );
}
