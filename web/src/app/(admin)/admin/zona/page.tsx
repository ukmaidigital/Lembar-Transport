"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/shell";
import { Table, Th, Td, Tabs, Modal, Field, Toolbar } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

type Zone = { id: number; code: string; name: string; description: string | null; sort_order: number; is_active: boolean; locations_count?: number };
type Loc = { id: number; zone_id: number | null; type: string; name_id: string; name_en: string | null; aliases: string[] | null; distance_km_est: number | null; duration_min_est: number | null; is_active: boolean; sort_order: number; zone?: { name: string } | null };
type Route = { id: number; name: string; operator: string; origin_port: string; crossing_min_min: number; crossing_min_max: number; schedule_timezone: string; is_active: boolean };

export default function ZonesPage() { return <AdminShell title="Zona, tujuan & rute feri"><Inner /></AdminShell>; }

function Inner() {
  const [tab, setTab] = useState<"zones" | "locations" | "routes">("zones");
  const { data: zones, reload: reloadZ } = useApi<Zone[]>("/admin/zones");
  const { data: locs, reload: reloadL } = useApi<Loc[]>("/admin/locations?type=poi");
  const { data: routes, reload: reloadR } = useApi<Route[]>("/admin/ferry-routes");
  const [zone, setZone] = useState<Partial<Zone> | null>(null);
  const [loc, setLoc] = useState<Partial<Loc> | null>(null);
  const [route, setRoute] = useState<Partial<Route> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>) { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); } }
  const save = (path: string, item: { id?: number }, body: unknown, after: () => void) => run(async () => { if (item.id) await api(`${path}/${item.id}`, { method: "PATCH", body: JSON.stringify(body) }); else await api(path, { method: "POST", body: JSON.stringify(body) }); after(); });
  return (
    <>
      <Tabs value={tab} onChange={setTab} items={[{ value: "zones", label: "Zona", count: zones?.length }, { value: "locations", label: "Tujuan (POI)", count: locs?.length }, { value: "routes", label: "Rute feri", count: routes?.length }]} />
      {err && <Alert tone="danger" className="mb-3">{err}</Alert>}
      {tab === "zones" && (
        <>
          <Toolbar><button className="btn-admin !min-h-9 text-xs" onClick={() => setZone({ code: "", name: "", description: "", is_active: true, sort_order: (zones?.length ?? 0) + 1 })}>+ Zona</button></Toolbar>
          <Table empty={!zones?.length} head={<><Th>Kode</Th><Th>Nama</Th><Th>Deskripsi</Th><Th>Tujuan</Th><Th>Aktif</Th><Th /></>}>
            {zones?.map((z) => <tr key={z.id}><Td className="font-mono">{z.code}</Td><Td>{z.name}</Td><Td className="text-slate-600">{z.description}</Td><Td>{z.locations_count ?? "–"}</Td><Td><Badge tone={z.is_active ? "good" : "neutral"}>{z.is_active ? "aktif" : "nonaktif"}</Badge></Td><Td><button className="text-admin-600" onClick={() => setZone(z)}>Ubah</button></Td></tr>)}
          </Table>
        </>
      )}
      {tab === "locations" && (
        <>
          <Toolbar><button className="btn-admin !min-h-9 text-xs" onClick={() => setLoc({ type: "poi", name_id: "", name_en: "", zone_id: zones?.[0]?.id ?? null, is_active: true, sort_order: 0 })}>+ Tujuan</button></Toolbar>
          <Table empty={!locs?.length} head={<><Th>Nama</Th><Th>Zona</Th><Th>Alias</Th><Th>Jarak / durasi</Th><Th>Aktif</Th><Th /></>}>
            {locs?.map((l) => <tr key={l.id}><Td>{l.name_id}{l.name_en && <span className="text-xs text-slate-500"> / {l.name_en}</span>}</Td><Td>{l.zone?.name}</Td><Td className="text-xs text-slate-500">{l.aliases?.join(", ")}</Td><Td>{l.distance_km_est ?? "–"} km · {l.duration_min_est ?? "–"} mnt</Td><Td><Badge tone={l.is_active ? "good" : "neutral"}>{l.is_active ? "aktif" : "nonaktif"}</Badge></Td><Td><button className="text-admin-600" onClick={() => setLoc(l)}>Ubah</button></Td></tr>)}
          </Table>
        </>
      )}
      {tab === "routes" && (
        <>
          <Toolbar><button className="btn-admin !min-h-9 text-xs" onClick={() => setRoute({ name: "", operator: "", origin_port: "Padang Bai", crossing_min_min: 240, crossing_min_max: 360, schedule_timezone: "WITA", is_active: true })}>+ Rute</button></Toolbar>
          <Table empty={!routes?.length} head={<><Th>Rute</Th><Th>Operator</Th><Th>Asal</Th><Th>Durasi (menit)</Th><Th>Zona waktu jadwal</Th><Th>Aktif</Th><Th /></>}>
            {routes?.map((r) => <tr key={r.id}><Td>{r.name}</Td><Td>{r.operator}</Td><Td>{r.origin_port}</Td><Td>{r.crossing_min_min}–{r.crossing_min_max}</Td><Td>{r.schedule_timezone}</Td><Td><Badge tone={r.is_active ? "good" : "neutral"}>{r.is_active ? "aktif" : "nonaktif"}</Badge></Td><Td><button className="text-admin-600" onClick={() => setRoute(r)}>Ubah</button></Td></tr>)}
          </Table>
        </>
      )}
      <Modal open={Boolean(zone)} onClose={() => setZone(null)} title={zone?.id ? `Zona ${zone.code}` : "Zona baru"}>
        {zone && <div className="flex flex-col gap-3">{!zone.id && <Field label="Kode"><input className="input" value={zone.code ?? ""} onChange={(e) => setZone({ ...zone, code: e.target.value })} /></Field>}<Field label="Nama"><input className="input" value={zone.name ?? ""} onChange={(e) => setZone({ ...zone, name: e.target.value })} /></Field><Field label="Deskripsi"><input className="input" value={zone.description ?? ""} onChange={(e) => setZone({ ...zone, description: e.target.value })} /></Field><Field label="Urutan"><input type="number" className="input" value={zone.sort_order ?? 0} onChange={(e) => setZone({ ...zone, sort_order: Number(e.target.value) })} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={zone.is_active ?? true} onChange={(e) => setZone({ ...zone, is_active: e.target.checked })} />Aktif</label><button className="btn-admin" disabled={busy} onClick={() => save("/admin/zones", zone, { code: zone.code, name: zone.name, description: zone.description, sort_order: zone.sort_order, is_active: zone.is_active }, () => { setZone(null); reloadZ(); })}>{busy ? <Spinner /> : "Simpan"}</button></div>}
      </Modal>
      <Modal open={Boolean(loc)} onClose={() => setLoc(null)} title={loc?.id ? loc.name_id ?? "" : "Tujuan baru"}>
        {loc && <div className="flex flex-col gap-3"><div className="grid grid-cols-2 gap-3"><Field label="Nama (ID)"><input className="input" value={loc.name_id ?? ""} onChange={(e) => setLoc({ ...loc, name_id: e.target.value })} /></Field><Field label="Nama (EN)"><input className="input" value={loc.name_en ?? ""} onChange={(e) => setLoc({ ...loc, name_en: e.target.value })} /></Field></div><Field label="Zona"><select className="input" value={loc.zone_id ?? ""} onChange={(e) => setLoc({ ...loc, zone_id: Number(e.target.value) })}>{zones?.map((z) => <option key={z.id} value={z.id}>{z.code} · {z.name}</option>)}</select></Field><Field label="Alias (pisahkan koma)"><input className="input" value={loc.aliases?.join(", ") ?? ""} onChange={(e) => setLoc({ ...loc, aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Jarak (km)"><input className="input" value={loc.distance_km_est ?? ""} onChange={(e) => setLoc({ ...loc, distance_km_est: e.target.value ? Number(e.target.value) : null })} /></Field><Field label="Durasi (menit)"><input className="input" value={loc.duration_min_est ?? ""} onChange={(e) => setLoc({ ...loc, duration_min_est: e.target.value ? Number(e.target.value) : null })} /></Field></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={loc.is_active ?? true} onChange={(e) => setLoc({ ...loc, is_active: e.target.checked })} />Aktif</label><button className="btn-admin" disabled={busy} onClick={() => save("/admin/locations", loc, { type: "poi", name_id: loc.name_id, name_en: loc.name_en || null, zone_id: loc.zone_id, aliases: loc.aliases, distance_km_est: loc.distance_km_est, duration_min_est: loc.duration_min_est, is_active: loc.is_active, sort_order: loc.sort_order ?? 0 }, () => { setLoc(null); reloadL(); })}>{busy ? <Spinner /> : "Simpan"}</button></div>}
      </Modal>
      <Modal open={Boolean(route)} onClose={() => setRoute(null)} title={route?.id ? route.name ?? "" : "Rute baru"}>
        {route && <div className="flex flex-col gap-3"><Field label="Nama rute"><input className="input" value={route.name ?? ""} onChange={(e) => setRoute({ ...route, name: e.target.value })} placeholder="Padang Bai – Lembar" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Operator"><input className="input" value={route.operator ?? ""} onChange={(e) => setRoute({ ...route, operator: e.target.value })} /></Field><Field label="Pelabuhan asal"><input className="input" value={route.origin_port ?? ""} onChange={(e) => setRoute({ ...route, origin_port: e.target.value })} /></Field><Field label="Durasi min (menit)"><input type="number" className="input" value={route.crossing_min_min ?? 0} onChange={(e) => setRoute({ ...route, crossing_min_min: Number(e.target.value) })} /></Field><Field label="Durasi maks (menit)"><input type="number" className="input" value={route.crossing_min_max ?? 0} onChange={(e) => setRoute({ ...route, crossing_min_max: Number(e.target.value) })} /></Field><Field label="Zona waktu jadwal"><select className="input" value={route.schedule_timezone} onChange={(e) => setRoute({ ...route, schedule_timezone: e.target.value })}><option>WITA</option><option>WIB</option><option>WIT</option></select></Field></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={route.is_active ?? true} onChange={(e) => setRoute({ ...route, is_active: e.target.checked })} />Aktif</label><button className="btn-admin" disabled={busy} onClick={() => save("/admin/ferry-routes", route, route, () => { setRoute(null); reloadR(); })}>{busy ? <Spinner /> : "Simpan"}</button></div>}
      </Modal>
    </>
  );
}
