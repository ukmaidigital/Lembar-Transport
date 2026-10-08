"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { Field } from "@/components/admin/ui";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export default function NewDriverPage() { return <AdminShell title="Daftarkan driver (atas nama)"><Inner /></AdminShell>; }

function Inner() {
  const router = useRouter();
  const { data: classes } = useApi<{ code: string; name_id: string }[]>("/public/vehicle-classes");
  const [f, setF] = useState({ name: "", phone: "", nik: "", birth_date: "", address: "", vehicle_class: "mpv_standard", brand: "", model: "", year: String(new Date().getFullYear() - 2), plate_number: "", seats: "7", luggage_capacity: "3" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const body = { name: f.name, phone: f.phone, nik: f.nik || undefined, birth_date: f.birth_date || undefined, address: f.address || undefined, vehicle: f.brand ? { vehicle_class: f.vehicle_class, brand: f.brand, model: f.model, year: Number(f.year), plate_number: f.plate_number, seats: Number(f.seats), luggage_capacity: Number(f.luggage_capacity) } : undefined };
      const d = await api<{ id: number }>("/admin/drivers", { method: "POST", body: JSON.stringify(body) });
      router.push(`/admin/driver/${d.id}`);
    } catch (e2) { setErr(errorMessage(e2)); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card mx-auto flex max-w-2xl flex-col gap-3">
      <p className="text-sm text-slate-600">Untuk driver yang mendaftar lewat koperasi/paguyuban. Dokumen diunggah dari halaman detail; driver masuk ke aplikasi dengan OTP ke nomor WhatsApp ini.</p>
      {err && <Alert tone="danger">{err}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama sesuai KTP"><input className="input" value={f.name} onChange={set("name")} required /></Field>
        <Field label="Nomor WhatsApp"><input className="input" value={f.phone} onChange={set("phone")} required /></Field>
        <Field label="NIK"><input className="input" maxLength={16} value={f.nik} onChange={set("nik")} /></Field>
        <Field label="Tanggal lahir"><input type="date" className="input" value={f.birth_date} onChange={set("birth_date")} /></Field>
        <Field label="Alamat" className="sm:col-span-2"><input className="input" value={f.address} onChange={set("address")} /></Field>
        <Field label="Kelas kendaraan"><select className="input" value={f.vehicle_class} onChange={set("vehicle_class")}>{classes?.map((c) => <option key={c.code} value={c.code}>{c.name_id}</option>)}</select></Field>
        <Field label="Nopol"><input className="input uppercase" value={f.plate_number} onChange={set("plate_number")} /></Field>
        <Field label="Merek"><input className="input" value={f.brand} onChange={set("brand")} /></Field>
        <Field label="Model"><input className="input" value={f.model} onChange={set("model")} /></Field>
        <Field label="Tahun"><input className="input" value={f.year} onChange={set("year")} /></Field>
        <Field label="Kursi / koper"><div className="flex gap-2"><input className="input" value={f.seats} onChange={set("seats")} /><input className="input" value={f.luggage_capacity} onChange={set("luggage_capacity")} /></div></Field>
      </div>
      <button className="btn-admin" disabled={busy}>{busy ? <Spinner /> : "Simpan driver"}</button>
    </form>
  );
}
