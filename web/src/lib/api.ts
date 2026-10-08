/**
 * Typed-ish fetch wrapper for the Laravel API.
 * - In the browser, calls go to the Next.js BFF (/api/proxy/...) which attaches the httpOnly token cookie.
 * - On the server (RSC / route handlers), calls go straight to the API with the token from cookies.
 */
export type ApiError = { code: string; message: string; details?: unknown };

export class ApiRequestError extends Error {
  constructor(public status: number, public error: ApiError) {
    super(error.message);
  }
}

export type Envelope<T> = { data: T; meta?: Record<string, unknown>; links?: Record<string, unknown> };

const isServer = typeof window === "undefined";

export function apiBaseUrl(): string {
  return (isServer ? process.env.API_INTERNAL_URL : undefined) || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
}

type Options = RequestInit & { token?: string | null; locale?: string; raw?: boolean; idempotencyKey?: string };

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const { token, locale, raw, idempotencyKey, headers, ...init } = options;
  const url = isServer || token !== undefined
    ? `${apiBaseUrl()}${path}`
    : `/api/proxy${path}`;
  const h = new Headers(headers);
  h.set("Accept", "application/json");
  if (!(init.body instanceof FormData)) h.set("Content-Type", "application/json");
  if (locale) h.set("Accept-Language", locale);
  if (token) h.set("Authorization", `Bearer ${token}`);
  if (idempotencyKey) h.set("Idempotency-Key", idempotencyKey);
  const res = await fetch(url, { ...init, headers: h, cache: "no-store" });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: ApiError = json?.error ?? { code: "HTTP_" + res.status, message: json?.message ?? res.statusText };
    if (json?.errors && !json?.error) err.details = json.errors;
    throw new ApiRequestError(res.status, err);
  }
  return (raw ? json : json?.data !== undefined ? json.data : json) as T;
}

export function errorMessage(e: unknown, fallback = "Terjadi kesalahan"): string {
  if (e instanceof ApiRequestError) {
    const d = e.error.details as Record<string, string[]> | undefined;
    if (d && typeof d === "object" && !Array.isArray(d)) {
      const first = Object.values(d)[0];
      if (Array.isArray(first) && first[0]) return first[0];
    }
    return e.error.message || fallback;
  }
  return e instanceof Error ? e.message : fallback;
}
