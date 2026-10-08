"use client";

import Link from "next/link";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { useDriverMe, DOC_STATUS_LABEL } from "@/lib/driver";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/ui/spinner";

export default function VerificationPage() { return <DriverShell><Inner /></DriverShell>; }

function Inner() {
  const { data: me } = useDriverMe(30000);
  const { logout } = useAuth();
  if (!me) return <PageLoading />;
  const icon = me.status === "rejected" ? <XCircle size={40} className="text-red-600" /> : me.status === "active" ? <CheckCircle2 size={40} className="text-green-600" /> : <Clock size={40} className="text-driver-500" />;
  return (
    <>
      <DriverHeader title="Status verifikasi" />
      <div className="card mb-3 flex flex-col items-center gap-2 text-center">
        {icon}
        <div className="text-lg font-bold">{me.status === "submitted" ? "Menunggu verifikasi" : me.status === "rejected" ? "Pendaftaran ditolak" : me.status === "active" ? "Akun aktif!" : "Perlu perbaikan"}</div>
        {me.status === "submitted" && <p className="text-sm text-slate-600">Dikirim {formatDateTime(me.submitted_at)}. Tim kami meninjau dalam {me.sla_deadline_at ? `≤ 24 jam (target ${formatDateTime(me.sla_deadline_at)})` : "1 hari kerja"}. Anda akan dihubungi lewat WhatsApp.</p>}
        {me.status === "rejected" && <p className="text-sm text-slate-600">Maaf, pendaftaran tidak dapat kami terima. {me.suspension_reason ?? ""} Hubungi Ops untuk informasi lebih lanjut.</p>}
        {me.status === "revision_required" && <Link href="/driver/daftar" className="btn-driver mt-2">Perbaiki pendaftaran</Link>}
        {me.status === "active" && <Link href="/driver" className="btn-driver mt-2">Mulai menerima trip</Link>}
      </div>
      <h2 className="mb-2 text-sm font-semibold">Dokumen</h2>
      <div className="card divide-y !p-0 text-sm">
        {me.required_documents.map((r) => { const d = me.documents.find((x) => x.type === r.type); return (
          <div key={r.type} className="flex items-center justify-between px-3 py-2"><span>{r.label}</span><Badge tone={d?.status === "approved" ? "good" : d?.status === "rejected" ? "danger" : "warn"}>{d ? DOC_STATUS_LABEL[d.status] : "Belum ada"}</Badge></div>
        ); })}
      </div>
      {me.documents.some((d) => d.status === "rejected") && <Alert tone="warn" className="mt-3">Ada dokumen yang ditolak: {me.documents.filter((d) => d.status === "rejected").map((d) => `${d.label} (${d.rejection_note ?? d.rejection_reason_code})`).join("; ")}</Alert>}
      <div className="mt-6 flex justify-center gap-4 text-xs text-slate-500"><Link href="/driver/bantuan" className="underline">Bantuan</Link><button onClick={async () => { await logout(); window.location.href = "/driver/masuk"; }} className="underline">Keluar</button></div>
    </>
  );
}
