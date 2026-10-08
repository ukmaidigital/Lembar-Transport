"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { Modal, Field } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import { REJECTION_REASONS, type AdminDriver } from "@/lib/admin";
import { DOC_STATUS_LABEL } from "@/lib/driver";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { PageLoading, Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";

export default function VerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AdminShell title={`Verifikasi driver #${id}`}><Review id={id} /></AdminShell>;
}

function Review({ id }: { id: string }) {
  const router = useRouter();
  const { can } = useAuth();
  const { data: d, reload, loading } = useApi<AdminDriver>(`/admin/drivers/${id}`);
  const [current, setCurrent] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reject, setReject] = useState<{ docId: number; reason: string; note: string } | null>(null);
  const [expiry, setExpiry] = useState<Record<number, string>>({});
  const [decision, setDecision] = useState<"activate" | "request_revision" | "reject" | null>(null);
  const [note, setNote] = useState("");
  if (loading && !d) return <PageLoading />;
  if (!d) return <Alert tone="danger">Driver tidak ditemukan</Alert>;
  const docs = d.documents;
  const selected = docs.find((x) => x.id === current) ?? docs[0];
  const canVerify = can("drivers.verify");

  async function review(docId: number, approve: boolean, reason?: string, noteText?: string) {
    setBusy(true); setErr(null);
    try { await api(`/admin/drivers/${id}/documents/${docId}/review`, { method: "POST", body: JSON.stringify({ approve, reason_code: reason, note: noteText, expires_at: expiry[docId] || undefined }) }); setReject(null); reload(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  async function decide() {
    if (!decision) return;
    setBusy(true); setErr(null);
    try { await api(`/admin/drivers/${id}/decision`, { method: "POST", body: JSON.stringify({ decision, note: note || undefined }) }); setDecision(null); if (decision === "activate" || decision === "reject") router.push("/admin/verifikasi"); else reload(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  const checklist = [
    { ok: Boolean(d.nik && d.birth_date && d.address), label: "Data diri lengkap (NIK, lahir, alamat)" },
    { ok: d.birth_date ? (Date.now() - new Date(d.birth_date).getTime()) / 31557600000 >= 18 : false, label: "Usia ≥ 18 tahun" },
    { ok: Boolean(d.vehicle), label: "Kendaraan terdaftar" },
    { ok: d.vehicle ? new Date().getFullYear() - d.vehicle.year <= 10 : false, label: "Usia kendaraan ≤ 10 tahun" },
    { ok: Boolean(d.bank_account), label: "Rekening bank diisi" },
    { ok: d.bank_account && d.name ? d.bank_account.account_name.trim().toLowerCase() === d.name.trim().toLowerCase() : false, label: "Nama rekening = nama KTP" },
    { ok: d.all_required_approved, label: "Semua dokumen wajib disetujui" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {err && <Alert tone="danger">{err}</Alert>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-3">
          <div className="card text-sm">
            <div className="mb-2 flex items-center justify-between"><b className="text-base">{d.name}</b><Badge tone={d.status === "submitted" ? "warn" : "neutral"}>{d.status}</Badge></div>
            <dl className="grid grid-cols-[120px_1fr] gap-y-1">
              <dt className="text-slate-500">WhatsApp</dt><dd>{d.phone}</dd>
              <dt className="text-slate-500">NIK</dt><dd className="font-mono">{d.nik ?? d.nik_masked ?? "–"}</dd>
              <dt className="text-slate-500">Lahir</dt><dd>{formatDate(d.birth_date)}</dd>
              <dt className="text-slate-500">Alamat</dt><dd>{d.address ?? "–"}</dd>
              <dt className="text-slate-500">Darurat</dt><dd>{d.emergency_contact_name ?? "–"} {d.emergency_contact_phone}</dd>
              <dt className="text-slate-500">Kendaraan</dt><dd>{d.vehicle ? `${d.vehicle.brand} ${d.vehicle.model} ${d.vehicle.year} · ${d.vehicle.plate_number} · ${d.vehicle.vehicle_class_name} · ${d.vehicle.seats} kursi` : "–"}</dd>
              <dt className="text-slate-500">Rekening</dt><dd>{d.bank_account ? `${d.bank_account.bank_code} ${d.bank_account.account_number} a.n. ${d.bank_account.account_name}` : "–"}</dd>
              <dt className="text-slate-500">Diajukan</dt><dd>{formatDateTime(d.submitted_at)}</dd>
            </dl>
          </div>
          <div className="card">
            <div className="mb-2 text-sm font-semibold">Dokumen</div>
            <ul className="divide-y text-sm">
              {d.required_documents.map((r) => {
                const doc = docs.find((x) => x.type === r.type);
                const active = doc && selected?.id === doc.id;
                return (
                  <li key={r.type} className={`flex cursor-pointer items-center justify-between py-2 ${active ? "font-semibold text-admin-600" : ""}`} onClick={() => doc && setCurrent(doc.id)}>
                    <span>{r.label}{doc?.expires_at ? <span className="ml-1 text-xs font-normal text-slate-500">s.d. {formatDate(doc.expires_at)}</span> : ""}</span>
                    <Badge tone={doc?.status === "approved" ? "good" : doc?.status === "rejected" ? "danger" : doc ? "warn" : "neutral"}>{doc ? DOC_STATUS_LABEL[doc.status] : "Belum ada"}</Badge>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card">
            <div className="mb-2 text-sm font-semibold">Daftar periksa</div>
            <ul className="text-sm">{checklist.map((c) => <li key={c.label} className="flex items-center gap-2 py-0.5"><span className={`inline-block h-4 w-4 rounded-full text-center text-[10px] leading-4 text-white ${c.ok ? "bg-green-600" : "bg-slate-300"}`}>{c.ok ? "✓" : ""}</span>{c.label}</li>)}</ul>
            {canVerify && ["submitted", "revision_required"].includes(d.status) && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button className="btn-success !min-h-9 text-xs" disabled={!checklist.every((c) => c.ok)} onClick={() => setDecision("activate")}>Aktifkan</button>
                <button className="btn-ghost !min-h-9 text-xs" onClick={() => setDecision("request_revision")}>Minta revisi</button>
                <button className="btn-danger !min-h-9 text-xs" onClick={() => setDecision("reject")}>Tolak</button>
              </div>
            )}
          </div>
        </div>
        <div className="card flex flex-col">
          {selected ? (
            <>
              <div className="mb-2 flex items-center justify-between text-sm"><b>{selected.label} <span className="font-normal text-slate-500">v{selected.version}</span></b><Badge tone={selected.status === "approved" ? "good" : selected.status === "rejected" ? "danger" : "warn"}>{DOC_STATUS_LABEL[selected.status]}</Badge></div>
              {selected.file_url ? (
                selected.file_url.includes(".pdf") ? <iframe src={selected.file_url} className="h-[480px] w-full rounded border" title="dokumen" />
                : <a href={selected.file_url} target="_blank" rel="noreferrer"><img src={selected.file_url} alt={selected.label} className="max-h-[480px] w-full rounded border object-contain" /></a>
              ) : <div className="flex h-60 items-center justify-center text-sm text-slate-400">Pratinjau tidak tersedia</div>}
              {selected.status === "rejected" && <Alert tone="danger" className="mt-2">Ditolak: {REJECTION_REASONS.find((r) => r.code === selected.rejection_reason_code)?.label ?? selected.rejection_reason_code} {selected.rejection_note}</Alert>}
              {canVerify && selected.status === "pending" && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  {["sim", "stnk", "skck", "kir"].includes(selected.type) && <Field label="Tanggal kedaluwarsa (koreksi)"><input type="date" className="input" value={expiry[selected.id] ?? selected.expires_at ?? ""} onChange={(e) => setExpiry((x) => ({ ...x, [selected.id]: e.target.value }))} /></Field>}
                  <button className="btn-success flex-1" disabled={busy} onClick={() => review(selected.id, true)}>{busy ? <Spinner /> : "Setujui"}</button>
                  <button className="btn-danger flex-1" disabled={busy} onClick={() => setReject({ docId: selected.id, reason: REJECTION_REASONS[0].code, note: "" })}>Tolak</button>
                </div>
              )}
            </>
          ) : <p className="text-sm text-slate-500">Belum ada dokumen diunggah.</p>}
        </div>
      </div>

      <Modal open={Boolean(reject)} onClose={() => setReject(null)} title="Tolak dokumen">
        {reject && (
          <div className="flex flex-col gap-3">
            <Field label="Alasan"><select className="input" value={reject.reason} onChange={(e) => setReject({ ...reject, reason: e.target.value })}>{REJECTION_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}</select></Field>
            <Field label="Catatan untuk driver (opsional)"><input className="input" value={reject.note} onChange={(e) => setReject({ ...reject, note: e.target.value })} /></Field>
            <button className="btn-danger" disabled={busy} onClick={() => review(reject.docId, false, reject.reason, reject.note || undefined)}>{busy ? <Spinner /> : "Tolak dokumen"}</button>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(decision)} onClose={() => setDecision(null)} title={decision === "activate" ? "Aktifkan driver" : decision === "reject" ? "Tolak pendaftaran" : "Minta revisi"}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">{decision === "activate" ? "Driver akan menerima notifikasi WhatsApp dan dapat langsung online." : decision === "reject" ? "Pendaftaran ditutup; driver diberi tahu alasannya." : "Driver diminta memperbaiki dokumen yang ditolak lalu mengirim ulang."}</p>
          <Field label="Catatan"><textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button className={decision === "reject" ? "btn-danger" : "btn-admin"} disabled={busy} onClick={decide}>{busy ? <Spinner /> : "Konfirmasi"}</button>
        </div>
      </Modal>
    </div>
  );
}
