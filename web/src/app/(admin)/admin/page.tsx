"use client";

import Link from "next/link";
import { AdminShell } from "@/components/admin/shell";
import { Stat, Table, Th, Td } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { formatTime, formatRupiah } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui/badge";
import { PageLoading } from "@/components/ui/spinner";

type Pickup = { code: string; status: string; pickup_at: string; ferry_eta_min_at: string | null; ferry_eta_max_at: string | null; guest_name: string; passengers: number; total: number; payment_method: string; destination?: { name_id: string } | null; vehicle_class?: { name_id: string } | null; driver?: { user?: { name: string } } | null; needs_attention: boolean };
type Dash = { orders_today: number; orders_yesterday: number; trips_running: number; needs_attention: number; verification_pending: number; verification_sla_breaches: number; payments_pending_review: number; drivers_online: number; drivers_below_threshold: number; documents_expiring_7d: number; pickups_today: Pickup[]; series_14d: { date: string; count: number }[] };

export default function DashboardPage() {
  return <AdminShell title="Dashboard"><Inner /></AdminShell>;
}

function Inner() {
  const { data: d } = useApi<Dash>("/admin/dashboard", { poll: 30000 });
  if (!d) return <PageLoading />;
  const max = Math.max(1, ...d.series_14d.map((s) => s.count));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Pesanan hari ini" value={d.orders_today} hint={`kemarin ${d.orders_yesterday}`} href="/admin/pesanan?date=today" />
        <Stat label="Trip berjalan" value={d.trips_running} tone="good" href="/admin/pesanan?status=en_route,arrived,on_trip" />
        <Stat label="Perlu perhatian" value={d.needs_attention} tone={d.needs_attention ? "danger" : undefined} href="/admin/dispatch" />
        <Stat label="Verifikasi menunggu" value={d.verification_pending} tone={d.verification_sla_breaches ? "danger" : d.verification_pending ? "warn" : undefined} hint={d.verification_sla_breaches ? `${d.verification_sla_breaches} lewat SLA 24 jam` : "dalam SLA"} href="/admin/verifikasi" />
        <Stat label="Bukti bayar menunggu" value={d.payments_pending_review} tone={d.payments_pending_review ? "warn" : undefined} href="/admin/pembayaran" />
        <Stat label="Driver online" value={d.drivers_online} hint={`${d.drivers_below_threshold} saldo < ambang · ${d.documents_expiring_7d} dokumen segera habis`} href="/admin/driver?online=1" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Penjemputan hari ini</h2>
          <Table empty={!d.pickups_today.length} head={<><Th>Sandar / jemput</Th><Th>Kode</Th><Th>Penumpang</Th><Th>Tujuan</Th><Th>Driver</Th><Th>Status</Th><Th className="text-right">Total</Th></>}>
            {d.pickups_today.map((p) => (
              <tr key={p.code} className={p.needs_attention ? "bg-red-50/50" : ""}>
                <Td><b>{formatTime(p.ferry_eta_min_at ?? p.pickup_at).replace(" WITA", "")}</b>{p.ferry_eta_max_at && <span className="text-xs text-slate-500">–{formatTime(p.ferry_eta_max_at).replace(" WITA", "")}</span>}</Td>
                <Td><Link href={`/admin/pesanan/${p.code}`} className="font-mono text-admin-600">{p.code}</Link></Td>
                <Td>{p.guest_name}<div className="text-xs text-slate-500">{p.passengers} pax · {p.vehicle_class?.name_id}</div></Td>
                <Td>{p.destination?.name_id}</Td>
                <Td>{p.driver?.user?.name ?? <span className="text-red-700">belum ada</span>}</Td>
                <Td><OrderStatusBadge status={p.status} /></Td>
                <Td className="text-right tabular-nums">{formatRupiah(p.total)}<div className="text-[11px] text-slate-500">{p.payment_method}</div></Td>
              </tr>
            ))}
          </Table>
        </div>
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold">Pesanan 14 hari terakhir</h2>
          <div className="flex h-40 items-end gap-1">
            {d.series_14d.map((s) => (
              <div key={s.date} className="flex flex-1 flex-col items-center gap-1" title={`${s.date}: ${s.count}`}>
                <div className="w-full rounded-t bg-admin-500" style={{ height: `${Math.max(2, (s.count / max) * 140)}px` }} />
                <span className="text-[9px] text-slate-400">{s.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
