"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/shell";
import { Toolbar, Field, Table, Th, Td } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth";
import { qs } from "@/lib/admin";
import { formatRupiah } from "@/lib/utils";
import { PageLoading } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";

const REPORTS: { key: string; label: string; perm: string }[] = [
  { key: "orders", label: "Pesanan", perm: "reports.view.ops" }, { key: "revenue", label: "Pendapatan", perm: "reports.view.finance" }, { key: "drivers", label: "Kinerja driver", perm: "reports.view.ops" },
  { key: "cancellations", label: "Pembatalan", perm: "reports.view.ops" }, { key: "verification", label: "Verifikasi", perm: "reports.view.verification" }, { key: "dispatch", label: "Dispatch", perm: "reports.view.ops" }, { key: "funnel", label: "Funnel", perm: "reports.view.ops" },
];
const MONEY = new Set(["gmv", "commission", "waiting_fees", "cancellation_fees", "refunds", "platform_net", "net", "balance", "fees"]);

export default function ReportsPage() { return <AdminShell title="Laporan"><Inner /></AdminShell>; }

function fmt(k: string, v: unknown): string {
  if (v === null || v === undefined) return "–";
  if (typeof v === "number") return MONEY.has(k) ? formatRupiah(v) : String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Inner() {
  const { can } = useAuth();
  const allowed = REPORTS.filter((r) => can("reports.view.all") || can(r.perm));
  const [report, setReport] = useState(allowed[0]?.key ?? "orders");
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const { data, loading, error } = useApi<unknown>(allowed.length ? `/admin/reports/${report}${qs({ from, to })}` : null);
  const csv = `/api/proxy/admin/reports/${report}${qs({ from, to, format: "csv" })}`;
  if (!allowed.length) return <Alert tone="warn">Anda tidak memiliki akses laporan.</Alert>;
  return (
    <>
      <Toolbar>
        <Field label="Laporan"><select className="input !py-1.5" value={report} onChange={(e) => setReport(e.target.value)}>{allowed.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></Field>
        <Field label="Dari"><input type="date" className="input !py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Sampai"><input type="date" className="input !py-1.5" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <a href={csv} className="btn-ghost !min-h-9 text-xs" download>Unduh CSV</a>
      </Toolbar>
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && !data ? <PageLoading /> : Array.isArray(data) ? (
        <Table empty={!data.length} head={<>{Object.keys((data[0] as object) ?? {}).map((k) => <Th key={k}>{k}</Th>)}</>}>
          {(data as Record<string, unknown>[]).map((row, i) => <tr key={i}>{Object.entries(row).map(([k, v]) => <Td key={k} className={typeof v === "number" ? "text-right tabular-nums" : ""}>{fmt(k, v)}</Td>)}</tr>)}
        </Table>
      ) : data && typeof data === "object" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(data as Record<string, unknown>).map(([k, v]) => (
            <div key={k} className="card">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.replace(/_/g, " ")}</div>
              {v !== null && typeof v === "object" ? (
                Array.isArray(v) ? <Table empty={!v.length} head={<>{Object.keys((v[0] as object) ?? {}).map((kk) => <Th key={kk}>{kk}</Th>)}</>}>{(v as Record<string, unknown>[]).map((row, i) => <tr key={i}>{Object.entries(row).map(([kk, vv]) => <Td key={kk}>{fmt(kk, vv)}</Td>)}</tr>)}</Table>
                : <ul className="mt-1 divide-y text-sm">{Object.entries(v as Record<string, unknown>).map(([kk, vv]) => <li key={kk} className="flex justify-between py-1"><span className="text-slate-600">{kk}</span><b>{fmt(k, vv)}</b></li>)}</ul>
              ) : <div className="mt-1 text-2xl font-bold">{fmt(k, v)}</div>}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
