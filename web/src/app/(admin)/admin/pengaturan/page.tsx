"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/shell";
import { Field } from "@/components/admin/ui";
import { useApi } from "@/lib/use-api";
import { api, errorMessage } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { PageLoading, Spinner } from "@/components/ui/spinner";

const LABELS: Record<string, { label: string; hint: string; kind: "number" | "percent" | "bool" | "json" }> = {
  commission_rate: { label: "Komisi platform", hint: "Pecahan 0–1 (0.15 = 15 %)", kind: "percent" },
  "waiting.free_minutes": { label: "Tunggu gratis (menit)", hint: "Sejak kapal sandar", kind: "number" },
  "waiting.no_show_grace_minutes": { label: "Tenggang no-show (menit)", hint: "Setelah tunggu gratis", kind: "number" },
  "cancellation.tiers": { label: "Tier pembatalan", hint: "JSON [[jam_min, persen], …]", kind: "json" },
  "ledger.balance_threshold": { label: "Ambang saldo driver (Rp)", hint: "Di bawah ini driver tidak menerima tawaran", kind: "number" },
  "ledger.top_up_min": { label: "Minimum top-up (Rp)", hint: "", kind: "number" },
  "ledger.payout_min": { label: "Minimum payout (Rp)", hint: "", kind: "number" },
  "dispatch.waves": { label: "Gelombang dispatch", hint: "JSON [[jumlah_driver|null, detik], …]", kind: "json" },
  "dispatch.lead_hours": { label: "Dispatch dimulai (jam sebelum jemput)", hint: "", kind: "number" },
  "dispatch.retry_minutes": { label: "Interval retry dispatch (menit)", hint: "", kind: "number" },
  "payment.manual_expiry_hours": { label: "Batas unggah bukti transfer (jam)", hint: "", kind: "number" },
  "payment.manual_cutoff_hours": { label: "Cut-off konfirmasi manual (jam sebelum jemput)", hint: "", kind: "number" },
  "payment.manual_min_lead_hours": { label: "Transfer manual hanya jika ≥ (jam)", hint: "", kind: "number" },
  "payment.gateway_enabled": { label: "Gateway pembayaran aktif", hint: "Fase 2", kind: "bool" },
  verification_sla_hours: { label: "SLA verifikasi (jam)", hint: "", kind: "number" },
  admin_2fa_required: { label: "Wajib 2FA untuk staf", hint: "Berlaku saat login berikutnya", kind: "bool" },
};

export default function SettingsPage() { return <AdminShell title="Pengaturan bisnis"><Inner /></AdminShell>; }

function Inner() {
  const { data, meta, reload } = useApi<Record<string, unknown>>("/admin/settings");
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "danger"; text: string } | null>(null);
  useEffect(() => { if (data) setForm(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]))); }, [data]);
  if (!data) return <PageLoading />;
  const editable = (meta?.editable as string[] | undefined) ?? Object.keys(data);
  async function save() {
    setBusy(true); setMsg(null);
    try {
      const settings: Record<string, unknown> = {};
      for (const k of editable) { const kind = LABELS[k]?.kind; const v = form[k]; settings[k] = kind === "json" ? JSON.parse(v) : kind === "bool" ? v === "true" : kind === "percent" ? Number(v) : Number(v); }
      await api("/admin/settings", { method: "PUT", body: JSON.stringify({ settings }) }); setMsg({ tone: "good", text: "Pengaturan tersimpan dan tercatat di audit log." }); reload();
    } catch (e) { setMsg({ tone: "danger", text: errorMessage(e) }); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-3xl">
      {msg && <Alert tone={msg.tone} className="mb-3">{msg.text}</Alert>}
      <div className="card grid gap-4 sm:grid-cols-2">
        {editable.map((k) => { const l = LABELS[k] ?? { label: k, hint: "", kind: "number" as const }; return (
          <Field key={k} label={l.label} hint={l.hint} className={l.kind === "json" ? "sm:col-span-2" : ""}>
            {l.kind === "bool" ? <select className="input" value={form[k] ?? "false"} onChange={(e) => setForm({ ...form, [k]: e.target.value })}><option value="true">Ya</option><option value="false">Tidak</option></select>
            : <input className={`input ${l.kind === "json" ? "font-mono text-xs" : ""}`} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />}
          </Field>
        ); })}
      </div>
      <button className="btn-admin mt-4" disabled={busy} onClick={save}>{busy ? <Spinner /> : "Simpan pengaturan"}</button>
    </div>
  );
}
