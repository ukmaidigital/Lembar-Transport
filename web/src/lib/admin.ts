"use client";

import type { DriverMe } from "./driver";

export type AdminDriver = DriverMe & { notes?: string | null };
export const REJECTION_REASONS: { code: string; label: string }[] = [
  { code: "blurry", label: "Foto buram / tidak terbaca" },
  { code: "expired", label: "Dokumen kedaluwarsa" },
  { code: "mismatch", label: "Data tidak sesuai (nama/NIK/nopol)" },
  { code: "incomplete", label: "Dokumen tidak lengkap / terpotong" },
  { code: "wrong_type", label: "Jenis dokumen salah" },
  { code: "suspected_fake", label: "Diduga tidak asli" },
];
export const PAYMENT_STATUS_LABEL: Record<string, string> = { pending_review: "Menunggu review", confirmed: "Dikonfirmasi", rejected: "Ditolak", expired: "Kedaluwarsa", pending: "Menunggu", paid: "Dibayar", failed: "Gagal", processed: "Diproses" };
export function qs(obj: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : "";
}
