"use client";

import { useApi } from "./use-api";

export type DriverDoc = { id: number; type: string; label: string; status: string; version: number; expires_at: string | null; issued_at: string | null; rejection_reason_code: string | null; rejection_note: string | null; reviewed_at: string | null; required: boolean; file_url?: string | null };
export type DriverMe = {
  id: number; user_id: number; name: string; phone: string; status: string; is_online: boolean; last_seen_at: string | null;
  nik: string | null; nik_masked: string | null; birth_date: string | null; address: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null;
  partner_organization: string | null; rating_avg: number; rating_count: number; trips_completed: number; acceptance_rate_30d: number | null; on_time_rate_90d: number | null;
  balance: number; balance_threshold: number; below_threshold: boolean; submitted_at: string | null; verified_at: string | null; suspended_at: string | null; suspension_reason: string | null; sla_deadline_at: string | null;
  vehicle: { id: number; vehicle_class: string; vehicle_class_name: string; brand: string; model: string; year: number; plate_number: string; color: string | null; seats: number | null; luggage_capacity: number | null; has_child_seat: boolean; has_roof_rack: boolean; stnk_expires_at: string | null; status: string } | null;
  bank_account: { bank_code: string; account_number: string; account_name: string; verified_at: string | null } | null;
  documents: DriverDoc[]; missing_documents: { type: string; label: string }[]; required_documents: { type: string; label: string; has_expiry: boolean }[];
  all_required_approved: boolean; has_expired_document: boolean;
};
export type Offer = { id: number; wave: number; response: string; offered_at: string; expires_at: string; seconds_left: number; order: { code: string; destination: string; zone: string | null; duration_min_est: number | null; pickup_at: string; ferry_eta_min_at: string | null; ferry_eta_max_at: string | null; ferry_route: string | null; vehicle_class: string; passengers: number; luggage_units: number; child_seats: number; needs_roof_rack: boolean; payment_method: string; total: number; commission_amount: number; driver_net: number; notes: string | null; channel: string } };
export type WaitingInfo = { anchor_at: string | null; anchor_source: string; free_until: string | null; free_minutes_left: number | null; minutes_beyond_free: number; waiting_fee_estimate: number; no_show_available_at: string | null; no_show_available: boolean };

export const useDriverMe = (poll?: number) => useApi<DriverMe>("/driver/me", { poll });

export const DRIVER_STATUS_LABEL: Record<string, string> = {
  draft: "Draf pendaftaran", submitted: "Menunggu verifikasi", revision_required: "Perlu perbaikan", active: "Aktif", suspended: "Ditangguhkan", rejected: "Ditolak", inactive: "Nonaktif",
};
export const DOC_STATUS_LABEL: Record<string, string> = { pending: "Menunggu review", approved: "Disetujui", rejected: "Ditolak", expired: "Kedaluwarsa" };
export const PAYMENT_LABEL: Record<string, string> = { cash: "Tunai", bank_transfer: "Transfer", gateway: "Non-tunai" };
