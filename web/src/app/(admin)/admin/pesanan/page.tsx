"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { Table, Th, Toolbar, Field } from "@/components/admin/ui";
import { OrderRow, type AdminOrder } from "@/components/admin/order-row";
import { useApi } from "@/lib/use-api";
import { qs } from "@/lib/admin";
import { orderStatusLabel, OrderStatusBadge } from "@/components/ui/badge";
import { formatRupiah, formatTime } from "@/lib/utils";
import { PageLoading } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";

const BOARD: string[][] = [["pending_payment"], ["confirmed", "dispatching"], ["assigned"], ["en_route", "arrived"], ["on_trip"], ["completed", "no_show", "cancelled"]];
const BOARD_TITLES = ["Menunggu bayar", "Mencari driver", "Ditugaskan", "Driver di pelabuhan", "Dalam perjalanan", "Selesai / batal"];

export default function OrdersPage() {
  const { can } = useAuth();
  return <AdminShell title="Pesanan" actions={can("orders.manage") ? <Link href="/admin/pesanan/baru" className="btn-admin !min-h-9 px-3 text-xs">+ Pesanan manual</Link> : null}><Suspense><Inner /></Suspense></AdminShell>;
}

function Inner() {
  const sp = useSearchParams();
  const todayWita = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const [view, setView] = useState<"table" | "board">("table");
  const [date, setDate] = useState(sp.get("date") === "today" ? todayWita : sp.get("date") ?? "");
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState("");
  const { data, loading, meta } = useApi<AdminOrder[]>(`/admin/orders${qs({ date, status, q, payment_method: payment, per_page: 100, sort: date ? "pickup_at" : "created_at", dir: date ? "asc" : "desc" })}`, { poll: 30000 });
  return (
    <>
      <Toolbar>
        <Field label="Tanggal jemput"><input type="date" className="input !py-1.5" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Status"><select className="input !py-1.5" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua</option>{Object.entries(orderStatusLabel).map(([k, v]) => <option key={k} value={k}>{v.id}</option>)}</select></Field>
        <Field label="Pembayaran"><select className="input !py-1.5" value={payment} onChange={(e) => setPayment(e.target.value)}><option value="">Semua</option><option value="cash">Tunai</option><option value="bank_transfer">Transfer</option></select></Field>
        <Field label="Cari"><input className="input !py-1.5" placeholder="Kode, nama, WA" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <div className="ml-auto flex rounded-lg bg-slate-200 p-1 text-xs font-semibold">{(["table", "board"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 ${view === v ? "bg-white shadow" : "text-slate-600"}`}>{v === "table" ? "Tabel" : "Papan"}</button>)}</div>
      </Toolbar>
      {loading && !data ? <PageLoading /> : view === "table" ? (
        <>
          <Table empty={!data?.length} head={<><Th>Kode</Th><Th>Jemput (WITA)</Th><Th>Customer</Th><Th>Tujuan</Th><Th>Driver</Th><Th>Status</Th><Th className="text-right">Total</Th></>}>
            {data?.map((o) => <OrderRow key={o.code} o={o} />)}
          </Table>
          <p className="mt-2 text-xs text-slate-500">{Number(meta?.total ?? data?.length ?? 0)} pesanan</p>
        </>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {BOARD.map((col, i) => {
            const items = (data ?? []).filter((o) => col.includes(o.status));
            return (
              <div key={i} className="rounded-xl bg-slate-100 p-2">
                <div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-slate-600"><span>{BOARD_TITLES[i]}</span><span>{items.length}</span></div>
                <div className="flex flex-col gap-2">
                  {items.map((o) => (
                    <Link key={o.code} href={`/admin/pesanan/${o.code}`} className={`card !p-2 text-xs hover:border-admin-500 ${o.needs_attention ? "border-red-300" : ""}`}>
                      <div className="flex justify-between font-mono text-[11px] text-slate-500"><span>{o.code}</span><span>{formatTime(o.pickup_at).replace(" WITA", "")}</span></div>
                      <div className="font-semibold">{o.customer.name}</div>
                      <div className="text-slate-600">→ {o.destination?.name} · {o.vehicle_class?.name}</div>
                      <div className="mt-1 flex items-center justify-between"><OrderStatusBadge status={o.status} /><span className="font-semibold">{formatRupiah(o.total)}</span></div>
                      {o.driver && <div className="mt-1 text-slate-500">{o.driver.name}</div>}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
