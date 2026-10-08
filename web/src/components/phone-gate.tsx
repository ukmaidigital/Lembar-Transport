"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";

export function PhoneGate({ onSubmit, error }: { onSubmit: (last4: string) => void; error: string | null }) {
  const t = useTranslations("ticket");
  const [v, setV] = useState("");
  return (
    <div className="card mx-auto flex max-w-sm flex-col gap-3">
      <div className="font-semibold">{t("gateTitle")}</div>
      <p className="text-xs text-slate-500">{t("gateHint")}</p>
      {error && <Alert tone="danger">{error}</Alert>}
      <input className="input text-center text-lg tracking-[0.4em]" inputMode="numeric" maxLength={4} value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} />
      <button className="btn-primary" disabled={v.length !== 4} onClick={() => onSubmit(v)}>{t("gateSubmit")}</button>
    </div>
  );
}
