"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/shell";
import { Table, Th, Td, Modal, Field, Toolbar } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

type Staff = SessionUser & { status: string; last_login_at: string | null };
type Role = { name: string; permissions: string[] };

export default function StaffPage() { return <AdminShell title="Staf & peran"><Inner /></AdminShell>; }

function Inner() {
  const { data: staff, reload } = useApi<Staff[]>("/admin/staff");
  const { data: roles } = useApi<Role[]>("/admin/roles");
  const [edit, setEdit] = useState<Partial<Staff> & { password?: string; reset_2fa?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (!edit) return; setBusy(true); setErr(null);
    try {
      const body = { name: edit.name, email: edit.email, phone: edit.phone || null, password: edit.password || undefined, roles: edit.roles, status: edit.status, reset_2fa: edit.reset_2fa || undefined };
      if (edit.id) await api(`/admin/staff/${edit.id}`, { method: "PATCH", body: JSON.stringify(body) }); else await api("/admin/staff", { method: "POST", body: JSON.stringify(body) });
      setEdit(null); reload();
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <>
      {err && <Alert tone="danger" className="mb-3">{err}</Alert>}
      <Toolbar><button className="btn-admin !min-h-9 text-xs" onClick={() => setEdit({ name: "", email: "", phone: "", roles: ["ops"], status: "active", password: "" })}>+ Staf baru</button></Toolbar>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Table empty={!staff?.length} head={<><Th>Nama</Th><Th>Email</Th><Th>Peran</Th><Th>2FA</Th><Th>Status</Th><Th>Login terakhir</Th><Th /></>}>
          {staff?.map((s) => <tr key={s.id}><Td><b>{s.name}</b><div className="text-xs text-slate-500">{s.phone}</div></Td><Td>{s.email}</Td><Td>{s.roles?.map((r) => <Badge key={r} tone="admin" className="mr-1">{r}</Badge>)}</Td><Td>{s.two_factor_enabled ? <Badge tone="good">aktif</Badge> : <Badge tone="warn">belum</Badge>}</Td><Td><Badge tone={s.status === "active" ? "good" : "danger"}>{s.status}</Badge></Td><Td>{formatDateTime(s.last_login_at)}</Td><Td><button className="text-admin-600" onClick={() => setEdit({ ...s, password: "" })}>Ubah</button></Td></tr>)}
        </Table>
        <div className="card text-sm">
          <div className="mb-2 font-semibold">Matriks peran</div>
          {roles?.map((r) => <div key={r.name} className="mb-2"><b>{r.name}</b><div className="text-xs text-slate-500">{r.permissions.join(", ") || "semua izin"}</div></div>)}
        </div>
      </div>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? `Ubah ${edit.name}` : "Staf baru"}>
        {edit && (
          <div className="flex flex-col gap-3">
            <Field label="Nama"><input className="input" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            {!edit.id && <Field label="Email"><input className="input" type="email" value={edit.email ?? ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>}
            <Field label="Telepon"><input className="input" value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label={edit.id ? "Kata sandi baru (kosongkan jika tetap)" : "Kata sandi (min. 10 karakter)"}><input className="input" type="password" value={edit.password ?? ""} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
            <Field label="Peran"><div className="flex flex-wrap gap-2">{roles?.map((r) => <label key={r.name} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={edit.roles?.includes(r.name) ?? false} onChange={(e) => setEdit({ ...edit, roles: e.target.checked ? [...(edit.roles ?? []), r.name] : (edit.roles ?? []).filter((x) => x !== r.name) })} />{r.name}</label>)}</div></Field>
            {edit.id && <><Field label="Status"><select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="active">active</option><option value="blocked">blocked</option></select></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.reset_2fa ?? false} onChange={(e) => setEdit({ ...edit, reset_2fa: e.target.checked })} />Reset 2FA (staf mendaftar ulang autentikator)</label></>}
            <button className="btn-admin" disabled={busy || !edit.name || !edit.roles?.length} onClick={save}>{busy ? <Spinner /> : "Simpan"}</button>
          </div>
        )}
      </Modal>
    </>
  );
}
