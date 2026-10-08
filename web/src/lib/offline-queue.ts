"use client";

/**
 * Offline action queue for the driver PWA (FR-DRV-11, FR-SYS-07).
 * Status taps made without connectivity are stored in IndexedDB with the tap time
 * and replayed in order when the device is back online; the server keeps the
 * client_timestamp and flags late syncs.
 */
import { api, ApiRequestError } from "./api";

export type QueuedAction = { id?: number; path: string; body: Record<string, unknown>; created_at: string; label: string };

const DB = "lembar-driver";
const STORE = "actions";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function all(): Promise<QueuedAction[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedAction[]);
    req.onerror = () => reject(req.error);
  });
}

async function remove(id: number) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueue(action: Omit<QueuedAction, "id">) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(action);
    tx.oncomplete = () => { notify(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function pendingCount() { return (await all()).length; }

const listeners = new Set<() => void>();
export function onQueueChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function notify() { listeners.forEach((fn) => fn()); }

let flushing = false;
/** Replays queued actions in order; stops at the first network failure, drops actions the server rejects as business errors. */
export async function flush(): Promise<{ sent: number; failed: QueuedAction[] }> {
  if (flushing || typeof navigator !== "undefined" && !navigator.onLine) return { sent: 0, failed: [] };
  flushing = true;
  const failed: QueuedAction[] = [];
  let sent = 0;
  try {
    for (const a of await all()) {
      try {
        await api(a.path, { method: "POST", body: JSON.stringify({ ...a.body, client_timestamp: a.created_at }) });
        await remove(a.id!); sent++;
      } catch (e) {
        if (e instanceof ApiRequestError && e.status < 500) { await remove(a.id!); failed.push(a); continue; }
        break; // still offline or server down: keep the rest for later
      }
    }
  } finally { flushing = false; notify(); }
  return { sent, failed };
}

/** Posts immediately when online, otherwise queues. Returns true when sent live. */
export async function postOrQueue(path: string, body: Record<string, unknown>, label: string): Promise<boolean> {
  if (navigator.onLine) {
    try {
      await api(path, { method: "POST", body: JSON.stringify({ ...body, client_timestamp: new Date().toISOString() }) });
      return true;
    } catch (e) {
      if (e instanceof ApiRequestError) throw e; // business error: surface it
    }
  }
  await enqueue({ path, body, label, created_at: new Date().toISOString() });
  return false;
}
