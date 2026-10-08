"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/shell";
import { Table, Th, Td, Tabs } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import { formatRupiah, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

type Candidate = { driver_id: number; name: string; balance: number; bank: string | null; account: string | null; account_name: string | null; has_pending: boolean };
type Payout = { id: number; driver_id: number; amount: number; status: string; reference: string | null; period_start?: string; period_end?: string; created_at: string; paid_at?: string | null; driver?: { user?: { name: string } } };

export default function PayoutPage() { return <AdminShell title="Payout mingguan"><Inner /></AdminShell>; }

function Inner() {
  const [tab, setTab] = useState<"prepare" | "pending" | "paid" | "failed">("prepare");
  const { data: cands, meta, reload: reloadCands } = useApi<Candidate[]>("/admin/payouts/prepare");
  const { data: payouts, reload } = useApi<{ data: Payout[] }>(tab === "prepare" ? null : `/admin/payouts?status=${tab}`);
  const [refs, setRefs] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "danger"; text: string } | null>(null);
  const list = payouts?.data ?? [];
  async function run(fn: () => Promise<unknown>, ok?: string) { setBusy(true); setMsg(null); try { await fn(); if (ok) setMsg({ tone: "good", text: ok }); } catch (e) { setMsg({ tone: "danger", text: errorMessage(e) }); } finally { setBusy(false); } }
  function exportCsv() {
    if (!cands) return;
    const rows = [["driver_id", "nama", "bank", "rekening", "atas_nama", "jumlah"], ...cands.filter((c) => !c.has_pending).map((c) => [c.driver_id, c.name, c.bank, c.account, c.account_name, c.balance])];
    const blob = new Blob([rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `payout-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }
  return (
    <>
      <Tabs value={tab} onChange={setTab} items={[{ value: "prepare", label: "Siap dibayar", count: cands?.length }, { value: "pending", label: "Menunggu transfer" }, { value: "paid", label: "Dibayar" }, { value: "failed", label: "Gagal" }]} />
      {msg && <Alert tone={msg.tone} className="mb-3">{msg.text}</Alert>}
      {tab === "prepare" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span>Driver aktif dengan saldo ≥ {formatRupiah(Number(meta?.payout_min ?? 0))}: <b>{cands?.length ?? 0}</b> · total <b>{formatRupiah(Number(meta?.total ?? 0))}</b></span>
            <button className="btn-ghost !min-h-9 text-xs" onClick={exportCsv} disabled={!cands?.length}>Ekspor CSV bank</button>
            <button className="btn-admin !min-h-9 text-xs" disabled={busy || !cands?.length} onClick={() => run(async () => { await api("/admin/payouts", { method: "POST" }); reloadCands(); setTab("pending"); }, "Payout dibuat dan saldo driver dipotong. Lakukan transfer lalu tandai dibayar.")}>{busy ? <Spinner /> : "Buat batch payout"}</button>
          </div>
          <Table empty={!cands?.length} head={<><Th>Driver</Th><Th>Bank</Th><Th>Rekening</Th><Th className="text-right">Jumlah</Th><Th /></>}>
            {cands?.map((c) => <tr key={c.driver_id}><Td>{c.name}</Td><Td>{c.bank ?? <span className="text-red-700">belum ada</span>}</Td><Td>{c.account} <span className="text-xs text-slate-500">{c.account_name}</span></Td><Td className="text-right tabular-nums">{formatRupiah(c.balance)}</Td><Td>{c.has_pending && <Badge tone="warn">ada payout tertunda</Badge>}</Td></tr>)}
          </Table>
        </>
      )}
      {tab !== "prepare" && (
        <Table empty={!list.length} head={<><Th>ID</Th><Th>Driver</Th><Th className="text-right">Jumlah</Th><Th>Dibuat</Th><Th>Status</Th><Th>Referensi</Th><Th /></>}>
          {list.map((p) => (
            <tr key={p.id}>
              <Td>#{p.id}</Td><Td>{p.driver?.user?.name ?? `#${p.driver_id}`}</Td><Td className="text-right tabular-nums">{formatRupiah(p.amount)}</Td><Td>{formatDateTime(p.created_at)}</Td>
              <Td><Badge tone={p.status === "paid" ? "good" : p.status === "failed" ? "danger" : "warn"}>{p.status}</Badge></Td>
              <Td>{p.status === "pending" ? <input className="input !w-40 !py-1 text-xs" placeholder="No. referensi" value={refs[p.id] ?? ""} onChange={(e) => setRefs({ ...refs, [p.id]: e.target.value })} /> : p.reference}</Td>
              <Td>{p.status === "pending" && <div className="flex gap-2"><button className="btn-success !min-h-8 text-xs" disabled={busy} onClick={() => run(async () => { await api(`/admin/payouts/${p.id}`, { method: "PATCH", body: JSON.stringify({ status: "paid", reference: refs[p.id] || undefined }) }); reload(); })}>Dibayar</button><button className="btn-ghost !min-h-8 text-xs" disabled={busy} onClick={() => run(async () => { await api(`/admin/payouts/${p.id}`, { method: "PATCH", body: JSON.stringify({ status: "failed" }) }); reload(); })}>Gagal</button></div>}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
