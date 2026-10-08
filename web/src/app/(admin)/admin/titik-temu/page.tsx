"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/shell";
import { Modal, Field, Toolbar } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

type MP = { id: number; type: string; name_id: string; name_en: string | null; instructions_id: string | null; instructions_en: string | null; photo_url: string | null; is_active: boolean; sort_order: number };

export default function MeetingPointsPage() { return <AdminShell title="Titik temu di pelabuhan"><Inner /></AdminShell>; }

function Inner() {
  const { data, reload } = useApi<MP[]>("/admin/locations?type=meeting_point");
  const [edit, setEdit] = useState<Partial<MP> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (!edit) return; setBusy(true); setErr(null);
    try {
      const body = { type: "meeting_point", name_id: edit.name_id, name_en: edit.name_en || null, instructions_id: edit.instructions_id || null, instructions_en: edit.instructions_en || null, is_active: edit.is_active ?? true, sort_order: edit.sort_order ?? 0 };
      const saved = edit.id ? await api<MP>(`/admin/locations/${edit.id}`, { method: "PATCH", body: JSON.stringify(body) }) : await api<MP>("/admin/locations", { method: "POST", body: JSON.stringify(body) });
      if (file) { const fd = new FormData(); fd.append("file", file); await api(`/admin/locations/${saved.id ?? edit.id}/photo`, { method: "POST", body: fd }); }
      setEdit(null); setFile(null); reload();
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <>
      {err && <Alert tone="danger" className="mb-3">{err}</Alert>}
      <Toolbar><button className="btn-admin !min-h-9 text-xs" onClick={() => setEdit({ name_id: "", name_en: "", instructions_id: "", instructions_en: "", is_active: true, sort_order: (data?.length ?? 0) + 1 })}>+ Titik temu</button></Toolbar>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((m) => (
          <div key={m.id} className="card">
            {m.photo_url ? <img src={m.photo_url} alt={m.name_id} className="mb-2 h-36 w-full rounded-lg object-cover" /> : <div className="mb-2 flex h-36 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">Belum ada foto</div>}
            <div className="flex items-center justify-between"><b>{m.name_id}</b><Badge tone={m.is_active ? "good" : "neutral"}>{m.is_active ? "aktif" : "nonaktif"}</Badge></div>
            <div className="text-xs text-slate-500">{m.name_en}</div>
            <p className="mt-1 text-sm text-slate-600">{m.instructions_id}</p>
            <button className="mt-2 text-sm text-admin-600" onClick={() => setEdit(m)}>Ubah</button>
          </div>
        ))}
        {!data?.length && <p className="text-sm text-slate-500">Belum ada titik temu.</p>}
      </div>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? edit.name_id ?? "" : "Titik temu baru"}>
        {edit && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3"><Field label="Nama (ID)"><input className="input" value={edit.name_id ?? ""} onChange={(e) => setEdit({ ...edit, name_id: e.target.value })} /></Field><Field label="Nama (EN)"><input className="input" value={edit.name_en ?? ""} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} /></Field></div>
            <Field label="Petunjuk (ID)"><textarea className="input" rows={2} value={edit.instructions_id ?? ""} onChange={(e) => setEdit({ ...edit, instructions_id: e.target.value })} /></Field>
            <Field label="Instructions (EN)"><textarea className="input" rows={2} value={edit.instructions_en ?? ""} onChange={(e) => setEdit({ ...edit, instructions_en: e.target.value })} /></Field>
            <Field label="Foto (JPG/PNG ≤ 5 MB)"><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active ?? true} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />Aktif</label>
            <button className="btn-admin" disabled={busy || !edit.name_id} onClick={save}>{busy ? <Spinner /> : "Simpan"}</button>
          </div>
        )}
      </Modal>
    </>
  );
}
