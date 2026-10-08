"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Phone } from "lucide-react";
import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { api, errorMessage } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

const OPS_PHONE = "+6281100000000";
const GUIDE = [
  ["Standar layanan", "Tiba di titik temu sebelum estimasi sandar, bawa papan nama (menu Papan), kendaraan bersih dan ber-AC, tidak meminta tambahan biaya di luar tarif aplikasi."],
  ["Alur status trip", "Berangkat → Tiba di titik temu → Penumpang naik → Selesai. Tekan tepat waktu; status tersimpan walau sinyal hilang dan dikirim otomatis saat online."],
  ["Pembayaran tunai", "Terima tunai sesuai tagihan di aplikasi, catat jumlahnya saat menyelesaikan trip. Komisi 15 % dipotong dari saldo; jaga saldo di atas ambang agar tetap menerima tawaran."],
  ["Kapal terlambat", "Tunggu gratis 60 menit dihitung sejak kapal sandar. Setelahnya biaya tunggu per 30 menit dapat diajukan dan disetujui Ops."],
  ["Penumpang tidak hadir", "Setelah tunggu gratis + 30 menit tenggang dan ≥ 3 upaya kontak (WA/telepon), ajukan no-show dari halaman trip; Ops mengonfirmasi dan Anda menerima kompensasi bila trip prabayar."],
  ["Undur diri", "Hanya dari status Ditugaskan, dengan alasan. Terlalu sering undur diri menurunkan skor penerimaan dan prioritas tawaran."],
];

export default function HelpPage() { return <DriverShell><Suspense><Inner /></Suspense></DriverShell>; }

function Inner() {
  const sp = useSearchParams();
  const trip = sp.get("trip");
  const [type, setType] = useState<"sos" | "breakdown" | "customer_unreachable" | "other">("breakdown");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "danger"; text: string } | null>(null);
  async function report(kind = type) {
    if (!trip) return;
    setBusy(true); setMsg(null);
    try { await api(`/driver/trips/${trip}/issues`, { method: "POST", body: JSON.stringify({ type: kind, message: message || undefined }) }); setMsg({ tone: "good", text: kind === "sos" ? "SOS terkirim. Ops segera menghubungi Anda." : "Laporan terkirim ke Ops." }); } catch (e) { setMsg({ tone: "danger", text: errorMessage(e) }); } finally { setBusy(false); }
  }
  return (
    <>
      <DriverHeader title="Bantuan" back="/driver" />
      <div className="card mb-3 border-red-200">
        <div className="mb-2 flex items-center gap-2 font-semibold text-red-700"><AlertTriangle size={18} />Darurat</div>
        <div className="grid grid-cols-2 gap-2">
          <a href={`tel:${OPS_PHONE}`} className="btn-ghost"><Phone size={16} />Telepon Ops</a>
          <button className="btn-danger" disabled={!trip || busy} onClick={() => report("sos")}>{busy ? <Spinner /> : "Kirim SOS"}</button>
        </div>
        {!trip && <p className="mt-1 text-[11px] text-slate-500">SOS dengan konteks trip tersedia dari halaman trip yang sedang berjalan.</p>}
      </div>
      {trip && (
        <div className="card mb-3 flex flex-col gap-2">
          <div className="font-semibold">Lapor masalah trip {trip}</div>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="breakdown">Kendaraan mogok / kecelakaan ringan</option>
            <option value="customer_unreachable">Penumpang tidak bisa dihubungi</option>
            <option value="other">Lainnya</option>
          </select>
          <textarea className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Jelaskan singkat" />
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <button className="btn-driver" disabled={busy} onClick={() => report()}>{busy ? <Spinner /> : "Kirim laporan"}</button>
        </div>
      )}
      <h2 className="mb-2 text-sm font-semibold">Panduan singkat</h2>
      <div className="flex flex-col gap-2">{GUIDE.map(([q, a]) => <details key={q} className="card"><summary className="cursor-pointer text-sm font-semibold">{q}</summary><p className="mt-1 text-sm text-slate-600">{a}</p></details>)}</div>
      <p className="mt-4 text-center text-xs text-slate-500">Ops 24 jam: WhatsApp {OPS_PHONE}</p>
    </>
  );
}
