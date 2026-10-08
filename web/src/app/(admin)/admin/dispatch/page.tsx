"use client";

import Link from "next/link";
import { AdminShell } from "@/components/admin/shell";
import { Table, Th, Td } from "@/components/admin/ui";
import { OrderRow, type AdminOrder } from "@/components/admin/order-row";
import { useApi } from "@/lib/use-api";
import type { AdminDriver } from "@/lib/admin";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Issue = { id: number; type: string; message: string | null; status: string; created_at: string; order?: { code: string; status: string } | null; driver?: { user?: { name: string } } | null };

export default function DispatchPage() { return <AdminShell title="Dispatch & perhatian"><Inner /></AdminShell>; }

function Inner() {
  const { data: orders, meta } = useApi<AdminOrder[]>("/admin/orders/needs-attention", { poll: 15000 });
  const { data: online } = useApi<AdminDriver[]>("/admin/drivers-online", { poll: 30000 });
  const issues = (meta?.open_issues as Issue[] | undefined) ?? [];
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold">Pesanan tanpa driver (perlu perhatian) · {orders?.length ?? 0}</h2>
        <Table empty={!orders?.length} head={<><Th>Kode</Th><Th>Jemput</Th><Th>Customer</Th><Th>Tujuan</Th><Th>Driver</Th><Th>Status</Th><Th className="text-right">Total</Th></>}>
          {orders?.map((o) => <OrderRow key={o.code} o={o} />)}
        </Table>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold">Laporan driver terbuka (SOS, no-show, kendala) · {issues.length}</h2>
        <Table empty={!issues.length} head={<><Th>Waktu</Th><Th>Jenis</Th><Th>Pesanan</Th><Th>Driver</Th><Th>Pesan</Th></>}>
          {issues.map((i) => <tr key={i.id} className={i.type === "sos" ? "bg-red-50" : ""}><Td>{formatDateTime(i.created_at)}</Td><Td><Badge tone={i.type === "sos" ? "danger" : "warn"}>{i.type}</Badge></Td><Td>{i.order && <Link href={`/admin/pesanan/${i.order.code}`} className="font-mono text-admin-600">{i.order.code}</Link>}</Td><Td>{i.driver?.user?.name}</Td><Td>{i.message}</Td></tr>)}
        </Table>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold">Driver online · {online?.length ?? 0}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {online?.map((d) => <Link key={d.id} href={`/admin/driver/${d.id}`} className="card !p-3 text-sm hover:border-admin-500"><b>{d.name}</b><div className="text-xs text-slate-500">{d.vehicle ? `${d.vehicle.vehicle_class_name} · ${d.vehicle.plate_number}` : "–"}</div><div className="text-xs text-slate-500">★ {Number(d.rating_avg).toFixed(1)} · terakhir aktif {formatDateTime(d.last_seen_at)}</div>{d.below_threshold && <Badge tone="danger">saldo rendah</Badge>}</Link>)}
          {!online?.length && <p className="text-sm text-slate-500">Tidak ada driver online.</p>}
        </div>
      </section>
    </div>
  );
}
