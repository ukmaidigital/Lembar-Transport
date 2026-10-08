"use client";

import Link from "next/link";
import { Star, ChevronRight, Car, FileText, Landmark, LogOut } from "lucide-react";
import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { useDriverMe, DRIVER_STATUS_LABEL } from "@/lib/driver";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/ui/spinner";

export default function ProfilePage() { return <DriverShell><Inner /></DriverShell>; }

function Inner() {
  const { data: me } = useDriverMe();
  const { logout } = useAuth();
  if (!me) return <PageLoading />;
  const rows = [
    { href: "/driver/profil/kendaraan", icon: Car, label: "Kendaraan", value: me.vehicle ? `${me.vehicle.brand} ${me.vehicle.model} · ${me.vehicle.plate_number}` : "Belum ada" },
    { href: "/driver/profil/dokumen", icon: FileText, label: "Dokumen", value: me.has_expired_document ? "Ada yang kedaluwarsa" : `${me.documents.filter((d) => d.status === "approved").length}/${me.required_documents.length} disetujui` },
    { href: "/driver/profil/kendaraan#rekening", icon: Landmark, label: "Rekening payout", value: me.bank_account ? `${me.bank_account.bank_code} ••••${me.bank_account.account_number.slice(-4)}` : "Belum ada" },
  ];
  return (
    <>
      <DriverHeader title="Profil" />
      <div className="card mb-3 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-driver-50 text-xl font-bold text-driver-600">{me.name?.[0]}</div>
        <div className="flex-1">
          <div className="font-bold">{me.name}</div>
          <div className="text-xs text-slate-500">{me.phone}{me.partner_organization ? ` · ${me.partner_organization}` : ""}</div>
          <div className="mt-1 flex items-center gap-2 text-xs"><Badge tone={me.status === "active" ? "good" : "warn"}>{DRIVER_STATUS_LABEL[me.status]}</Badge><span className="flex items-center gap-1"><Star size={12} className="text-amber-500" />{Number(me.rating_avg).toFixed(1)} ({me.rating_count})</span></div>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="card !p-2"><div className="text-slate-500">Trip</div><div className="font-bold">{me.trips_completed}</div></div>
        <div className="card !p-2"><div className="text-slate-500">Penerimaan 30h</div><div className="font-bold">{me.acceptance_rate_30d != null ? `${Math.round(Number(me.acceptance_rate_30d))} %` : "–"}</div></div>
        <div className="card !p-2"><div className="text-slate-500">Tepat waktu</div><div className="font-bold">{me.on_time_rate_90d != null ? `${Math.round(Number(me.on_time_rate_90d))} %` : "–"}</div></div>
      </div>
      <div className="card divide-y !p-0">
        {rows.map(({ href, icon: Icon, label, value }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-3 py-3 text-sm"><Icon size={18} className="text-slate-500" /><div className="flex-1"><div className="font-medium">{label}</div><div className="text-xs text-slate-500">{value}</div></div><ChevronRight size={16} className="text-slate-400" /></Link>
        ))}
        <Link href="/driver/bantuan" className="flex items-center gap-3 px-3 py-3 text-sm"><span className="w-[18px] text-center text-slate-500">?</span><div className="flex-1 font-medium">Bantuan & panduan</div><ChevronRight size={16} className="text-slate-400" /></Link>
      </div>
      <button onClick={async () => { await logout(); window.location.href = "/driver/masuk"; }} className="btn-ghost mt-4 w-full text-red-700"><LogOut size={16} />Keluar</button>
      <p className="mt-6 text-center text-[11px] text-slate-400">Lembar Transport Driver v1.0 · Data pribadi Anda dilindungi sesuai UU PDP.</p>
    </>
  );
}
