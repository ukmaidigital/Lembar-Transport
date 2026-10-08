"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { useDriverMe } from "@/lib/driver";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth";
import { api, errorMessage } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { PageLoading, Spinner } from "@/components/ui/spinner";
import { DocUploader } from "@/components/driver/doc-uploader";

type VehicleClass = { code: string; name_id: string; max_passengers: number; max_luggage: number };
const STEPS = ["Data diri", "Kendaraan", "Rekening", "Dokumen", "Kirim"];
const BANKS = ["BCA", "BNI", "BRI", "Mandiri", "BSI", "NTB Syariah", "CIMB", "Permata"];

export default function RegisterPage() { return <DriverShell><Wizard /></DriverShell>; }

function Wizard() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { data: me, reload } = useDriverMe();
  const { data: classes } = useApi<VehicleClass[]>("/public/vehicle-classes");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [p, setP] = useState({ name: "", nik: "", birth_date: "", address: "", emergency_contact_name: "", emergency_contact_phone: "" });
  const [v, setV] = useState({ vehicle_class: "mpv_standard", brand: "", model: "", year: String(new Date().getFullYear() - 3), plate_number: "", color: "", seats: "7", luggage_capacity: "3", has_child_seat: false, has_roof_rack: false, stnk_expires_at: "" });
  const [b, setB] = useState({ bank_code: "BCA", account_number: "", account_name: "" });
  useEffect(() => {
    if (!me) return;
    setP({ name: me.name ?? "", nik: me.nik ?? "", birth_date: me.birth_date ?? "", address: me.address ?? "", emergency_contact_name: me.emergency_contact_name ?? "", emergency_contact_phone: me.emergency_contact_phone ?? "" });
    if (me.vehicle) setV({ vehicle_class: me.vehicle.vehicle_class, brand: me.vehicle.brand, model: me.vehicle.model, year: String(me.vehicle.year), plate_number: me.vehicle.plate_number, color: me.vehicle.color ?? "", seats: String(me.vehicle.seats ?? 7), luggage_capacity: String(me.vehicle.luggage_capacity ?? 3), has_child_seat: me.vehicle.has_child_seat, has_roof_rack: me.vehicle.has_roof_rack, stnk_expires_at: me.vehicle.stnk_expires_at ?? "" });
    if (me.bank_account) setB({ bank_code: me.bank_account.bank_code, account_number: me.bank_account.account_number, account_name: me.bank_account.account_name });
  }, [me]);
  useEffect(() => {
    if (me && !["draft", "revision_required"].includes(me.status)) router.replace(me.status === "submitted" || me.status === "rejected" ? "/driver/verifikasi" : "/driver");
  }, [me, router]);
  if (!me) return <PageLoading />;

  async function save(body: Record<string, unknown>, nextStep: number) {
    setBusy(true); setErr(null);
    try { await api("/driver/applications/current", { method: "PATCH", body: JSON.stringify(body) }); reload(); setStep(nextStep); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true); setErr(null);
    try { await api("/driver/applications/current/submit", { method: "POST" }); await refresh(); router.replace("/driver/verifikasi"); } catch (e) { setErr(errorMessage(e)); setBusy(false); }
  }
  const nav = (onNext: () => void, nextLabel = "Simpan & lanjut", disabled = false) => (
    <div className="mt-3 flex gap-2">{step > 0 && <button className="btn-ghost flex-1" onClick={() => setStep(step - 1)}>Kembali</button>}<button className="btn-driver flex-1" disabled={busy || disabled} onClick={onNext}>{busy ? <Spinner /> : nextLabel}</button></div>
  );
  const missing = me.missing_documents;

  return (
    <>
      <DriverHeader title="Pendaftaran mitra driver" />
      {me.status === "revision_required" && <Alert tone="warn" className="mb-3">Verifikator meminta perbaikan. Periksa dokumen yang ditolak lalu kirim ulang.</Alert>}
      <ol className="mb-3 grid grid-cols-5 gap-1 text-[10px] text-slate-500">{STEPS.map((s, i) => <li key={s} className={`rounded px-1 py-1 text-center ${i === step ? "bg-driver-500 font-bold text-white" : i < step ? "bg-driver-50 text-driver-600" : "bg-slate-200"}`}>{s}</li>)}</ol>
      {err && <Alert tone="danger" className="mb-3">{err}</Alert>}

      {step === 0 && (
        <div className="card flex flex-col gap-2">
          <div><label className="label">Nama lengkap sesuai KTP</label><input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
          <div><label className="label">NIK (16 digit)</label><input className="input" inputMode="numeric" maxLength={16} value={p.nik} onChange={(e) => setP({ ...p, nik: e.target.value.replace(/\D/g, "") })} /></div>
          <div><label className="label">Tanggal lahir (min. 18 tahun)</label><input type="date" className="input" value={p.birth_date} onChange={(e) => setP({ ...p, birth_date: e.target.value })} /></div>
          <div><label className="label">Alamat domisili</label><textarea className="input" rows={2} value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Kontak darurat</label><input className="input" value={p.emergency_contact_name} onChange={(e) => setP({ ...p, emergency_contact_name: e.target.value })} /></div>
            <div><label className="label">No. HP darurat</label><input className="input" inputMode="tel" value={p.emergency_contact_phone} onChange={(e) => setP({ ...p, emergency_contact_phone: e.target.value })} /></div>
          </div>
          {nav(() => save(Object.fromEntries(Object.entries(p).filter(([, val]) => val !== "")), 1), "Simpan & lanjut", !p.name || p.nik.length !== 16 || !p.birth_date || !p.address)}
        </div>
      )}

      {step === 1 && (
        <div className="card flex flex-col gap-2">
          <div><label className="label">Kelas kendaraan</label>
            <select className="input" value={v.vehicle_class} onChange={(e) => setV({ ...v, vehicle_class: e.target.value })}>{classes?.map((c) => <option key={c.code} value={c.code}>{c.name_id} · {c.max_passengers} pax</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Merek</label><input className="input" value={v.brand} onChange={(e) => setV({ ...v, brand: e.target.value })} placeholder="Toyota" /></div>
            <div><label className="label">Model</label><input className="input" value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} placeholder="Avanza" /></div>
            <div><label className="label">Tahun (maks. 10 tahun)</label><input className="input" inputMode="numeric" value={v.year} onChange={(e) => setV({ ...v, year: e.target.value })} /></div>
            <div><label className="label">Nomor polisi</label><input className="input uppercase" value={v.plate_number} onChange={(e) => setV({ ...v, plate_number: e.target.value.toUpperCase() })} placeholder="DR 1234 AB" /></div>
            <div><label className="label">Warna</label><input className="input" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} /></div>
            <div><label className="label">STNK berlaku s.d.</label><input type="date" className="input" value={v.stnk_expires_at} onChange={(e) => setV({ ...v, stnk_expires_at: e.target.value })} /></div>
            <div><label className="label">Kursi penumpang</label><input className="input" inputMode="numeric" value={v.seats} onChange={(e) => setV({ ...v, seats: e.target.value })} /></div>
            <div><label className="label">Kapasitas bagasi (koper)</label><input className="input" inputMode="numeric" value={v.luggage_capacity} onChange={(e) => setV({ ...v, luggage_capacity: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.has_child_seat} onChange={(e) => setV({ ...v, has_child_seat: e.target.checked })} />Punya child seat</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.has_roof_rack} onChange={(e) => setV({ ...v, has_roof_rack: e.target.checked })} />Punya roof rack</label>
          {nav(() => save({ vehicle: { ...v, year: Number(v.year), seats: Number(v.seats), luggage_capacity: Number(v.luggage_capacity), color: v.color || null, stnk_expires_at: v.stnk_expires_at || null } }, 2), "Simpan & lanjut", !v.brand || !v.model || !v.plate_number)}
        </div>
      )}

      {step === 2 && (
        <div className="card flex flex-col gap-2">
          <p className="text-xs text-slate-500">Rekening untuk payout mingguan. Nama pemilik harus sama dengan nama KTP.</p>
          <div><label className="label">Bank</label><select className="input" value={b.bank_code} onChange={(e) => setB({ ...b, bank_code: e.target.value })}>{BANKS.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label className="label">Nomor rekening</label><input className="input" inputMode="numeric" value={b.account_number} onChange={(e) => setB({ ...b, account_number: e.target.value.replace(/\D/g, "") })} /></div>
          <div><label className="label">Nama pemilik rekening</label><input className="input" value={b.account_name} onChange={(e) => setB({ ...b, account_name: e.target.value })} /></div>
          {nav(() => save({ bank_account: b }, 3), "Simpan & lanjut", b.account_number.length < 6 || !b.account_name)}
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="mb-2 text-xs text-slate-500">Unggah foto yang jelas (JPG/PNG/PDF ≤ 5 MB). Dokumen disimpan terenkripsi dan hanya dilihat verifikator.</p>
          <DocUploader required={me.required_documents} documents={me.documents} onChange={reload} />
          {nav(() => setStep(4), "Lanjut", missing.length > 0)}
          {missing.length > 0 && <p className="mt-1 text-center text-xs text-slate-500">Masih kurang: {missing.map((m) => m.label).join(", ")}</p>}
        </div>
      )}

      {step === 4 && (
        <div className="card flex flex-col gap-2 text-sm">
          <div className="font-semibold">Ringkasan</div>
          <div className="flex justify-between"><span className="text-slate-500">Nama</span><b>{me.name}</b></div>
          <div className="flex justify-between"><span className="text-slate-500">NIK</span><b>{me.nik_masked}</b></div>
          <div className="flex justify-between"><span className="text-slate-500">Kendaraan</span><b>{me.vehicle ? `${me.vehicle.brand} ${me.vehicle.model} ${me.vehicle.year} · ${me.vehicle.plate_number}` : "–"}</b></div>
          <div className="flex justify-between"><span className="text-slate-500">Rekening</span><b>{me.bank_account ? `${me.bank_account.bank_code} ${me.bank_account.account_number}` : "–"}</b></div>
          <div className="flex justify-between"><span className="text-slate-500">Dokumen</span><b>{me.documents.length}/{me.required_documents.length}</b></div>
          <p className="mt-2 text-xs text-slate-500">Dengan mengirim, Anda menyetujui Perjanjian Kemitraan Driver v1.0: komisi 15 % per trip, standar layanan (papan nama, tepat waktu, kendaraan bersih), dan kebijakan penangguhan.</p>
          {nav(submit, "Kirim pendaftaran")}
        </div>
      )}
    </>
  );
}
