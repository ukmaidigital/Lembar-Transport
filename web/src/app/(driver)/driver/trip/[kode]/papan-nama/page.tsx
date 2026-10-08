"use client";

import { use } from "react";
import Link from "next/link";
import { useApi } from "@/lib/use-api";
import type { Order } from "@/lib/ticket";
import { PageLoading } from "@/components/ui/spinner";

/** Full-screen name board shown to arriving passengers (FR-DRV-13). */
export default function NameBoardPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = use(params);
  const { data: o } = useApi<Order>(`/driver/trips/${kode}`);
  if (!o) return <PageLoading />;
  const name = o.customer.name.toUpperCase();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6 text-center">
      <div className="text-sm font-semibold uppercase tracking-[0.3em] text-driver-600">Lembar Transport</div>
      <div className="mt-6 break-words font-black leading-none text-slate-900" style={{ fontSize: name.length > 14 ? "12vw" : "16vw" }}>{name}</div>
      <div className="mt-6 text-2xl text-slate-600">→ {o.destination?.name}</div>
      <div className="mt-2 text-lg text-slate-400">{o.code}</div>
      <Link href={`/driver/trip/${kode}`} className="mt-12 text-sm text-slate-400 underline">Kembali ke trip</Link>
    </div>
  );
}
