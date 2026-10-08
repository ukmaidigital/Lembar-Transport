"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { Table, Th, Td, Toolbar, Field } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { qs, type AdminDriver } from "@/lib/admin";
import { DRIVER_STATUS_LABEL } from "@/lib/driver";
import { formatRupiah } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";

export default function DriversPage() {
  const { can } = useAuth();
  return <AdminShell title="Driver" actions={can("drivers.manage") ? <Link href="/admin/driver/baru" className="btn-admin !min-h-9 px-3 text-xs">+ Daftarkan driver</Link> : null}><Suspense><Inner /></Suspense></AdminShell>;
}

function Inner() {
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [online, setOnline] = useState(sp.get("online") ?? "");
  const [below, setBelow] = useState(false);
  const { data, loading } = useApi<AdminDriver[]>(`/admin/drivers${qs({ q, status, online, below_threshold: below ? 1 : "", per_page: 100 })}`);
  return (
    <>
      <Toolbar>
        <Field label="Cari"><input className="input !py-1.5" placeholder="Nama, WA, nopol" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <Field label="Status"><select className="input !py-1.5" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua</option>{Object.entries(DRIVER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Online"><select className="input !py-1.5" value={online} onChange={(e) => setOnline(e.target.value)}><option value="">Semua</option><option value="1">Online</option><option value="0">Offline</option></select></Field>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={below} onChange={(e) => setBelow(e.target.checked)} />Saldo di bawah ambang</label>
      </Toolbar>
      {loading && !data ? <PageLoading /> : (
        <Table empty={!data?.length} head={<><Th>Driver</Th><Th>Kendaraan</Th><Th>Status</Th><Th>Rating</Th><Th>Trip</Th><Th>Terima 30h</Th><Th className="text-right">Saldo</Th><Th /></>}>
          {data?.map((d) => (
            <tr key={d.id}>
              <Td><b>{d.name}</b><div className="text-xs text-slate-500">{d.phone}</div></Td>
              <Td>{d.vehicle ? `${d.vehicle.brand} ${d.vehicle.model}` : "–"}<div className="text-xs text-slate-500">{d.vehicle?.plate_number} · {d.vehicle?.vehicle_class_name}</div></Td>
              <Td><Badge tone={d.status === "active" ? "good" : d.status === "suspended" || d.status === "rejected" ? "danger" : "warn"}>{DRIVER_STATUS_LABEL[d.status]}</Badge>{d.status === "active" && <div className={`mt-1 text-[11px] ${d.is_online ? "text-green-700" : "text-slate-400"}`}>{d.is_online ? "● online" : "○ offline"}</div>}</Td>
              <Td>{Number(d.rating_avg).toFixed(1)} <span className="text-xs text-slate-500">({d.rating_count})</span></Td>
              <Td>{d.trips_completed}</Td>
              <Td>{d.acceptance_rate_30d != null ? `${Math.round(Number(d.acceptance_rate_30d))} %` : "–"}</Td>
              <Td className={`text-right tabular-nums ${d.below_threshold ? "font-semibold text-red-700" : ""}`}>{formatRupiah(d.balance)}</Td>
              <Td><Link href={`/admin/driver/${d.id}`} className="text-admin-600">Detail →</Link></Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
