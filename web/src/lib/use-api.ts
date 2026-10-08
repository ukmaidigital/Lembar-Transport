"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiRequestError, Envelope } from "./api";

type State<T> = { data: T | null; meta: Record<string, unknown> | null; error: string | null; loading: boolean };

/** Small data hook: fetches an API path through the BFF proxy, with optional polling (ms). */
export function useApi<T = unknown>(path: string | null, options: { poll?: number; locale?: string } = {}) {
  const [state, setState] = useState<State<T>>({ data: null, meta: null, error: null, loading: Boolean(path) });
  const alive = useRef(true);
  const load = useCallback(async (silent = false) => {
    if (!path) return;
    if (!silent) setState((s) => ({ ...s, loading: true }));
    try {
      const json = await api<Envelope<T>>(path, { raw: true, locale: options.locale });
      if (!alive.current) return;
      setState({ data: json.data as T, meta: (json.meta as Record<string, unknown>) ?? null, error: null, loading: false });
    } catch (e) {
      if (!alive.current) return;
      const msg = e instanceof ApiRequestError ? e.error.message : "Gagal memuat data";
      setState((s) => ({ ...s, error: msg, loading: false }));
    }
  }, [path, options.locale]);

  useEffect(() => {
    alive.current = true;
    load();
    let timer: ReturnType<typeof setInterval> | undefined;
    if (options.poll && path) {
      timer = setInterval(() => {
        if (document.visibilityState === "visible") load(true);
      }, options.poll);
    }
    return () => {
      alive.current = false;
      if (timer) clearInterval(timer);
    };
  }, [load, options.poll, path]);

  return { ...state, reload: () => load(true) };
}
