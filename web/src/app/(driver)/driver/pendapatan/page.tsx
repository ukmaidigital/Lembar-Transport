"use client";

import { useState } from "react";
import Link from "next/link";
import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { useApi } from "@/lib/use-api";
import { formatRupiah, formatDateTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Empty } from "@/components/ui/empty";

type Entry = { id: number; type: string; amount: number; balance_after: number; note: string | null; created_at: string; order?: { code: string } | null };
type Meta = { balance: number; threshold: number; below_threshold: boolean; trips_completed: number; net_earnings: number; cash_commission: number; payout_min: number; top_up_min: number };
const TYPE: Record<string, string> = { trip_earning: "Pendapatan trip", commission: "Komisi", top_up: "Top-up", payout: "Payout", adjustment: "Penyesuaian", cancellation_compensation: "Kompensasi pembatalan", waiting_fee: "Biaya tunggu" };

export default function EarningsPage() { return <DriverShell><Inner /></DriverShell>; }

function Inner() {
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("week");
  const { data, meta } = useApi<Entry[]>(`/driver/ledger?period=${period}`);
  const m = meta as unknown as Meta | null;
  const { data: topUps } = useApi<{ id: number; amount: number; status: string; created_at: string }[]>("/driver/top-ups");
  const pendingTopUp = topUps?.find((t) => t.status === "pending_review");
  return (
    <>
      <DriverHeader title="Pendapatan" right={<Link href="/driver/pendapatan/top-up" className="btn-driver !min-h-9 px-3 text-xs">Top-up</Link>} />
      {m && (
        <div className={`card mb-3 ${m.below_threshold ? "border-red-300 bg-red-50" : ""}`}>
          <div className="text-xs text-slate-500">Saldo</div>
          <div className={`text-2xl font-bold ${m.balance < 0 ? "text-red-700" : "text-slate-900"}`}>{formatRupiah(m.balance)}</div>
          <div className="text-xs text-slate-500">Ambang {formatRupiah(m.threshold)} · payout mingguan otomatis bila saldo ≥ {formatRupiah(m.payout_min)}</div>
          {m.below_threshold && <p className="mt-1 text-xs font-semibold text-red-800">Saldo di bawah ambang: tawaran dihentikan sampai top-up.</p>}
          {pendingTopUp && <Alert tone="info" className="mt-2">Top-up {formatRupiah(pendingTopUp.amount)} menunggu konfirmasi Finance.</Alert>}
        </div>
      )}
      <div className="mb-3 grid grid-cols-4 rounded-lg bg-slate-200 p-1 text-xs font-semibold">
        {([["today", "Hari ini"], ["week", "Minggu"], ["month", "Bulan"], ["all", "Semua"]] as const).map(([k, l]) => <button key={k} onClick={() => setPeriod(k)} className={`rounded-md py-1.5 ${period === k ? "bg-white shadow" : "text-slate-600"}`}>{l}</button>)}
      </div>
      {m && (
        <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="card !p-2"><div className="text-slate-500">Trip</div><div className="font-bold">{m.trips_completed}</div></div>
          <div className="card !p-2"><div className="text-slate-500">Bersih</div><div className="font-bold text-green-700">{formatRupiah(m.net_earnings)}</div></div>
          <div className="card !p-2"><div className="text-slate-500">Komisi tunai</div><div className="font-bold text-red-700">{formatRupiah(m.cash_commission)}</div></div>
        </div>
      )}
      <h2 className="mb-2 text-sm font-semibold">Mutasi</h2>
      {!data?.length ? <Empty title="Belum ada mutasi" /> : (
        <div className="card divide-y !p-0">
          {data.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div><div className="font-medium">{TYPE[e.type] ?? e.type}{e.order ? ` · ${e.order.code}` : ""}</div><div className="text-xs text-slate-500">{formatDateTime(e.created_at)}{e.note ? ` · ${e.note}` : ""}</div></div>
              <div className="text-right"><div className={`font-semibold ${e.amount < 0 ? "text-red-700" : "text-green-700"}`}>{e.amount < 0 ? "−" : "+"} {formatRupiah(Math.abs(e.amount))}</div><div className="text-[11px] text-slate-400">saldo {formatRupiah(e.balance_after)}</div></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
