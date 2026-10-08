"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export default function TrackPage() {
  const [code, setCode] = useState("");
  const router = useRouter();
  const locale = useLocale();
  return (
    <form className="card mx-auto flex max-w-sm flex-col gap-3" onSubmit={(e) => { e.preventDefault(); router.push(`/pesanan/${code.trim().toUpperCase()}`); }}>
      <div className="font-semibold">{locale === "en" ? "Track your booking" : "Lacak pesanan"}</div>
      <input className="input uppercase" placeholder="LT-YYMMDD-XXXX" value={code} onChange={(e) => setCode(e.target.value)} />
      <button className="btn-primary" disabled={code.trim().length < 8}>{locale === "en" ? "Open ticket" : "Buka tiket"}</button>
    </form>
  );
}
