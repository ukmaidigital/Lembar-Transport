"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth";
import { formatRupiah, formatDateTime, witaToIso, formatTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Counter } from "@/components/ui/counter";
import { DestinationSelect, type ZoneWithLocations } from "@/components/destination-select";
import { OtpLogin } from "@/components/otp-login";

type Option = { vehicle_class: string; name: string; example_vehicles: string; max_passengers: number; max_luggage: number; fits: boolean; reasons: string[]; suggest_two_vehicles: boolean; total: number; driver_net: number; price_breakdown: { base: number; surcharges: { code: string; label_id: string; label_en: string; amount: number }[]; total: number } };
type Quote = { quote_token: string; expires_at: string; options: Option[]; destination: { id: number; name: string; duration_min_est: number | null } | null; zone: { id: number; code: string; name: string }; pickup_at: string };
type FerryRoute = { id: number; name: string; operator: string; crossing_min_min: number; crossing_min_max: number; schedule_timezone: string };
type MeetingPoint = { id: number; name_id: string; name_en: string | null; instructions_id: string | null; instructions_en: string | null };
type Policies = { payment_methods: string[]; manual_payment_min_lead_hours: number; free_waiting_minutes: number; quote_ttl_minutes: number };

const WITA_OFFSET_MS = 8 * 3600 * 1000;
const toWitaDate = (iso: string) => new Date(new Date(iso).getTime() + WITA_OFFSET_MS).toISOString().slice(0, 10);
const toWitaTime = (iso: string) => new Date(new Date(iso).getTime() + WITA_OFFSET_MS).toISOString().slice(11, 16);

export function BookingWizard({ instant = false }: { instant?: boolean }) {
  const t = useTranslations("wizard");
  const ts = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const sp = useSearchParams();
  const { user, loading: authLoading, refresh } = useAuth();
  const { data: zones } = useApi<ZoneWithLocations[]>("/public/zones");
  const { data: routes } = useApi<FerryRoute[]>("/public/ferry-routes");
  const { data: meetingPoints } = useApi<MeetingPoint[]>("/public/meeting-points");

  const [step, setStep] = useState(0);
  const [dest, setDest] = useState(sp.get("dest") ?? "");
  const [zoneParam] = useState(sp.get("zone"));
  const [date, setDate] = useState(sp.get("date") ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [time, setTime] = useState(sp.get("time") ?? "05:30");
  const [pax, setPax] = useState(Number(sp.get("pax") ?? 2));
  const [bags, setBags] = useState(Number(sp.get("bags") ?? 2));
  const [childSeats, setChildSeats] = useState(0);
  const [roofRack, setRoofRack] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [cls, setCls] = useState<string>("");
  const [useFerry, setUseFerry] = useState(!instant);
  const [routeId, setRouteId] = useState<string>("");
  const [depDate, setDepDate] = useState(date);
  const [depTime, setDepTime] = useState("23:00");
  const [priceUpdated, setPriceUpdated] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [meetingPointId, setMeetingPointId] = useState<string>("");
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Preselect first destination of a zone when coming from the price list
  useEffect(() => {
    if (zoneParam && zones && !dest) {
      const z = zones.find((x) => String(x.id) === zoneParam);
      if (z?.locations[0]) setDest(String(z.locations[0].id));
    }
  }, [zoneParam, zones, dest]);
  useEffect(() => { if (user) { setName((n) => n || user.name); setPhone((p) => p || user.phone || ""); setEmail((e) => e || user.email || ""); } }, [user]);
  useEffect(() => { if (meetingPoints?.[0] && !meetingPointId) setMeetingPointId(String(meetingPoints[0].id)); }, [meetingPoints, meetingPointId]);
  useEffect(() => {
    if (!quote) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((new Date(quote.expires_at).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [quote]);

  const route = useMemo(() => routes?.find((r) => String(r.id) === routeId) ?? null, [routes, routeId]);
  const pickupIso = useMemo(() => {
    if (instant) return new Date(Date.now() + 15 * 60000).toISOString();
    if (useFerry && route && depDate && depTime) {
      const offset = route.schedule_timezone === "WIB" ? "+07:00" : "+08:00";
      const dep = new Date(`${depDate}T${depTime}:00${offset}`);
      return new Date(dep.getTime() + route.crossing_min_min * 60000).toISOString();
    }
    return witaToIso(date, time);
  }, [instant, useFerry, route, depDate, depTime, date, time]);
  const etaMaxIso = useMemo(() => {
    if (!useFerry || !route) return null;
    const offset = route.schedule_timezone === "WIB" ? "+07:00" : "+08:00";
    return new Date(new Date(`${depDate}T${depTime}:00${offset}`).getTime() + route.crossing_min_max * 60000).toISOString();
  }, [useFerry, route, depDate, depTime]);
  const overnight = useFerry && route ? toWitaDate(pickupIso) !== depDate : false;
  const { data: policies } = useApi<Policies>(`/public/policies?pickup_at=${encodeURIComponent(pickupIso)}`);
  const chosen = quote?.options.find((o) => o.vehicle_class === cls) ?? null;

  async function requestQuote(pickup: string) {
    setBusy(true); setError(null);
    try {
      const q = await api<Quote>("/public/quotes", { method: "POST", locale, body: JSON.stringify({ destination_location_id: Number(dest), pickup_at: pickup, passengers: pax, luggage_units: bags, child_seats: childSeats, needs_roof_rack: roofRack }) });
      setQuote(q);
      return q;
    } catch (e) { setError(errorMessage(e)); return null; } finally { setBusy(false); }
  }

  async function goVehicles() {
    const q = await requestQuote(pickupIso);
    if (q) { setCls(q.options.find((o) => o.fits)?.vehicle_class ?? q.options[0].vehicle_class); setStep(1); }
  }
  async function goContact() {
    if (useFerry && route) {
      const before = chosen?.total;
      const q = await requestQuote(pickupIso);
      if (!q) return;
      const after = q.options.find((o) => o.vehicle_class === cls)?.total;
      setPriceUpdated(before !== after);
    }
    setStep(3);
  }
  async function submitOrder() {
    if (!quote) return;
    setBusy(true); setError(null);
    try {
      const body = {
        quote_token: quote.quote_token, vehicle_class: cls, meeting_point_id: meetingPointId ? Number(meetingPointId) : undefined,
        ferry: useFerry && route ? { route_id: route.id, departure_at: new Date(`${depDate}T${depTime}:00${route.schedule_timezone === "WIB" ? "+07:00" : "+08:00"}`).toISOString(), arrival_date: toWitaDate(pickupIso) } : undefined,
        contact: { name, phone, email: email || undefined, locale }, payment_method: method, notes: notes || undefined, channel: instant ? "qr" : "web",
      };
      const res = await api<{ code: string; status: string }>("/orders", { method: "POST", locale, body: JSON.stringify(body), idempotencyKey: `${quote.quote_token}-${cls}` });
      sessionStorage.setItem(`ticket:${res.code}`, phone.replace(/\D/g, "").slice(-4));
      router.push(res.status === "pending_payment" ? `/pesanan/${res.code}/bayar` : `/pesanan/${res.code}`);
    } catch (e) { setError(errorMessage(e)); setBusy(false); }
  }

  const steps = t.raw("steps") as string[];
  const expired = secondsLeft === 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <ol className="grid grid-cols-5 gap-1 text-[11px] text-slate-500">
        {steps.map((s, i) => <li key={s} className={`rounded-md px-1 py-1 text-center ${i === step ? "bg-brand-500 font-bold text-white" : i < step ? "bg-brand-50 text-brand-600" : "bg-slate-100"}`}>{s}</li>)}
      </ol>
      {error && <Alert tone="danger">{error}</Alert>}

      {step === 0 && (
        <div className="card flex flex-col gap-3">
          {!instant && <div><label className="label">{ts("destination")}</label><DestinationSelect zones={zones ?? []} value={dest} onChange={setDest} placeholder={ts("destinationPh")} /></div>}
          {instant && <div><label className="label">{ts("destination")}</label><DestinationSelect zones={zones ?? []} value={dest} onChange={setDest} placeholder={ts("destinationPh")} /><p className="mt-1 text-xs text-slate-500">{locale === "en" ? "Pickup as soon as possible from the meeting point." : "Penjemputan secepatnya dari titik temu."}</p></div>}
          {!instant && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">{ts("date")}</label><input type="date" className="input" value={date} onChange={(e) => { setDate(e.target.value); setDepDate(e.target.value); }} /></div>
              <div><label className="label">{ts("time")} (WITA)</label><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Counter label={ts("passengers")} value={pax} min={1} max={40} onChange={setPax} />
            <Counter label={ts("luggage")} value={bags} min={0} max={40} onChange={setBags} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Counter label={ts("childSeats")} value={childSeats} min={0} max={4} onChange={setChildSeats} />
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={roofRack} onChange={(e) => setRoofRack(e.target.checked)} />{ts("roofRack")}</label>
          </div>
          <button className="btn-primary" onClick={goVehicles} disabled={!dest || busy}>{busy ? <Spinner /> : ts("submit")}</button>
        </div>
      )}

      {step === 1 && quote && (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-slate-600">Lembar → <b>{quote.destination?.name ?? quote.zone.name}</b> · {formatDateTime(quote.pickup_at, locale)} · {t("fits", { pax, bags })}</div>
          <Alert tone={expired ? "danger" : "info"}>{expired ? <>{t("expired")} <button className="underline" onClick={() => requestQuote(pickupIso)}>{t("requote")}</button></> : <>{t("locked", { minutes: policies?.quote_ttl_minutes ?? 30 })} · {secondsLeft !== null && `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}</>}</Alert>
          {quote.options.map((o) => (
            <div key={o.vehicle_class} className={`card ${cls === o.vehicle_class ? "border-brand-500 ring-2 ring-brand-500/20" : ""} ${!o.fits ? "bg-slate-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div><div className="font-semibold">{o.name} <span className="font-normal text-slate-500">· {o.example_vehicles}</span></div>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs">
                    <span className="rounded-full border px-2 py-0.5">{o.max_passengers} pax</span><span className="rounded-full border px-2 py-0.5">{o.max_luggage} {locale === "en" ? "bags" : "bagasi"}</span>
                    {o.price_breakdown.surcharges.map((s) => <span key={s.code} className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-800">+ {formatRupiah(s.amount)} {locale === "en" ? s.label_en : s.label_id}</span>)}
                  </div>
                  {!o.fits && <div className="mt-1 text-xs text-red-700">{o.reasons.join("; ")}{o.suggest_two_vehicles ? ` · ${t("twoVehicles")}` : ""}</div>}
                </div>
                <div className="text-right"><div className="text-lg font-bold">{formatRupiah(o.total)}</div><div className="text-[11px] text-slate-500">{locale === "en" ? "base" : "dasar"} {formatRupiah(o.price_breakdown.base)}</div></div>
              </div>
              <button className={`mt-3 w-full ${cls === o.vehicle_class ? "btn-primary" : "btn-ghost"}`} disabled={!o.fits || expired} onClick={() => { setCls(o.vehicle_class); setStep(instant ? 3 : 2); }}>
                {cls === o.vehicle_class ? t("chosen") : t("choose")}
              </button>
            </div>
          ))}
          <p className="text-xs text-slate-500">{t("includes", { minutes: policies?.free_waiting_minutes ?? 60 })}</p>
          <button className="btn-ghost" onClick={() => setStep(0)}>{t("back")}</button>
        </div>
      )}

      {step === 2 && (
        <div className="card flex flex-col gap-3">
          <div><div className="font-semibold">{t("ferryTitle")}</div><p className="text-xs text-slate-500">{t("ferryHint")}</p></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!useFerry} onChange={(e) => setUseFerry(!e.target.checked)} />{t("noFerry")}</label>
          {useFerry && (
            <>
              <div><label className="label">{t("route")}</label>
                <select className="input" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
                  <option value="">—</option>
                  {routes?.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.operator} ({Math.round(r.crossing_min_min / 60)}–{Math.round(r.crossing_min_max / 60)} {locale === "en" ? "h" : "jam"})</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t("departure")} ({route?.schedule_timezone ?? "WITA"})</label><input type="date" className="input" value={depDate} onChange={(e) => setDepDate(e.target.value)} /></div>
                <div><label className="label">&nbsp;</label><input type="time" className="input" value={depTime} onChange={(e) => setDepTime(e.target.value)} /></div>
              </div>
              {route && (
                <Alert tone={overnight ? "warn" : "info"}>
                  {overnight && <div className="mb-1 font-semibold">{t("overnight")}</div>}
                  {t("arrivalDate")}: <b>{toWitaDate(pickupIso)}</b> · {t("eta")}: <b>{toWitaTime(pickupIso)}–{etaMaxIso ? toWitaTime(etaMaxIso) : "?"} WITA</b>
                </Alert>
              )}
            </>
          )}
          <div className="flex gap-2"><button className="btn-ghost flex-1" onClick={() => setStep(1)}>{t("back")}</button><button className="btn-primary flex-1" onClick={goContact} disabled={busy || (useFerry && !route)}>{busy ? <Spinner /> : t("next")}</button></div>
        </div>
      )}

      {step === 3 && (
        <div className="card flex flex-col gap-3">
          {priceUpdated && chosen && <Alert tone="warn">{t("priceUpdated")} {formatRupiah(chosen.total)}</Alert>}
          <div className="font-semibold">{t("contactTitle")}</div>
          {authLoading ? <Spinner /> : user ? (
            <Alert tone="good">{t("loggedAs", { name: user.name })}</Alert>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-3">
              <p className="mb-2 text-sm font-medium">{t("loginFirst")}</p>
              <OtpLogin role="customer" askName onSuccess={async (u) => { setName(u.name); await refresh(); }} labels={{ verify: locale === "en" ? "Verify" : "Verifikasi" }} />
            </div>
          )}
          {user && (
            <>
              <div><label className="label">{t("name")}</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><label className="label">{t("phone")}</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></div>
              <div><label className="label">{t("email")}</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </>
          )}
          <div><label className="label">{t("meetingPoint")}</label>
            <select className="input" value={meetingPointId} onChange={(e) => setMeetingPointId(e.target.value)}>
              {meetingPoints?.map((m) => <option key={m.id} value={m.id}>{locale === "en" && m.name_en ? m.name_en : m.name_id}</option>)}
            </select></div>
          <div><label className="label">{t("notes")}</label><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPh")} /></div>
          <div className="flex gap-2"><button className="btn-ghost flex-1" onClick={() => setStep(instant ? 1 : 2)}>{t("back")}</button><button className="btn-primary flex-1" onClick={() => setStep(4)} disabled={!user || !name || !phone}>{t("next")}</button></div>
        </div>
      )}

      {step === 4 && chosen && (
        <div className="card flex flex-col gap-3">
          <div className="font-semibold">{t("payTitle")}</div>
          {[
            { v: "cash", title: t("cash"), d: t("cashD") },
            { v: "bank_transfer", title: t("transfer"), d: t("transferD") },
            { v: "gateway", title: t("gateway"), d: t("gatewayD") },
          ].map((m) => {
            const allowed = policies?.payment_methods.includes(m.v) ?? m.v === "cash";
            return (
              <label key={m.v} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${method === m.v ? "border-brand-500 bg-brand-50/40" : "border-slate-200"} ${!allowed ? "opacity-50" : ""}`}>
                <input type="radio" name="method" value={m.v} checked={method === m.v} disabled={!allowed} onChange={() => setMethod(m.v)} className="mt-1" />
                <div><div className="font-medium">{m.title}</div><div className="text-xs text-slate-500">{allowed ? m.d : m.v === "bank_transfer" ? t("transferUnavailable", { hours: policies?.manual_payment_min_lead_hours ?? 8 }) : (locale === "en" ? "Coming soon" : "Segera hadir")}</div></div>
              </label>
            );
          })}
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between"><span>{chosen.name}</span><span>{formatRupiah(chosen.price_breakdown.base)}</span></div>
            {chosen.price_breakdown.surcharges.map((s) => <div key={s.code} className="flex justify-between text-slate-600"><span>{locale === "en" ? s.label_en : s.label_id}</span><span>+ {formatRupiah(s.amount)}</span></div>)}
            <div className="mt-1 flex justify-between border-t pt-1 font-bold"><span>{t("total")}</span><span>{formatRupiah(chosen.total)}</span></div>
            <div className="mt-1 text-xs text-slate-500">{formatDateTime(pickupIso, locale)}{etaMaxIso ? ` – ${formatTime(etaMaxIso)}` : ""}</div>
          </div>
          <p className="text-xs text-slate-500">{t("policy")}</p>
          <div className="flex gap-2"><button className="btn-ghost flex-1" onClick={() => setStep(3)}>{t("back")}</button><button className="btn-primary flex-1" onClick={submitOrder} disabled={busy || expired}>{busy ? <Spinner /> : t("submit")}</button></div>
        </div>
      )}
    </div>
  );
}
