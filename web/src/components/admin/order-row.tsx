"use client";

import Link from "next/link";
import type { Order } from "@/lib/ticket";
import { Td } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/ui/badge";
import { formatRupiah, formatTime, formatDate } from "@/lib/utils";
import { PAYMENT_LABEL } from "@/lib/driver";

export type AdminOrder = Order & { needs_attention: boolean; dispatch?: { wave: number; cycle: number; started_at: string | null; next_at: string | null }; offers?: { id: number; driver_id: number; driver_name: string | null; wave: number; score: number | null; response: string; offered_at: string; expires_at: string; responded_at: string | null }[]; payments?: { id: number; method: string; provider: string | null; amount: number; status: string; proof_url?: string | null; paid_at: string | null; rejection_reason: string | null }[]; issues?: { id: number; type: string; message: string | null; status: string; created_at: string; driver_id: number | null }[] };

export function OrderRow({ o }: { o: AdminOrder }) {
  return (
    <tr className={o.needs_attention ? "bg-red-50/50" : ""}>
      <Td><Link href={`/admin/pesanan/${o.code}`} className="font-mono text-admin-600">{o.code}</Link><div className="text-[11px] text-slate-500">{o.channel}</div></Td>
      <Td><b>{formatDate(o.pickup_at)}</b><div className="text-xs">{formatTime(o.ferry.eta_min_at ?? o.pickup_at)}{o.ferry.eta_max_at ? `–${formatTime(o.ferry.eta_max_at).replace(" WITA", "")}` : ""}</div></Td>
      <Td>{o.customer.name}<div className="text-xs text-slate-500">{o.passengers} pax · {o.luggage_units} bagasi</div></Td>
      <Td>{o.destination?.name}<div className="text-xs text-slate-500">{o.vehicle_class?.name}</div></Td>
      <Td>{o.driver ? <>{o.driver.name}<div className="text-xs text-slate-500">{o.driver.vehicle?.plate_number}</div></> : <span className="text-xs text-slate-400">–</span>}</Td>
      <Td><OrderStatusBadge status={o.status} />{o.needs_attention && <div className="mt-1 text-[11px] font-semibold text-red-700">perlu perhatian</div>}</Td>
      <Td className="text-right tabular-nums">{formatRupiah(o.total)}<div className="text-[11px] text-slate-500">{PAYMENT_LABEL[o.payment_method]} · {o.payment_status}</div></Td>
    </tr>
  );
}
