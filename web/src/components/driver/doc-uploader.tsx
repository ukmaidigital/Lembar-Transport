"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { DriverDoc } from "@/lib/driver";
import { DOC_STATUS_LABEL } from "@/lib/driver";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/utils";

type Req = { type: string; label: string; has_expiry: boolean };

/** One row per required document: status, rejection reason, (re)upload with optional expiry date. */
export function DocUploader({ required, documents, onChange }: { required: Req[]; documents: DriverDoc[]; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [expiry, setExpiry] = useState<Record<string, string>>({});

  async function upload(type: string, file: File) {
    setBusy(type); setErrs((x) => ({ ...x, [type]: "" }));
    const fd = new FormData(); fd.append("type", type); fd.append("file", file);
    if (expiry[type]) fd.append("expires_at", expiry[type]);
    try { await api("/driver/documents", { method: "POST", body: fd }); onChange(); } catch (e) { setErrs((x) => ({ ...x, [type]: errorMessage(e) })); } finally { setBusy(null); }
  }
  const tone = (s?: string) => (s === "approved" ? "good" : s === "rejected" || s === "expired" ? "danger" : s === "pending" ? "warn" : "neutral");

  return (
    <div className="flex flex-col gap-2">
      {required.map((r) => {
        const d = documents.find((x) => x.type === r.type);
        const needsUpload = !d || d.status === "rejected" || d.status === "expired";
        return (
          <div key={r.type} className={`card ${d?.status === "rejected" ? "border-red-200" : ""}`}>
            <div className="flex items-center justify-between">
              <div className="font-medium">{r.label}</div>
              <Badge tone={tone(d?.status)}>{d ? DOC_STATUS_LABEL[d.status] ?? d.status : "Belum diunggah"}</Badge>
            </div>
            {d?.expires_at && <div className="text-xs text-slate-500">Berlaku s.d. {formatDate(d.expires_at)}</div>}
            {d?.status === "rejected" && <p className="mt-1 text-xs text-red-700">Ditolak: {d.rejection_note ?? d.rejection_reason_code}. Unggah ulang.</p>}
            {d?.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs text-driver-600 underline">Lihat berkas</a>}
            {errs[r.type] && <Alert tone="danger" className="mt-2">{errs[r.type]}</Alert>}
            {(needsUpload || d?.status === "pending") && (
              <div className="mt-2 flex flex-col gap-2">
                {r.has_expiry && <div><label className="label">Tanggal kedaluwarsa (wajib)</label><input type="date" className="input" data-doc={r.type} value={expiry[r.type] ?? ""} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={(e) => setExpiry((x) => ({ ...x, [r.type]: e.target.value }))} /></div>}
                <label className={`btn-ghost cursor-pointer ${busy === r.type || (r.has_expiry && !expiry[r.type]) ? "pointer-events-none opacity-60" : ""}`}>
                  {busy === r.type ? <Spinner /> : d ? "Unggah ulang" : "Unggah foto / PDF"}
                  <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" data-doc={r.type} disabled={busy !== null || (r.has_expiry && !expiry[r.type])} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(r.type, f); e.target.value = ""; }} />
                </label>
                {r.has_expiry && !expiry[r.type] && <p className="text-[11px] text-slate-500">Isi tanggal kedaluwarsa dulu, lalu unggah.</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
