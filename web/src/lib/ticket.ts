"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiRequestError, Envelope } from "./api";

export type Order = {
  code: string; status: string; status_label: string; payment_status: string; payment_method: string; channel: string; locale: string;
  customer: { name: string; phone: string; email: string | null };
  meeting_point: { id: number; name: string; instructions: string | null; photo_url: string | null } | null;
  destination: { name: string; zone: string | null; duration_min_est?: number | null } | null;
  vehicle_class: { code: string; name: string } | null;
  pickup_at: string; ferry: { route: string | null; operator: string | null; departure_at: string | null; eta_min_at: string | null; eta_max_at: string | null; docked_at: string | null; docked_source: string | null };
  passengers: number; luggage_units: number; child_seats: number; needs_roof_rack: boolean; notes: string | null;
  price_breakdown: { base: number; surcharges: { code: string; label_id: string; label_en: string; amount: number }[]; total: number };
  total: number; waiting_fee: number; cancellation_fee: number; cancellation_reason: string | null; cancelled_by: string | null; payment_expires_at: string | null;
  driver: { id: number; name: string; rating_avg: number; trips_completed: number; phone: string | null; vehicle: { brand: string; model: string; color: string | null; plate_number: string } | null } | null;
  timeline: Record<string, string | null>; rating: { score: number; comment: string | null } | null; ticket_url: string;
  cash_collected?: number | null; commission?: { rate: number; amount: number; driver_net: number }; histories?: { from: string | null; to: string; actor_type: string; reason: string | null; at: string }[];
};
export type TicketMeta = { cancellation: { cancellable: boolean; hours_before_pickup: number; fee_percent: number; fee: number; paid: number; refund: number }; payment: { bank: string; account_number: string; account_holder: string; amount: number; transfer_note: string; expires_at: string | null } | null; docked_available: boolean };

export function last4Key(code: string) { return `ticket:${code}`; }

/** Loads a ticket; guests must supply the last 4 digits of their phone (kept in sessionStorage). */
export function useTicket(code: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [meta, setMeta] = useState<TicketMeta | null>(null);
  const [needGate, setNeedGate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (last4?: string) => {
    const l4 = last4 ?? (typeof window !== "undefined" ? sessionStorage.getItem(last4Key(code)) : null);
    setLoading(true);
    try {
      const json = await api<Envelope<Order> & { meta: TicketMeta }>(`/orders/${code}${l4 ? `?phone_last4=${l4}` : ""}`, { raw: true });
      setOrder(json.data); setMeta(json.meta); setNeedGate(false); setError(null);
      if (l4) sessionStorage.setItem(last4Key(code), l4);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) { setNeedGate(true); if (last4) setError(e.error.message); }
      else setError(e instanceof Error ? e.message : "Gagal memuat tiket");
    } finally { setLoading(false); }
  }, [code]);
  useEffect(() => { load(); }, [load]);
  const query = typeof window !== "undefined" && sessionStorage.getItem(last4Key(code)) ? `?phone_last4=${sessionStorage.getItem(last4Key(code))}` : "";
  return { order, meta, needGate, error, loading, reload: () => load(), query };
}
