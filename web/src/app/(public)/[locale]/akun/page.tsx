"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";
import { PageLoading } from "@/components/ui/spinner";

export default function AccountPage() {
  const t = useTranslations("account");
  const locale = useLocale();
  const { user, loading, refresh } = useAuth();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [lang, setLang] = useState(locale);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (user) { setName(user.name); setEmail(user.email ?? ""); setLang(user.locale); } }, [user]);
  if (loading || !user) return <PageLoading />;
  async function save() {
    try { await api("/auth/me", { method: "PATCH", body: JSON.stringify({ name, email: email || null, locale: lang }) }); await refresh(); setMsg(t("saved")); } catch (e) { setMsg(errorMessage(e)); }
  }
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <div className="card flex flex-col gap-3">
        <div><label className="label">Nama</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">WhatsApp</label><input className="input" value={user.phone ?? ""} disabled /></div>
        <div><label className="label">Email</label><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label">{t("language")}</label><select className="input" value={lang} onChange={(e) => setLang(e.target.value)}><option value="id">Bahasa Indonesia</option><option value="en">English</option></select></div>
        {msg && <Alert tone="info">{msg}</Alert>}
        <button className="btn-primary" onClick={save}>{t("save")}</button>
      </div>
      <Link href="/akun/pesanan" className="btn-ghost">{t("orders")} →</Link>
    </div>
  );
}
