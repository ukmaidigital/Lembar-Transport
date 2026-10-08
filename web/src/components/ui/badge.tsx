import { cn } from "@/lib/utils";

export type Tone = "neutral" | "info" | "good" | "warn" | "danger" | "driver" | "admin";

const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-brand-50 text-brand-600",
  good: "bg-green-50 text-green-800",
  warn: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-800",
  driver: "bg-driver-50 text-driver-600",
  admin: "bg-admin-50 text-admin-600",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cn("badge", tones[tone], className)}>{children}</span>;
}

export const orderStatusTone: Record<string, Tone> = {
  pending_payment: "warn", confirmed: "neutral", dispatching: "info", assigned: "driver", en_route: "driver",
  arrived: "driver", on_trip: "driver", completed: "good", no_show: "danger", cancelled: "danger", expired: "danger",
};

export const orderStatusLabel: Record<string, { id: string; en: string }> = {
  pending_payment: { id: "Menunggu Pembayaran", en: "Awaiting payment" },
  confirmed: { id: "Terkonfirmasi", en: "Confirmed" },
  dispatching: { id: "Mencari Driver", en: "Finding a driver" },
  assigned: { id: "Driver Ditugaskan", en: "Driver assigned" },
  en_route: { id: "Driver Menuju Pelabuhan", en: "Driver heading to port" },
  arrived: { id: "Driver Tiba di Titik Temu", en: "Driver at meeting point" },
  on_trip: { id: "Dalam Perjalanan", en: "On the way" },
  completed: { id: "Selesai", en: "Completed" },
  no_show: { id: "Penumpang Tidak Hadir", en: "No-show" },
  cancelled: { id: "Dibatalkan", en: "Cancelled" },
  expired: { id: "Kedaluwarsa", en: "Expired" },
};

export function OrderStatusBadge({ status, locale = "id" }: { status: string; locale?: string }) {
  const l = orderStatusLabel[status];
  return <Badge tone={orderStatusTone[status] ?? "neutral"}>{l ? (locale === "en" ? l.en : l.id) : status}</Badge>;
}
