"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { Field } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import { DestinationSelect, type ZoneWithLocations } from "@/components/destination-select";
import { formatRupiah, witaToIso } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

type Quote = { options: { vehicle_class: string; name: string; fits: boolean; total: number; reasons: string[] }[] };

export default function NewOrderPage() { return <AdminShell title="Pesanan manual (telepon / walk-in)"><Inner /></AdminShell>; }

function Inner() {
  const router = useRouter();
  const { data: zones } = useApi<ZoneWithLocations[]>("/public/zones");
  const { data: routes } = useApi<{ id: number; name: string; operator: string }[]>("/public/ferry-routes");
  const [f, setF] = useState({ dest: "", date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), time: "08:00", pax: 2, bags: 2, child: 0, roof: false, cls: "mpv_standard", name: "", phone: "", email: "", notes: "", method: "cash", routeId: "", override: "", overrideReason: "", force: false });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pickup = witaToIso(f.date, f.time);
  async function getQuote() {
    setBusy(true); setErr(null);
    try { const q = await api<Quote>("/public/quotes", { method: "POST", body: JSON.stringify({ destination_location_id: Number(f.dest), pickup_at: pickup, passengers: f.pax, luggage_units: f.bags, child_seats: f.child, needs_roof_rack: f.roof }) }); setQuote(q); const fit = q.options.find((o) => o.fits); if (fit) setF({ ...f, cls: fit.vehicle_class }); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true); setErr(null);
    try {
      const body = { destination_location_id: Number(f.dest), pickup_at: pickup, passengers: f.pax, luggage_units: f.bags, child_seats: f.child, needs_roof_rack: f.roof, vehicle_class: f.cls, ferry: f.routeId ? { route_id: Number(f.routeId) } : undefined, contact: { name: f.name, phone: f.phone, email: f.email || undefined, locale: "id" }, payment_method: f.method, notes: f.notes || undefined, price_override: f.override ? Number(f.override) : undefined, override_reason: f.override ? f.overrideReason : undefined, force_capacity: f.force || undefined };
      const o = await api<{ code: string }>("/admin/orders", { method: "POST", body: JSON.stringify(body), idempotencyKey: `admin-${Date.now()}` });
      router.push(`/admin/pesanan/${o.code}`);
    } catch (e) { setErr(errorMessage(e)); setBusy(false); }
  }
  const chosen = quote?.options.find((o) => o.vehicle_class === f.cls);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {err && <Alert tone="danger">{err}</Alert>}
      <div className="card grid gap-3 sm:grid-cols-2">
        <Field label="Tujuan" className="sm:col-span-2"><DestinationSelect zones={zones ?? []} value={f.dest} onChange={(v) => { setF({ ...f, dest: v }); setQuote(null); }} placeholder="Pilih tujuan…" /></Field>
        <Field label="Tanggal jemput"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Jam jemput (WITA)"><input type="time" className="input" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Penumpang"><input type="number" className="input" value={f.pax} onChange={(e) => setF({ ...f, pax: Number(e.target.value) })} /></Field>
        <Field label="Bagasi"><input type="number" className="input" value={f.bags} onChange={(e) => setF({ ...f, bags: Number(e.target.value) })} /></Field>
        <Field label="Child seat"><input type="number" className="input" value={f.child} onChange={(e) => setF({ ...f, child: Number(e.target.value) })} /></Field>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={f.roof} onChange={(e) => setF({ ...f, roof: e.target.checked })} />Roof rack</label>
        <Field label="Rute kapal (opsional)" className="sm:col-span-2"><select className="input" value={f.routeId} onChange={(e) => setF({ ...f, routeId: e.target.value })}><option value="">—</option>{routes?.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.operator}</option>)}</select></Field>
        <button className="btn-ghost sm:col-span-2" disabled={!f.dest || busy} onClick={getQuote}>{busy ? <Spinner /> : "Hitung harga"}</button>
      </div>
      {quote && (
        <div className="card">
          <div className="mb-2 text-sm font-semibold">Kelas kendaraan</div>
          <div className="grid gap-2 sm:grid-cols-2">{quote.options.map((o) => <label key={o.vehicle_class} className={`flex items-center justify-between rounded-lg border p-3 text-sm ${f.cls === o.vehicle_class ? "border-admin-500 bg-admin-50/40" : ""} ${!o.fits ? "opacity-60" : ""}`}><span className="flex items-center gap-2"><input type="radio" checked={f.cls === o.vehicle_class} onChange={() => setF({ ...f, cls: o.vehicle_class })} />{o.name}{!o.fits && <span className="text-xs text-red-700">({o.reasons.join(", ")})</span>}</span><b>{formatRupiah(o.total)}</b></label>)}</div>
          {chosen && !chosen.fits && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={f.force} onChange={(e) => setF({ ...f, force: e.target.checked })} />Paksa kapasitas (customer menyetujui)</label>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Nama customer"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="WhatsApp"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Email (opsional)"><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Pembayaran"><select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="cash">Tunai ke driver</option><option value="bank_transfer">Transfer (bukti diunggah customer / Ops)</option></select></Field>
            <Field label="Catatan" className="sm:col-span-2"><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
            <Field label="Override harga (opsional)" hint="Memerlukan alasan; tercatat di audit log"><input className="input" value={f.override} onChange={(e) => setF({ ...f, override: e.target.value.replace(/\D/g, "") })} placeholder={chosen ? String(chosen.total) : ""} /></Field>
            <Field label="Alasan override"><input className="input" value={f.overrideReason} onChange={(e) => setF({ ...f, overrideReason: e.target.value })} disabled={!f.override} /></Field>
          </div>
          <button className="btn-admin mt-3 w-full" disabled={busy || !f.name || !f.phone || (Boolean(f.override) && f.overrideReason.length < 3)} onClick={submit}>{busy ? <Spinner /> : `Buat pesanan · ${formatRupiah(f.override ? Number(f.override) : chosen?.total ?? 0)}`}</button>
        </div>
      )}
    </div>
  );
}
