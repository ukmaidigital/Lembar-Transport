"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Ship } from "lucide-react";
import { OtpLogin } from "@/components/otp-login";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { refresh } = useAuth();
  const register = sp.get("daftar") === "1";
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4 py-8">
      <div className="text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-driver-500 text-white"><Ship size={24} /></span>
        <h1 className="mt-3 text-xl font-bold">Lembar Transport Driver</h1>
        <p className="text-sm text-slate-600">{register ? "Daftar sebagai mitra driver dengan nomor WhatsApp Anda." : "Masuk dengan nomor WhatsApp yang terdaftar."}</p>
      </div>
      {sp.get("role_mismatch") && <Alert tone="warn">Akun ini bukan akun driver. Gunakan nomor WhatsApp lain atau daftar sebagai mitra.</Alert>}
      <div className="card">
        <OtpLogin role="driver" purpose={register ? "register_driver" : "login"} askName={register} accent="driver" labels={{ verify: register ? "Daftar" : "Masuk" }}
          onSuccess={async (u) => {
            await refresh();
            const st = u.driver_status;
            if (!st || st === "draft" || st === "revision_required") router.replace("/driver/daftar");
            else if (st === "submitted" || st === "rejected") router.replace("/driver/verifikasi");
            else router.replace(sp.get("next") || "/driver");
          }} />
      </div>
      <p className="text-center text-sm text-slate-600">
        {register ? <>Sudah terdaftar? <Link className="font-semibold text-driver-600" href="/driver/masuk">Masuk</Link></> : <>Belum jadi mitra? <Link className="font-semibold text-driver-600" href="/driver/masuk?daftar=1">Daftar sekarang</Link></>}
      </p>
      <Link href="/" className="text-center text-xs text-slate-400">← Situs penumpang</Link>
    </div>
  );
}

export default function DriverLoginPage() { return <Suspense><Inner /></Suspense>; }
