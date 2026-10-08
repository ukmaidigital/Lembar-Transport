"use client";

import { useLocale } from "next-intl";

export type ZoneWithLocations = { id: number; code: string; name: string; locations: { id: number; name_id: string; name_en: string | null; duration_min_est: number | null; type: string }[] };

export function DestinationSelect({ zones, value, onChange, placeholder }: { zones: ZoneWithLocations[]; value: string; onChange: (v: string) => void; placeholder: string }) {
  const locale = useLocale();
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)} required>
      <option value="">{placeholder}</option>
      {zones.map((z) => (
        <optgroup key={z.id} label={`${z.code} · ${z.name}`}>
          {z.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {locale === "en" && l.name_en ? l.name_en : l.name_id}{l.duration_min_est ? ` · ± ${l.duration_min_est} ${locale === "en" ? "min" : "menit"}` : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
