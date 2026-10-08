"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, AlertTriangle } from "lucide-react";
import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { useDriverMe, type Offer, PAYMENT_LABEL } from "@/lib/driver";
import { useApi } from "@/lib/use-api";
import type { Order } from "@/lib/ticket";
import { api, errorMessage } from "@/lib/api";
import { formatRupiah, formatTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { OrderStatusBadge } from "@/components/ui/badge";
import { OfferCard } from "@/components/driver/offer-card";
import { TripRow } from "@/components/driver/trip-row";

export default function DriverHome() {
  return <DriverShell><Home /></DriverShell>;
}

function Home() {
  const router = useRouter();
  const { data: me, reload } = useDriverMe(30000);
  const { data: offers, reload: reloadOffers } = useApi<Offer[]>("/driver/offers", { poll: 10000 });
  const { data: today } = useApi<Order[]>("/driver/trips?scope=today", { poll: 30000 });
  const { data: upcoming } = useApi<Order[]>("/driver/trips?scope=upcoming");
  const [err, setErr] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  if (!me) return null;

  async function toggle() {
    if (!me) return;
    setToggling(true); setErr(null);
    try { await api("/driver/availability", { method: "PATCH", body: JSON.stringify({ is_online: !me.is_online }) }); reload(); } catch (e) { setErr(errorMessage(e)); } finally { setToggling(false); }
  }
  const active = (today ?? []).find((o) => ["en_route", "arrived", "on_trip"].includes(o.status)) ?? null;
  const next = (upcoming ?? []).filter((o) => o.status === "assigned")[0] ?? null;

  return (
    <>
      <DriverHeader title={`Halo, ${me.name?.split(" ")[0] ?? "Driver"}`} right={<span className="flex items-center gap-1 text-sm text-slate-600"><Star size={14} className="text-amber-500" />{Number(me.rating_avg).toFixed(1)}</span>} />
      {err && <Alert tone="danger" className="mb-3">{err}</Alert>}
      {me.status === "suspended" && <Alert tone="danger" className="mb-3"><b>Akun ditangguhkan.</b> {me.suspension_reason} · Hubungi Ops.</Alert>}
      {me.has_expired_document && <Alert tone="warn" className="mb-3">Ada dokumen kedaluwarsa. <Link href="/driver/profil/dokumen" className="font-semibold underline">Perbarui</Link></Alert>}
      {me.below_threshold && <Alert tone="danger" className="mb-3"><AlertTriangle size={14} className="mr-1 inline" />Saldo di bawah ambang ({formatRupiah(me.balance_threshold)}). Anda tidak menerima tawaran sampai top-up. <Link href="/driver/pendapatan/top-up" className="font-semibold underline">Top-up</Link></Alert>}

      <div className="card mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">Status</div>
          <div className={`text-lg font-bold ${me.is_online ? "text-green-700" : "text-slate-500"}`}>{me.is_online ? "Online" : "Offline"}</div>
          <div className="text-xs text-slate-500">{me.is_online ? "Anda menerima tawaran trip" : "Aktifkan untuk menerima tawaran"}</div>
        </div>
        <button onClick={toggle} disabled={toggling || me.status !== "active"} aria-pressed={me.is_online}
          className={`relative h-9 w-16 rounded-full transition ${me.is_online ? "bg-green-600" : "bg-slate-300"} disabled:opacity-50`}>
          <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition ${me.is_online ? "left-8" : "left-1"}`} />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Link href="/driver/pendapatan" className="card !p-2"><div className="text-slate-500">Saldo</div><div className={`font-bold ${me.balance < 0 ? "text-red-700" : ""}`}>{formatRupiah(me.balance)}</div></Link>
        <div className="card !p-2"><div className="text-slate-500">Trip selesai</div><div className="font-bold">{me.trips_completed}</div></div>
        <div className="card !p-2"><div className="text-slate-500">Tepat waktu</div><div className="font-bold">{me.on_time_rate_90d != null ? `${Math.round(Number(me.on_time_rate_90d))} %` : "–"}</div></div>
      </div>

      {offers && offers.length > 0 && (
        <section className="mb-3">
          <h2 className="mb-2 text-sm font-semibold">Tawaran trip ({offers.length})</h2>
          <div className="flex flex-col gap-2">{offers.map((o) => <OfferCard key={o.id} offer={o} compact onDone={() => { reloadOffers(); router.refresh(); }} />)}</div>
        </section>
      )}

      {active && (
        <Link href={`/driver/trip/${active.code}`} className="card mb-3 block border-driver-500 ring-2 ring-driver-500/20">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase text-driver-600">Trip berjalan</span><OrderStatusBadge status={active.status} /></div>
          <div className="mt-1 font-semibold">{active.customer.name} · Lembar → {active.destination?.name}</div>
          <div className="text-xs text-slate-500">{active.code} · {formatTime(active.pickup_at)} · {PAYMENT_LABEL[active.payment_method]} {formatRupiah(active.total)}</div>
        </Link>
      )}

      <section className="mb-3">
        <h2 className="mb-2 text-sm font-semibold">Trip hari ini</h2>
        {!today?.length ? <p className="card text-sm text-slate-500">Tidak ada trip hari ini.</p> : today.map((o) => <TripRow key={o.code} o={o} />)}
      </section>
      {next && !today?.some((o) => o.code === next.code) && (
        <section className="mb-3">
          <h2 className="mb-2 text-sm font-semibold">Trip berikutnya</h2>
          <TripRow o={next} withDate />
        </section>
      )}
      <Link href="/driver/bantuan" className="block text-center text-xs text-slate-500 underline">Bantuan & SOS</Link>
    </>
  );
}
