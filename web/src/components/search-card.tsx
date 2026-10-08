"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/use-api";
import { DestinationSelect, type ZoneWithLocations } from "@/components/destination-select";
import { Counter } from "@/components/ui/counter";

export function SearchCard() {
  const t = useTranslations("search");
  const router = useRouter();
  const { data: zones } = useApi<ZoneWithLocations[]>("/public/zones");
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [dest, setDest] = useState<string>("");
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("05:30");
  const [pax, setPax] = useState(2);
  const [bags, setBags] = useState(2);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ dest, date, time, pax: String(pax), bags: String(bags) });
    router.push(`/pesan?${q.toString()}`);
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 shadow-sm">
      <div>
        <label className="label">{t("destination")}</label>
        <DestinationSelect zones={zones ?? []} value={dest} onChange={setDest} placeholder={t("destinationPh")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">{t("date")}</label><input type="date" className="input" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} required /></div>
        <div><label className="label">{t("time")} ({t("wita")})</label><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} required /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Counter label={t("passengers")} value={pax} min={1} max={40} onChange={setPax} />
        <Counter label={t("luggage")} value={bags} min={0} max={40} onChange={setBags} />
      </div>
      <button type="submit" className="btn-primary" disabled={!dest}>{t("submit")}</button>
    </form>
  );
}
