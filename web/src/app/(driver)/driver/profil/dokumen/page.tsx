"use client";

import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { useDriverMe } from "@/lib/driver";
import { DocUploader } from "@/components/driver/doc-uploader";
import { PageLoading } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";

export default function DocumentsPage() { return <DriverShell><Inner /></DriverShell>; }

function Inner() {
  const { data: me, reload } = useDriverMe();
  if (!me) return <PageLoading />;
  return (
    <>
      <DriverHeader title="Dokumen" back="/driver/profil" />
      {me.has_expired_document && <Alert tone="danger" className="mb-3">Dokumen kedaluwarsa menonaktifkan tawaran trip. Unggah versi terbaru.</Alert>}
      <p className="mb-2 text-xs text-slate-500">Pengingat dikirim 30, 7, dan 1 hari sebelum SIM/STNK/SKCK kedaluwarsa. Dokumen baru ditinjau verifikator sebelum berlaku.</p>
      <DocUploader required={me.required_documents} documents={me.documents} onChange={reload} />
    </>
  );
}
