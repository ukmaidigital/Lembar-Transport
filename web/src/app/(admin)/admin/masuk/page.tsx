"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ship } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { storeSession, useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

type LoginRes = { token?: string; expires_at?: string | null; requires_totp?: boolean; challenge?: string; requires_totp_setup?: boolean };

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"login" | "totp" | "setup">("login");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const next = sp.get("next") || "/admin";

  async function done() { await refresh(); router.replace(next); }
  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await api<LoginRes>("/auth/admin/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (r.requires_totp && r.challenge) { setChallenge(r.challenge); setStage("totp"); }
      else if (r.requires_totp_setup && r.token) {
        await storeSession(r.token, null);
        const s = await api<{ secret: string; otpauth_url: string }>("/auth/totp/enable", { method: "POST" });
        setSetup(s); setStage("setup");
      } else if (r.token) { await storeSession(r.token, r.expires_at); await done(); }
    } catch (e2) { setErr(errorMessage(e2)); } finally { setBusy(false); }
  }
  async function verifyTotp(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api<LoginRes>("/auth/admin/totp", { method: "POST", body: JSON.stringify({ challenge, code }) }); await storeSession(r.token!, r.expires_at); await done(); } catch (e2) { setErr(errorMessage(e2)); } finally { setBusy(false); }
  }
  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api("/auth/totp/confirm", { method: "POST", body: JSON.stringify({ code }) }); await fetch("/api/auth/session", { method: "DELETE" }); setStage("login"); setCode(""); setErr("2FA aktif. Masuk kembali dengan kata sandi dan kode autentikator."); } catch (e2) { setErr(errorMessage(e2)); } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="card w-full max-w-sm">
        <div className="mb-4 flex items-center gap-2 font-bold"><span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-admin-500 text-white"><Ship size={16} /></span>Lembar Transport · Admin</div>
        {sp.get("role_mismatch") && <Alert tone="warn" className="mb-3">Akun ini bukan akun staf.</Alert>}
        {err && <Alert tone={err.startsWith("2FA aktif") ? "good" : "danger"} className="mb-3">{err}</Alert>}
        {stage === "login" && (
          <form onSubmit={login} className="flex flex-col gap-3">
            <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></div>
            <div><label className="label">Kata sandi</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></div>
            <button className="btn-admin" disabled={busy}>{busy ? <Spinner /> : "Masuk"}</button>
          </form>
        )}
        {stage === "totp" && (
          <form onSubmit={verifyTotp} className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">Masukkan kode 6 digit dari aplikasi autentikator Anda.</p>
            <input className="input text-center text-xl tracking-[0.4em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
            <button className="btn-admin" disabled={busy || code.length !== 6}>{busy ? <Spinner /> : "Verifikasi"}</button>
          </form>
        )}
        {stage === "setup" && setup && (
          <form onSubmit={confirmSetup} className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">Autentikasi dua faktor wajib untuk staf. Tambahkan akun ini ke Google Authenticator / Authy dengan kunci berikut, lalu masukkan kode yang muncul.</p>
            <div className="rounded-lg bg-slate-50 p-3 text-center font-mono text-sm tracking-widest">{setup.secret.match(/.{1,4}/g)?.join(" ")}</div>
            <a href={setup.otpauth_url} className="text-center text-xs text-admin-600 underline">Buka di aplikasi autentikator</a>
            <input className="input text-center text-xl tracking-[0.4em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
            <button className="btn-admin" disabled={busy || code.length !== 6}>{busy ? <Spinner /> : "Aktifkan 2FA"}</button>
          </form>
        )}
        <p className="mt-4 text-center text-[11px] text-slate-400">Sesi berakhir otomatis setelah 8 jam. Semua tindakan dicatat di audit log.</p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() { return <Suspense><Inner /></Suspense>; }
