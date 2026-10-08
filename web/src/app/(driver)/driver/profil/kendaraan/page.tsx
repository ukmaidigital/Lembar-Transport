"use client";

import { useEffect, useState } from "react";
import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { useDriverMe } from "@/lib/driver";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { PageLoading, Spinner } from "@/components/ui/spinner";

const BANKS = ["BCA", "BNI", "BRI", "Mandiri", "BSI", "NTB Syariah", "CIMB", "Permata"];

export default function VehiclePage() { return <DriverShell><Inner /></DriverShell>; }

function Inner() {
  const { data: me, reload } = useDriverMe();
  const [b, setB] = useState({ bank_code: "BCA", account_number: "", account_name: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (me?.bank_account) setB({ bank_code: me.bank_account.bank_code, account_number: me.bank_account.account_number, account_name: me.bank_account.account_name }); }, [me]);
  if (!me) return <PageLoading />;
  const v = me.vehicle;
  async function saveBank() {
    setBusy(true); setMsg(null);
    try { await api("/driver/applications/current", { method: "PATCH", body: JSON.stringify({ bank_account: b }) }); setMsg("Rekening diperbarui; Finance akan memverifikasi ulang."); reload(); } catch (e) { setMsg(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <DriverHeader title="Kendaraan & rekening" back="/driver/profil" />
      <div className="card mb-3 text-sm">
        <div className="mb-1 font-semibold">Kendaraan</div>
        {v ? (
          <>
            <div className="flex justify-between"><span className="text-slate-500">Unit</span><b>{v.brand} {v.model} {v.year}</b></div>
            <div className="flex justify-between"><span className="text-slate-500">Nopol</span><b>{v.plate_number}</b></div>
            <div className="flex justify-between"><span className="text-slate-500">Kelas</span><span>{v.vehicle_class_name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Kapasitas</span><span>{v.seats} kursi · {v.luggage_capacity} koper</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Fasilitas</span><span>{[v.has_child_seat && "child seat", v.has_roof_rack && "roof rack"].filter(Boolean).join(", ") || "–"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">STNK s.d.</span><span>{formatDate(v.stnk_expires_at)}</span></div>
            <p className="mt-2 text-xs text-slate-500">Perubahan kendaraan (ganti unit, nopol) dilakukan melalui Ops karena memerlukan verifikasi ulang STNK dan foto.</p>
          </>
        ) : <p className="text-slate-500">Belum ada kendaraan.</p>}
      </div>
      <div className="card flex flex-col gap-2 text-sm" id="rekening">
        <div className="font-semibold">Rekening payout {me.bank_account?.verified_at && <span className="text-xs font-normal text-green-700">· terverifikasi</span>}</div>
        <div><label className="label">Bank</label><select className="input" value={b.bank_code} onChange={(e) => setB({ ...b, bank_code: e.target.value })}>{BANKS.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className="label">Nomor rekening</label><input className="input" inputMode="numeric" value={b.account_number} onChange={(e) => setB({ ...b, account_number: e.target.value.replace(/\D/g, "") })} /></div>
        <div><label className="label">Nama pemilik</label><input className="input" value={b.account_name} onChange={(e) => setB({ ...b, account_name: e.target.value })} /></div>
        {msg && <Alert tone="info">{msg}</Alert>}
        <button className="btn-driver" disabled={busy} onClick={saveBank}>{busy ? <Spinner /> : "Simpan rekening"}</button>
      </div>
    </>
  );
}
