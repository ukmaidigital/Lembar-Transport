"use client";

import { use, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/shell";
import { Modal, Field, Table, Th, Td } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import type { AdminDriver } from "@/lib/admin";
import { DRIVER_STATUS_LABEL, DOC_STATUS_LABEL } from "@/lib/driver";
import { formatRupiah, formatDate, formatDateTime } from "@/lib/utils";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { PageLoading, Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";

type Meta = { recent_trips: { code: string; status: string; pickup_at: string; destination: string | null; total: number }[]; ledger: { id: number; type: string; amount: number; balance_after: number; note: string | null; created_at: string }[]; issues: { id: number; type: string; message: string | null; status: string; created_at: string }[]; activity: { id: number; description: string; created_at: string; properties: Record<string, unknown> }[] };

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AdminShell title={`Driver #${id}`}><Inner id={id} /></AdminShell>;
}

function Inner({ id }: { id: string }) {
  const { can } = useAuth();
  const { data: d, meta, reload, loading } = useApi<AdminDriver>(`/admin/drivers/${id}`);
  const m = meta as unknown as Meta | null;
  const [modal, setModal] = useState<"suspend" | "reactivate" | "note" | "upload" | null>(null);
  const [text, setText] = useState("");
  const [docType, setDocType] = useState("ktp");
  const [docExpiry, setDocExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (loading && !d) return <PageLoading />;
  if (!d) return <Alert tone="danger">Driver tidak ditemukan</Alert>;

  async function act() {
    setBusy(true); setErr(null);
    try {
      if (modal === "suspend") await api(`/admin/drivers/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason: text }) });
      if (modal === "reactivate") await api(`/admin/drivers/${id}/reactivate`, { method: "POST", body: JSON.stringify({ reason: text }) });
      if (modal === "note") await api(`/admin/drivers/${id}/notes`, { method: "POST", body: JSON.stringify({ note: text }) });
      if (modal === "upload" && file) { const fd = new FormData(); fd.append("type", docType); fd.append("file", file); if (docExpiry) fd.append("expires_at", docExpiry); await api(`/admin/drivers/${id}/documents`, { method: "POST", body: fd }); }
      setModal(null); setText(""); reload();
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-4">
      {err && <Alert tone="danger">{err}</Alert>}
      <div className="card flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-admin-50 text-xl font-bold text-admin-600">{d.name?.[0]}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-lg font-bold">{d.name}<Badge tone={d.status === "active" ? "good" : d.status === "suspended" ? "danger" : "warn"}>{DRIVER_STATUS_LABEL[d.status]}</Badge>{d.is_online && <Badge tone="good">online</Badge>}</div>
          <div className="text-sm text-slate-600">{d.phone} · NIK {d.nik ?? d.nik_masked} · {d.partner_organization ?? "Independen"} · bergabung {formatDate(d.verified_at ?? d.submitted_at)}</div>
          {d.suspension_reason && <div className="text-sm text-red-700">Ditangguhkan: {d.suspension_reason}</div>}
        </div>
        <div className="grid grid-cols-4 gap-3 text-center text-xs">
          <div><div className="text-slate-500">Rating</div><b>{Number(d.rating_avg).toFixed(1)}</b></div>
          <div><div className="text-slate-500">Trip</div><b>{d.trips_completed}</b></div>
          <div><div className="text-slate-500">Tepat waktu</div><b>{Math.round(Number(d.on_time_rate_90d ?? 0))} %</b></div>
          <div><div className="text-slate-500">Saldo</div><b className={d.below_threshold ? "text-red-700" : ""}>{formatRupiah(d.balance)}</b></div>
        </div>
        {can("drivers.manage") && (
          <div className="flex flex-wrap gap-2">
            {d.status === "active" && <button className="btn-danger !min-h-9 text-xs" onClick={() => setModal("suspend")}>Tangguhkan</button>}
            {d.status === "suspended" && <button className="btn-success !min-h-9 text-xs" onClick={() => setModal("reactivate")}>Aktifkan kembali</button>}
            <button className="btn-ghost !min-h-9 text-xs" onClick={() => setModal("note")}>+ Catatan</button>
            <button className="btn-ghost !min-h-9 text-xs" onClick={() => setModal("upload")}>Unggah dokumen</button>
            {["submitted", "revision_required"].includes(d.status) && <Link href={`/admin/verifikasi/${d.id}`} className="btn-admin !min-h-9 text-xs">Verifikasi</Link>}
          </div>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card text-sm">
          <div className="mb-2 font-semibold">Kendaraan</div>
          {d.vehicle ? <dl className="grid grid-cols-[100px_1fr] gap-y-1"><dt className="text-slate-500">Unit</dt><dd>{d.vehicle.brand} {d.vehicle.model} {d.vehicle.year} {d.vehicle.color}</dd><dt className="text-slate-500">Nopol</dt><dd className="font-mono">{d.vehicle.plate_number}</dd><dt className="text-slate-500">Kelas</dt><dd>{d.vehicle.vehicle_class_name}</dd><dt className="text-slate-500">Kapasitas</dt><dd>{d.vehicle.seats} kursi · {d.vehicle.luggage_capacity} koper</dd><dt className="text-slate-500">STNK</dt><dd>{formatDate(d.vehicle.stnk_expires_at)}</dd><dt className="text-slate-500">Status</dt><dd>{d.vehicle.status}</dd></dl> : "–"}
          <div className="mb-2 mt-4 font-semibold">Rekening</div>
          {d.bank_account ? <div>{d.bank_account.bank_code} {d.bank_account.account_number}<div className="text-xs text-slate-500">a.n. {d.bank_account.account_name}{d.bank_account.verified_at ? " · terverifikasi" : ""}</div></div> : "–"}
          <div className="mb-2 mt-4 font-semibold">Kontak darurat</div>
          <div>{d.emergency_contact_name ?? "–"} {d.emergency_contact_phone}</div>
          <div className="mb-2 mt-4 font-semibold">Alamat</div>
          <div>{d.address ?? "–"}</div>
        </div>
        <div className="card text-sm">
          <div className="mb-2 font-semibold">Dokumen</div>
          <ul className="divide-y">{d.required_documents.map((r) => { const doc = d.documents.find((x) => x.type === r.type); return <li key={r.type} className="flex items-center justify-between py-1.5"><span>{r.label}{doc?.expires_at && <span className="ml-1 text-xs text-slate-500">s.d. {formatDate(doc.expires_at)}</span>}</span><span className="flex items-center gap-2">{doc?.file_url && <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs text-admin-600">lihat</a>}<Badge tone={doc?.status === "approved" ? "good" : doc?.status === "rejected" || doc?.status === "expired" ? "danger" : doc ? "warn" : "neutral"}>{doc ? DOC_STATUS_LABEL[doc.status] : "–"}</Badge></span></li>; })}</ul>
          <div className="mb-2 mt-4 font-semibold">Catatan internal</div>
          <pre className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-600">{d.notes || "–"}</pre>
        </div>
        <div className="card text-sm">
          <div className="mb-2 font-semibold">Ledger terbaru</div>
          <ul className="divide-y">{m?.ledger.map((e) => <li key={e.id} className="flex justify-between py-1"><span>{e.type}<div className="text-[11px] text-slate-500">{formatDateTime(e.created_at)}</div></span><span className={e.amount < 0 ? "text-red-700" : "text-green-700"}>{formatRupiah(e.amount)}</span></li>)}{!m?.ledger.length && <li className="py-1 text-slate-500">–</li>}</ul>
          <div className="mb-2 mt-4 font-semibold">Masalah / laporan</div>
          <ul className="divide-y">{m?.issues.map((i) => <li key={i.id} className="py-1"><Badge tone={i.status === "open" ? "warn" : "neutral"}>{i.type}</Badge> <span className="text-xs text-slate-500">{formatDateTime(i.created_at)}</span><div className="text-xs">{i.message}</div></li>)}{!m?.issues.length && <li className="py-1 text-slate-500">–</li>}</ul>
        </div>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold">Trip terbaru</h2>
        <Table empty={!m?.recent_trips.length} head={<><Th>Kode</Th><Th>Jemput</Th><Th>Tujuan</Th><Th>Status</Th><Th className="text-right">Total</Th></>}>
          {m?.recent_trips.map((t) => <tr key={t.code}><Td><Link href={`/admin/pesanan/${t.code}`} className="font-mono text-admin-600">{t.code}</Link></Td><Td>{formatDateTime(t.pickup_at)}</Td><Td>{t.destination}</Td><Td><OrderStatusBadge status={t.status} /></Td><Td className="text-right">{formatRupiah(t.total)}</Td></tr>)}
        </Table>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold">Riwayat aktivitas</h2>
        <ul className="card divide-y !p-0 text-xs">{m?.activity.map((a) => <li key={a.id} className="flex justify-between px-3 py-1.5"><span>{a.description}</span><span className="text-slate-500">{formatDateTime(a.created_at)}</span></li>)}{!m?.activity.length && <li className="px-3 py-2 text-slate-500">–</li>}</ul>
      </div>

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === "suspend" ? "Tangguhkan driver" : modal === "reactivate" ? "Aktifkan kembali" : modal === "note" ? "Tambah catatan" : "Unggah dokumen atas nama driver"}>
        <div className="flex flex-col gap-3">
          {modal === "upload" ? (
            <>
              <Field label="Jenis"><select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>{d.required_documents.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}<option value="kir">KIR</option><option value="npwp">NPWP</option></select></Field>
              <Field label="Kedaluwarsa (bila ada)"><input type="date" className="input" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} /></Field>
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </>
          ) : <Field label={modal === "note" ? "Catatan" : "Alasan (wajib, tercatat di audit)"}><textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} /></Field>}
          <button className={modal === "suspend" ? "btn-danger" : "btn-admin"} disabled={busy || (modal === "upload" ? !file : text.trim().length < 3)} onClick={act}>{busy ? <Spinner /> : "Simpan"}</button>
        </div>
      </Modal>
    </div>
  );
}
