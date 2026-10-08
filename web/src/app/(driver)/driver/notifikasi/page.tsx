"use client";

import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { useApi } from "@/lib/use-api";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { Empty } from "@/components/ui/empty";

type Notif = { id: number; title: string | null; body: string | null; template_key: string; read_at: string | null; created_at: string; payload?: { order_code?: string } | null };

export default function NotificationsPage() { return <DriverShell><Inner /></DriverShell>; }

function Inner() {
  const { data, meta, reload } = useApi<Notif[]>("/notifications?per_page=50", { poll: 30000 });
  async function readAll() { await api("/notifications/read-all", { method: "POST" }); reload(); }
  return (
    <>
      <DriverHeader title="Notifikasi" right={Number(meta?.unread ?? 0) > 0 ? <button className="text-xs text-driver-600 underline" onClick={readAll}>Tandai semua dibaca</button> : null} />
      {!data?.length ? <Empty title="Belum ada notifikasi" /> : (
        <div className="card divide-y !p-0">
          {data.map((n) => (
            <button key={n.id} onClick={async () => { if (!n.read_at) { await api(`/notifications/${n.id}/read`, { method: "POST" }); reload(); } if (n.payload?.order_code) window.location.href = `/driver/trip/${n.payload.order_code}`; }}
              className={`block w-full px-3 py-3 text-left text-sm ${n.read_at ? "" : "bg-driver-50/40"}`}>
              <div className="flex items-start justify-between gap-2"><div className="font-medium">{n.title ?? n.template_key}</div>{!n.read_at && <span className="mt-1 h-2 w-2 flex-none rounded-full bg-driver-500" />}</div>
              <div className="text-xs text-slate-600">{n.body}</div>
              <div className="mt-1 text-[11px] text-slate-400">{formatDateTime(n.created_at)}</div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
