"use client";

import { useEffect, useState } from "react";
import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { TripRow } from "@/components/driver/trip-row";
import { useApi } from "@/lib/use-api";
import type { Order } from "@/lib/ticket";
import { api, errorMessage } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Empty } from "@/components/ui/empty";

export default function SchedulePage() { return <DriverShell><Inner /></DriverShell>; }

const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function Inner() {
  const [tab, setTab] = useState<"upcoming" | "history" | "blocked">("upcoming");
  const { data: upcoming } = useApi<Order[]>("/driver/trips?scope=upcoming");
  const { data: history } = useApi<Order[]>(tab === "history" ? "/driver/trips?scope=history" : null);
  const { data: blockedData, reload } = useApi<string[]>("/driver/blocked-dates");
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (blockedData) setBlocked(new Set(blockedData)); }, [blockedData]);

  const tripDates = new Set((upcoming ?? []).map((o) => new Date(new Date(o.pickup_at).getTime() + 8 * 3600000).toISOString().slice(0, 10)));
  const first = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayStr = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const key = (d: number) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  async function save() {
    setMsg(null);
    try { await api("/driver/blocked-dates", { method: "PUT", body: JSON.stringify({ dates: [...blocked] }) }); setMsg("Tanggal libur tersimpan."); reload(); } catch (e) { setMsg(errorMessage(e)); }
  }

  return (
    <>
      <DriverHeader title="Jadwal" />
      <div className="mb-3 grid grid-cols-3 rounded-lg bg-slate-200 p-1 text-xs font-semibold">
        {([["upcoming", "Mendatang"], ["history", "Riwayat"], ["blocked", "Hari libur"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-md py-1.5 ${tab === k ? "bg-white shadow" : "text-slate-600"}`}>{l}</button>
        ))}
      </div>
      {tab === "upcoming" && (!upcoming?.length ? <Empty title="Belum ada trip mendatang" /> : upcoming.map((o) => <TripRow key={o.code} o={o} withDate />))}
      {tab === "history" && (!history?.length ? <Empty title="Belum ada riwayat" /> : history.map((o) => <TripRow key={o.code} o={o} withDate />))}
      {tab === "blocked" && (
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <button className="px-2" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
            <b>{month.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</b>
            <button className="px-2" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500">{DAYS.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: first }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const k = key(i + 1); const past = k < todayStr; const isBlocked = blocked.has(k); const hasTrip = tripDates.has(k);
              return (
                <button key={k} disabled={past || hasTrip} title={hasTrip ? "Ada trip" : ""}
                  onClick={() => setBlocked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                  className={`relative h-10 rounded-md text-sm ${isBlocked ? "bg-red-100 font-semibold text-red-800" : hasTrip ? "bg-driver-50 text-driver-600" : "bg-slate-50"} disabled:opacity-40 ${k === todayStr ? "ring-1 ring-driver-500" : ""}`}>
                  {i + 1}{hasTrip && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-driver-500" />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">Ketuk tanggal untuk menandai libur (merah). Anda tidak menerima tawaran pada hari libur. Oranye = ada trip.</p>
          {msg && <Alert tone="info" className="mt-2">{msg}</Alert>}
          <button className="btn-driver mt-3 w-full" onClick={save}>Simpan hari libur</button>
        </div>
      )}
    </>
  );
}
