"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Order } from "@/lib/ticket";
import { PAYMENT_LABEL } from "@/lib/driver";
import { formatRupiah, formatTime, formatDateTime } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui/badge";

export function TripRow({ o, withDate = false }: { o: Order; withDate?: boolean }) {
  return (
    <Link href={`/driver/trip/${o.code}`} className="card mb-2 flex items-center gap-3">
      <div className="min-w-[56px] text-center"><div className="text-lg font-bold">{formatTime(o.pickup_at).replace(" WITA", "")}</div>{withDate && <div className="text-[10px] text-slate-500">{formatDateTime(o.pickup_at).split(" · ")[0]}</div>}</div>
      <div className="flex-1 text-sm">
        <div className="font-semibold">{o.customer.name} <span className="font-normal text-slate-500">· {o.passengers} pax</span></div>
        <div className="text-xs text-slate-500">Lembar → {o.destination?.name} · {PAYMENT_LABEL[o.payment_method]} {formatRupiah(o.total)}</div>
        <div className="mt-1"><OrderStatusBadge status={o.status} /></div>
      </div>
      <ChevronRight size={16} className="text-slate-400" />
    </Link>
  );
}
