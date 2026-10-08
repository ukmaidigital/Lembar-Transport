"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/shell";
import { Table, Th, Td, Tabs, Modal, Field, Toolbar } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

type Vehicle = { id: number; brand: string; model: string; year: number; plate_number: string; color: string | null; seats: number; luggage_capacity: number; status: string; stnk_expires_at: string | null; kir_expires_at: string | null; has_child_seat: boolean; has_roof_rack: boolean; driver?: { id: number; user?: { name: string } } | null; vehicle_class?: { id: number; name_id: string } | null };
type VClass = { id: number; code: string; name_id: string; name_en: string; example_vehicles: string | null; max_passengers: number; max_luggage: number; sort_order: number; is_active: boolean };

export default function VehiclesPage() { return <AdminShell title="Kendaraan & kelas"><Inner /></AdminShell>; }

function Inner() {
  const [tab, setTab] = useState<"vehicles" | "classes">("vehicles");
  const [q, setQ] = useState("");
  const { data: vehicles, reload } = useApi<{ data: Vehicle[] }>(`/admin/vehicles${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const { data: classes, reload: reloadClasses } = useApi<VClass[]>("/admin/vehicle-classes");
  const [edit, setEdit] = useState<Vehicle | null>(null);
  const [cls, setCls] = useState<Partial<VClass> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const list = vehicles?.data ?? (Array.isArray(vehicles) ? (vehicles as unknown as Vehicle[]) : []);

  async function saveVehicle() {
    if (!edit) return; setBusy(true); setErr(null);
    try { await api(`/admin/vehicles/${edit.id}`, { method: "PATCH", body: JSON.stringify({ status: edit.status, has_child_seat: edit.has_child_seat, has_roof_rack: edit.has_roof_rack, vehicle_class_id: edit.vehicle_class?.id, stnk_expires_at: edit.stnk_expires_at, kir_expires_at: edit.kir_expires_at }) }); setEdit(null); reload(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  async function saveClass() {
    if (!cls) return; setBusy(true); setErr(null);
    try { if (cls.id) await api(`/admin/vehicle-classes/${cls.id}`, { method: "PATCH", body: JSON.stringify(cls) }); else await api("/admin/vehicle-classes", { method: "POST", body: JSON.stringify(cls) }); setCls(null); reloadClasses(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <Tabs value={tab} onChange={setTab} items={[{ value: "vehicles", label: "Kendaraan", count: list.length }, { value: "classes", label: "Kelas kendaraan", count: classes?.length }]} />
      {err && <Alert tone="danger" className="mb-3">{err}</Alert>}
      {tab === "vehicles" && (
        <>
          <Toolbar><Field label="Cari nopol"><input className="input !py-1.5" value={q} onChange={(e) => setQ(e.target.value)} /></Field></Toolbar>
          <Table empty={!list.length} head={<><Th>Nopol</Th><Th>Unit</Th><Th>Kelas</Th><Th>Driver</Th><Th>Kapasitas</Th><Th>STNK</Th><Th>Status</Th><Th /></>}>
            {list.map((v) => (
              <tr key={v.id}>
                <Td className="font-mono">{v.plate_number}</Td><Td>{v.brand} {v.model} {v.year} {v.color}</Td><Td>{v.vehicle_class?.name_id}</Td><Td>{v.driver?.user?.name}</Td>
                <Td>{v.seats} kursi · {v.luggage_capacity} koper{v.has_child_seat ? " · child seat" : ""}{v.has_roof_rack ? " · roof rack" : ""}</Td>
                <Td className={v.stnk_expires_at && new Date(v.stnk_expires_at) < new Date() ? "text-red-700" : ""}>{formatDate(v.stnk_expires_at)}</Td>
                <Td><Badge tone={v.status === "active" ? "good" : v.status === "inactive" ? "danger" : "warn"}>{v.status}</Badge></Td>
                <Td><button className="text-admin-600" onClick={() => setEdit(v)}>Ubah</button></Td>
              </tr>
            ))}
          </Table>
        </>
      )}
      {tab === "classes" && (
        <>
          <Toolbar><button className="btn-admin !min-h-9 text-xs" onClick={() => setCls({ code: "", name_id: "", name_en: "", max_passengers: 4, max_luggage: 3, is_active: true, sort_order: (classes?.length ?? 0) + 1 })}>+ Kelas baru</button></Toolbar>
          <Table empty={!classes?.length} head={<><Th>Kode</Th><Th>Nama</Th><Th>Contoh</Th><Th>Maks pax</Th><Th>Maks koper</Th><Th>Aktif</Th><Th /></>}>
            {classes?.map((c) => <tr key={c.id}><Td className="font-mono">{c.code}</Td><Td>{c.name_id} <span className="text-xs text-slate-500">/ {c.name_en}</span></Td><Td>{c.example_vehicles}</Td><Td>{c.max_passengers}</Td><Td>{c.max_luggage}</Td><Td>{c.is_active ? "Ya" : "Tidak"}</Td><Td><button className="text-admin-600" onClick={() => setCls(c)}>Ubah</button></Td></tr>)}
          </Table>
        </>
      )}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={`Kendaraan ${edit?.plate_number ?? ""}`}>
        {edit && (
          <div className="flex flex-col gap-3">
            <Field label="Status"><select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="pending">pending</option><option value="active">active</option><option value="inactive">inactive</option></select></Field>
            <Field label="Kelas"><select className="input" value={edit.vehicle_class?.id ?? ""} onChange={(e) => setEdit({ ...edit, vehicle_class: { id: Number(e.target.value), name_id: "" } })}>{classes?.map((c) => <option key={c.id} value={c.id}>{c.name_id}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="STNK s.d."><input type="date" className="input" value={edit.stnk_expires_at ?? ""} onChange={(e) => setEdit({ ...edit, stnk_expires_at: e.target.value || null })} /></Field><Field label="KIR s.d."><input type="date" className="input" value={edit.kir_expires_at ?? ""} onChange={(e) => setEdit({ ...edit, kir_expires_at: e.target.value || null })} /></Field></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.has_child_seat} onChange={(e) => setEdit({ ...edit, has_child_seat: e.target.checked })} />Child seat</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.has_roof_rack} onChange={(e) => setEdit({ ...edit, has_roof_rack: e.target.checked })} />Roof rack</label>
            <button className="btn-admin" disabled={busy} onClick={saveVehicle}>{busy ? <Spinner /> : "Simpan"}</button>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(cls)} onClose={() => setCls(null)} title={cls?.id ? `Kelas ${cls.code}` : "Kelas baru"}>
        {cls && (
          <div className="flex flex-col gap-3">
            {!cls.id && <Field label="Kode (snake_case)"><input className="input" value={cls.code ?? ""} onChange={(e) => setCls({ ...cls, code: e.target.value })} /></Field>}
            <div className="grid grid-cols-2 gap-3"><Field label="Nama (ID)"><input className="input" value={cls.name_id ?? ""} onChange={(e) => setCls({ ...cls, name_id: e.target.value })} /></Field><Field label="Nama (EN)"><input className="input" value={cls.name_en ?? ""} onChange={(e) => setCls({ ...cls, name_en: e.target.value })} /></Field></div>
            <Field label="Contoh kendaraan"><input className="input" value={cls.example_vehicles ?? ""} onChange={(e) => setCls({ ...cls, example_vehicles: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3"><Field label="Maks pax"><input type="number" className="input" value={cls.max_passengers ?? 0} onChange={(e) => setCls({ ...cls, max_passengers: Number(e.target.value) })} /></Field><Field label="Maks koper"><input type="number" className="input" value={cls.max_luggage ?? 0} onChange={(e) => setCls({ ...cls, max_luggage: Number(e.target.value) })} /></Field><Field label="Urutan"><input type="number" className="input" value={cls.sort_order ?? 0} onChange={(e) => setCls({ ...cls, sort_order: Number(e.target.value) })} /></Field></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cls.is_active ?? true} onChange={(e) => setCls({ ...cls, is_active: e.target.checked })} />Aktif</label>
            <button className="btn-admin" disabled={busy} onClick={saveClass}>{busy ? <Spinner /> : "Simpan"}</button>
          </div>
        )}
      </Modal>
    </>
  );
}
