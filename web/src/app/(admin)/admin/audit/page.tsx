"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/shell";
import { Table, Th, Td, Toolbar, Field } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { qs } from "@/lib/admin";
import { formatDateTime } from "@/lib/utils";
import { PageLoading } from "@/components/ui/spinner";

type Entry = { id: number; log: string; action: string; subject_type: string; subject_id: number | null; causer: { id: number; name: string } | null; properties: Record<string, unknown>; created_at: string };

export default function AuditPage() { return <AdminShell title="Audit log"><Inner /></AdminShell>; }

function Inner() {
  const [log, setLog] = useState("");
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const { data, loading, meta } = useApi<Entry[]>(`/admin/audit-logs${qs({ log, q, subject_type: subject })}`);
  return (
    <>
      <Toolbar>
        <Field label="Kategori"><select className="input !py-1.5" value={log} onChange={(e) => setLog(e.target.value)}><option value="">Semua</option>{["orders", "dispatch", "drivers", "payments", "ledger", "tariffs", "catalog", "settings", "staff", "auth"].map((l) => <option key={l}>{l}</option>)}</select></Field>
        <Field label="Objek"><input className="input !py-1.5" placeholder="Order, Driver, …" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Aksi"><input className="input !py-1.5" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
      </Toolbar>
      {loading && !data ? <PageLoading /> : (
        <Table empty={!data?.length} head={<><Th>Waktu</Th><Th>Kategori</Th><Th>Aksi</Th><Th>Objek</Th><Th>Oleh</Th><Th>Detail</Th></>}>
          {data?.map((e) => <tr key={e.id}><Td className="whitespace-nowrap">{formatDateTime(e.created_at)}</Td><Td>{e.log}</Td><Td className="font-medium">{e.action}</Td><Td>{e.subject_type}{e.subject_id ? ` #${e.subject_id}` : ""}</Td><Td>{e.causer?.name ?? "sistem"}</Td><Td><pre className="max-w-md overflow-x-auto whitespace-pre-wrap text-[11px] text-slate-600">{Object.keys(e.properties ?? {}).length ? JSON.stringify(e.properties) : ""}</pre></Td></tr>)}
        </Table>
      )}
      <p className="mt-2 text-xs text-slate-500">{Number(meta?.total ?? 0)} entri · log tidak dapat diubah (append-only)</p>
    </>
  );
}
