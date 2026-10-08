"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/shell";
import { Table, Th, Td, Tabs, Modal, Field, Toolbar } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import { formatRupiah, formatDateTime, formatDate } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

type Tariffs = { classes: { id: number; code: string; name_id: string }[]; rows: { zone: { id: number; code: string; name: string }; prices: Record<string, number | null> }[]; upcoming: { id: number; valid_from: string; base_price: number; zone: { name: string }; vehicle_class: { name_id: string } }[]; history: { id: number; valid_from: string; valid_to: string | null; base_price: number; zone: { name: string }; vehicle_class: { name_id: string }; creator?: { name: string } | null }[] };
type Surcharge = { id: number; code: string; name_id: string; name_en: string; calc_type: string; amount: number; unit_minutes: number | null; vehicle_class_id: number | null; applies_from: string | null; applies_to: string | null; is_active: boolean; vehicle_class?: { name_id: string } | null };
type Holiday = { id: number; date: string; name: string };

export default function TariffsPage() { return <AdminShell title="Tarif & surcharge"><Inner /></AdminShell>; }

function Inner() {
  const [tab, setTab] = useState<"matrix" | "surcharges" | "holidays">("matrix");
  const { data: t, reload } = useApi<Tariffs>("/admin/tariffs");
  const { data: surcharges, reload: reloadS } = useApi<Surcharge[]>("/admin/surcharges");
  const { data: holidays, reload: reloadH } = useApi<Holiday[]>("/admin/holiday-dates");
  const [editing, setEditing] = useState(false);
  const [grid, setGrid] = useState<Record<string, string>>({});
  const [validFrom, setValidFrom] = useState("");
  const [sur, setSur] = useState<Partial<Surcharge> | null>(null);
  const [hol, setHol] = useState({ date: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "danger"; text: string } | null>(null);
  useEffect(() => { if (t) { const g: Record<string, string> = {}; t.rows.forEach((r) => t.classes.forEach((c) => { g[`${r.zone.id}:${c.code}`] = String(r.prices[c.code] ?? ""); })); setGrid(g); } }, [t]);
  async function run(fn: () => Promise<unknown>, ok?: string) { setBusy(true); setMsg(null); try { await fn(); if (ok) setMsg({ tone: "good", text: ok }); } catch (e) { setMsg({ tone: "danger", text: errorMessage(e) }); } finally { setBusy(false); } }
  async function publish() {
    if (!t) return;
    const rules = t.rows.flatMap((r) => t.classes.map((c) => ({ zone_id: r.zone.id, vehicle_class: c.code, base_price: Number(grid[`${r.zone.id}:${c.code}`] || 0) }))).filter((x) => x.base_price > 0 && String(x.base_price) !== String(t.rows.find((r) => r.zone.id === x.zone_id)?.prices[x.vehicle_class] ?? ""));
    if (!rules.length) { setMsg({ tone: "danger", text: "Tidak ada harga yang berubah." }); return; }
    await run(async () => { await api("/admin/tariffs", { method: "POST", body: JSON.stringify({ valid_from: new Date(validFrom || Date.now() + 60000).toISOString(), rules }) }); setEditing(false); reload(); }, `${rules.length} aturan tarif dipublikasikan.`);
  }
  return (
    <>
      <Tabs value={tab} onChange={setTab} items={[{ value: "matrix", label: "Matriks tarif" }, { value: "surcharges", label: "Surcharge", count: surcharges?.length }, { value: "holidays", label: "Hari raya", count: holidays?.length }]} />
      {msg && <Alert tone={msg.tone} className="mb-3">{msg.text}</Alert>}
      {tab === "matrix" && t && (
        <>
          <Toolbar>
            {!editing ? <button className="btn-admin !min-h-9 text-xs" onClick={() => setEditing(true)}>Ubah tarif</button> : (
              <>
                <Field label="Berlaku mulai" hint="Kosong = sekarang; pesanan yang sudah dibuat memakai tarif lama"><input type="datetime-local" className="input !py-1.5" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></Field>
                <button className="btn-admin !min-h-9 text-xs" disabled={busy} onClick={publish}>{busy ? <Spinner /> : "Publikasikan"}</button>
                <button className="btn-ghost !min-h-9 text-xs" onClick={() => { setEditing(false); reload(); }}>Batal</button>
              </>
            )}
          </Toolbar>
          <Table head={<><Th>Zona</Th>{t.classes.map((c) => <Th key={c.code} className="text-right">{c.name_id}</Th>)}</>}>
            {t.rows.map((r) => <tr key={r.zone.id}><Td><b>{r.zone.code}</b> {r.zone.name}</Td>{t.classes.map((c) => <Td key={c.code} className="text-right tabular-nums">{editing ? <input className="input !w-32 !py-1 text-right text-xs" value={grid[`${r.zone.id}:${c.code}`] ?? ""} onChange={(e) => setGrid({ ...grid, [`${r.zone.id}:${c.code}`]: e.target.value.replace(/\D/g, "") })} /> : formatRupiah(r.prices[c.code])}</Td>)}</tr>)}
          </Table>
          {t.upcoming.length > 0 && <div className="mt-4"><h3 className="mb-1 text-sm font-semibold">Tarif terjadwal</h3><ul className="card divide-y !p-0 text-sm">{t.upcoming.map((u) => <li key={u.id} className="flex justify-between px-3 py-1.5"><span>{u.zone.name} · {u.vehicle_class.name_id}</span><span>{formatRupiah(u.base_price)} mulai {formatDateTime(u.valid_from)}</span></li>)}</ul></div>}
          <div className="mt-4"><h3 className="mb-1 text-sm font-semibold">Riwayat perubahan</h3><Table empty={!t.history.length} head={<><Th>Berlaku</Th><Th>Zona</Th><Th>Kelas</Th><Th className="text-right">Harga</Th><Th>Oleh</Th></>}>{t.history.slice(0, 30).map((h) => <tr key={h.id}><Td>{formatDateTime(h.valid_from)}{h.valid_to ? ` – ${formatDateTime(h.valid_to)}` : ""}</Td><Td>{h.zone.name}</Td><Td>{h.vehicle_class.name_id}</Td><Td className="text-right">{formatRupiah(h.base_price)}</Td><Td>{h.creator?.name ?? "seed"}</Td></tr>)}</Table></div>
        </>
      )}
      {tab === "surcharges" && (
        <>
          <Toolbar><button className="btn-admin !min-h-9 text-xs" onClick={() => setSur({ code: "night", name_id: "", name_en: "", calc_type: "flat", amount: 0, is_active: true })}>+ Surcharge</button></Toolbar>
          <Table empty={!surcharges?.length} head={<><Th>Kode</Th><Th>Nama</Th><Th>Perhitungan</Th><Th className="text-right">Nilai</Th><Th>Kelas</Th><Th>Jam</Th><Th>Aktif</Th><Th /></>}>
            {surcharges?.map((s) => <tr key={s.id}><Td className="font-mono">{s.code}</Td><Td>{s.name_id}</Td><Td>{s.calc_type}{s.unit_minutes ? ` / ${s.unit_minutes} mnt` : ""}</Td><Td className="text-right">{s.calc_type === "percent" ? `${s.amount} %` : formatRupiah(s.amount)}</Td><Td>{s.vehicle_class?.name_id ?? "semua"}</Td><Td>{s.applies_from ? `${s.applies_from}–${s.applies_to}` : "–"}</Td><Td><Badge tone={s.is_active ? "good" : "neutral"}>{s.is_active ? "aktif" : "nonaktif"}</Badge></Td><Td><button className="text-admin-600" onClick={() => setSur(s)}>Ubah</button></Td></tr>)}
          </Table>
        </>
      )}
      {tab === "holidays" && (
        <>
          <Toolbar>
            <Field label="Tanggal"><input type="date" className="input !py-1.5" value={hol.date} onChange={(e) => setHol({ ...hol, date: e.target.value })} /></Field>
            <Field label="Nama"><input className="input !py-1.5" value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} placeholder="Nyepi" /></Field>
            <button className="btn-admin !min-h-9 text-xs" disabled={busy || !hol.date || !hol.name} onClick={() => run(async () => { await api("/admin/holiday-dates", { method: "POST", body: JSON.stringify(hol) }); setHol({ date: "", name: "" }); reloadH(); })}>Tambah</button>
          </Toolbar>
          <Table empty={!holidays?.length} head={<><Th>Tanggal</Th><Th>Nama</Th><Th /></>}>
            {holidays?.map((h) => <tr key={h.id}><Td>{formatDate(h.date)}</Td><Td>{h.name}</Td><Td><button className="text-red-700" disabled={busy} onClick={() => run(async () => { await api(`/admin/holiday-dates/${h.id}`, { method: "DELETE" }); reloadH(); })}>Hapus</button></Td></tr>)}
          </Table>
        </>
      )}
      <Modal open={Boolean(sur)} onClose={() => setSur(null)} title={sur?.id ? `Surcharge ${sur.code}` : "Surcharge baru"}>
        {sur && (
          <div className="flex flex-col gap-3">
            {!sur.id && <Field label="Kode"><select className="input" value={sur.code} onChange={(e) => setSur({ ...sur, code: e.target.value })}>{["night", "holiday", "waiting", "child_seat", "roof_rack", "extra_stop"].map((c) => <option key={c}>{c}</option>)}</select></Field>}
            <div className="grid grid-cols-2 gap-3"><Field label="Nama (ID)"><input className="input" value={sur.name_id ?? ""} onChange={(e) => setSur({ ...sur, name_id: e.target.value })} /></Field><Field label="Nama (EN)"><input className="input" value={sur.name_en ?? ""} onChange={(e) => setSur({ ...sur, name_en: e.target.value })} /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Perhitungan"><select className="input" value={sur.calc_type} onChange={(e) => setSur({ ...sur, calc_type: e.target.value })}><option value="flat">flat (Rp)</option><option value="percent">percent (%)</option><option value="per_unit">per_unit (Rp per satuan menit)</option></select></Field><Field label="Nilai"><input className="input" value={sur.amount ?? 0} onChange={(e) => setSur({ ...sur, amount: Number(e.target.value) })} /></Field></div>
            <div className="grid grid-cols-3 gap-3"><Field label="Satuan menit"><input className="input" value={sur.unit_minutes ?? ""} onChange={(e) => setSur({ ...sur, unit_minutes: e.target.value ? Number(e.target.value) : null })} /></Field><Field label="Dari (HH:mm)"><input className="input" value={sur.applies_from ?? ""} onChange={(e) => setSur({ ...sur, applies_from: e.target.value || null })} /></Field><Field label="Sampai"><input className="input" value={sur.applies_to ?? ""} onChange={(e) => setSur({ ...sur, applies_to: e.target.value || null })} /></Field></div>
            <Field label="Kelas kendaraan (kosong = semua)"><select className="input" value={sur.vehicle_class_id ?? ""} onChange={(e) => setSur({ ...sur, vehicle_class_id: e.target.value ? Number(e.target.value) : null })}><option value="">semua</option>{t?.classes.map((c) => <option key={c.id} value={c.id}>{c.name_id}</option>)}</select></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sur.is_active ?? true} onChange={(e) => setSur({ ...sur, is_active: e.target.checked })} />Aktif</label>
            <button className="btn-admin" disabled={busy} onClick={() => run(async () => { const { vehicle_class: _vc, ...body } = sur as Surcharge; void _vc; if (sur.id) await api(`/admin/surcharges/${sur.id}`, { method: "PATCH", body: JSON.stringify(body) }); else await api("/admin/surcharges", { method: "POST", body: JSON.stringify(body) }); setSur(null); reloadS(); })}>{busy ? <Spinner /> : "Simpan"}</button>
          </div>
        )}
      </Modal>
    </>
  );
}
