/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

/**
 * Driver PWA service worker: precaches the app shell, serves navigations network-first
 * with a cached fallback, and never caches API calls (the IndexedDB action queue handles offline writes).
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    { matcher: ({ url }) => url.pathname.startsWith("/api/"), handler: new NetworkFirst({ cacheName: "lt-api-readonly", networkTimeoutSeconds: 10, matchOptions: { ignoreVary: true }, plugins: [{ cacheWillUpdate: async ({ request, response }) => (request.method === "GET" && response.ok ? response : null) }] }) },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
