"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { storeSession } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  role?: "customer" | "driver";
  purpose?: "login" | "register_driver";
  onSuccess: (user: { role: string; name: string; driver_status?: string | null }) => void;
  labels?: Partial<Record<"phone" | "send" | "code" | "verify" | "name" | "resend" | "hint" | "sentTo", string>>;
  askName?: boolean;
  accent?: "primary" | "driver";
};

/** Phone + OTP login (WhatsApp, SMS fallback) shared by the customer and driver areas. */
export function OtpLogin({ role = "customer", purpose = "login", onSuccess, labels = {}, askName = false, accent = "primary" }: Props) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<{ expires_at: string; debug_code?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const L = {
    phone: "Nomor WhatsApp", send: "Kirim kode OTP", code: "Kode OTP (6 digit)", verify: "Masuk", name: "Nama lengkap", resend: "Kirim ulang",
    hint: "Kami mengirim kode 6 digit ke WhatsApp Anda. Berlaku 5 menit.", sentTo: "Kode dikirim ke", ...labels,
  };
  const btn = accent === "driver" ? "btn-driver" : "btn-primary";

  async function send() {
    setBusy(true); setError(null);
    try {
      const data = await api<{ expires_at: string; debug_code?: string }>("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone, purpose }) });
      setSent(data);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setError(null);
    try {
      const data = await api<{ token: string; expires_at: string | null; user: { role: string; name: string; driver_status?: string | null } }>("/auth/otp/verify", {
        method: "POST", body: JSON.stringify({ phone, code, role, purpose, name: name || undefined }),
      });
      await storeSession(data.token, data.expires_at);
      onSuccess(data.user);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="danger">{error}</Alert>}
      {askName && (
        <div><label className="label">{L.name}</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama sesuai KTP" /></div>
      )}
      <div>
        <label className="label">{L.phone}</label>
        <input className="input" inputMode="tel" placeholder="08xx atau +62…" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={Boolean(sent)} />
      </div>
      {!sent ? (
        <button className={btn} onClick={send} disabled={busy || phone.trim().length < 8}>{busy ? <Spinner /> : L.send}</button>
      ) : (
        <>
          <p className="text-xs text-slate-500">{L.hint} {L.sentTo} <b>{phone}</b>.</p>
          {sent.debug_code && <Alert tone="warn">Mode pengembangan: kode OTP <b className="font-mono">{sent.debug_code}</b></Alert>}
          <div>
            <label className="label">{L.code}</label>
            <input className="input tracking-[0.4em] text-center text-lg" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
          </div>
          <button className={btn} onClick={verify} disabled={busy || code.length !== 6}>{busy ? <Spinner /> : L.verify}</button>
          <button className="text-xs text-slate-500 underline" onClick={() => { setSent(null); setCode(""); }}>{L.resend}</button>
        </>
      )}
    </div>
  );
}
