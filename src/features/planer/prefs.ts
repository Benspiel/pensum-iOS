/* Planer – lokale Einstellung „Gast-Übernahme abgelehnt“ über den Key-Value-Port.
 * Web-Quelle: tools/planer/planer.js (DECLINED_KEY), Web-Commit 770dbe4. */
import type { KeyValueStore } from "../shared/ports";

export const DECLINED_KEY = "pensum.planer.declined.v1";

async function read(kv: KeyValueStore): Promise<string[]> {
  try {
    const v = JSON.parse((await kv.getItem(DECLINED_KEY)) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch (_) { return []; }
}
export const isDeclined = async (kv: KeyValueStore, userId: string) => (await read(kv)).includes(userId);
export async function markDeclined(kv: KeyValueStore, userId: string): Promise<void> {
  try { await kv.setItem(DECLINED_KEY, JSON.stringify([...new Set([...(await read(kv)), userId])])); } catch (_) { /* egal */ }
}
