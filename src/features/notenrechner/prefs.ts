/* Notenrechner – lokale Einstellungen über den Key-Value-Port (Web: localStorage-Schlüssel gleichen Namens).
 * Web-Quelle: tools/notenrechner/notenrechner.js (VIEW_KEY, DECLINED_KEY, SEEDED_KEY), Web-Commit 770dbe4.
 * Abweichung: Im Web liegt die Ansicht angemeldeter Nutzer zusätzlich in den Konto-Präferenzen; hier nur lokal. */
import type { KeyValueStore } from "../shared/ports";
import { sanitizeView, type View } from "./model";

export const VIEW_KEY = "pensum.notenrechner.view.v1";
export const DECLINED_KEY = "pensum.notenrechner.importDeclined.v1";
export const SEEDED_KEY = "pensum.notenrechner.seeded.v1";

async function readList(kv: KeyValueStore, key: string): Promise<string[]> {
  try {
    const v = JSON.parse((await kv.getItem(key)) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch (_) { return []; }
}
async function addToList(kv: KeyValueStore, key: string, value: string): Promise<void> {
  try { await kv.setItem(key, JSON.stringify([...new Set([...(await readList(kv, key)), value])])); } catch (_) { /* egal */ }
}

export async function loadView(kv: KeyValueStore, now?: Date): Promise<View> {
  try { return sanitizeView(JSON.parse((await kv.getItem(VIEW_KEY)) || "null"), now); } catch (_) { return sanitizeView(null, now); }
}
export async function saveView(kv: KeyValueStore, view: View): Promise<void> {
  try { await kv.setItem(VIEW_KEY, JSON.stringify(view)); } catch (_) { /* egal */ }
}

export const seedKey = (userId: string | null, schoolYear: string) => `${userId ?? "guest"}|${schoolYear}`;
export const isSeeded = async (kv: KeyValueStore, key: string) => (await readList(kv, SEEDED_KEY)).includes(key);
export const markSeeded = (kv: KeyValueStore, key: string) => addToList(kv, SEEDED_KEY, key);

export const isDeclined = async (kv: KeyValueStore, userId: string) => (await readList(kv, DECLINED_KEY)).includes(userId);
export const markDeclined = (kv: KeyValueStore, userId: string) => addToList(kv, DECLINED_KEY, userId);
