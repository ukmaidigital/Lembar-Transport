import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const WITA = "Asia/Makassar";

export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "-";
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(amount);
}

export function formatDateTime(iso: string | null | undefined, locale: string = "id"): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: WITA,
  }).format(d);
  const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WITA }).format(d).replace(":", ".");
  return `${date} · ${time} WITA`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WITA }).format(new Date(iso)).replace(":", ".") + " WITA";
}

export function formatDate(iso: string | null | undefined, locale: string = "id"): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: WITA }).format(new Date(iso));
}

/** Combine a WITA date (YYYY-MM-DD) and time (HH:mm) into an ISO string in UTC. */
export function witaToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}

export function maskPhone(phone: string): string {
  return phone.length > 4 ? "•".repeat(Math.max(0, phone.length - 4)) + phone.slice(-4) : phone;
}
