"use client";

import Link from "next/link";
import { AdminShell } from "@/components/admin/shell";
import { Table, Th, Td } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import type { AdminDriver } from "@/lib/admin";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/ui/spinner";

export default function VerificationQueuePage() { return <AdminShell title="Antrean verifikasi"><Inner /></AdminShell>; }

function Inner() {
  const { data, loading } = useApi<AdminDriver[]>("/admin/driver-applications", { poll: 30000 });
  if (loading && !data) return <PageLoading />;
  return (
    <Table empty={!data?.length} head={<><Th>Pemohon</Th><Th>Kendaraan</Th><Th>Dokumen</Th><Th>Diajukan</Th><Th>SLA</Th><Th>Status</Th><Th /></>}>
      {data?.map((d) => {
        const late = d.sla_deadline_at && new Date(d.sla_deadline_at).getTime() < Date.now();
        const approved = d.documents.filter((x) => x.status === "approved").length;
        return (
          <tr key={d.id} className={late ? "bg-red-50/40" : ""}>
            <Td><b>{d.name}</b><div className="text-xs text-slate-500">{d.phone}{d.partner_organization ? ` · ${d.partner_organization}` : ""}</div></Td>
            <Td>{d.vehicle ? `${d.vehicle.brand} ${d.vehicle.model} ${d.vehicle.year}` : "–"}<div className="text-xs text-slate-500">{d.vehicle?.plate_number} · {d.vehicle?.vehicle_class_name}</div></Td>
            <Td>{approved}/{d.required_documents.length} disetujui{d.documents.some((x) => x.status === "rejected") && <span className="ml-1 text-red-700">· ada ditolak</span>}</Td>
            <Td>{formatDateTime(d.submitted_at)}</Td>
            <Td>{d.status === "submitted" ? (late ? <Badge tone="danger">Lewat SLA</Badge> : <span className="text-xs text-slate-500">s.d. {formatDateTime(d.sla_deadline_at)}</span>) : "–"}</Td>
            <Td><Badge tone={d.status === "submitted" ? "warn" : "neutral"}>{d.status === "submitted" ? "Menunggu" : "Perlu revisi"}</Badge></Td>
            <Td><Link href={`/admin/verifikasi/${d.id}`} className="btn-admin !min-h-8 px-3 text-xs">Review</Link></Td>
          </tr>
        );
      })}
    </Table>
  );
}
