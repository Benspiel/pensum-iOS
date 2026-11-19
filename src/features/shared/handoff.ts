/* Übergabe Abschreiben → Goodnotes-Tool.
 * Web-Quelle: tools/abschreiben/core.js (HANDOFF_KEY, makeHandoff, readHandoff), Web-Commit 770dbe4.
 * Im Web liegt der Text kurz in sessionStorage; in der App in einem In-Memory-Slot (nichts wird geschrieben, nichts überlebt einen Neustart).
 * Der Text wird einmal gelesen und sofort gelöscht, nach 10 Minuten verfällt er. */

export const HANDOFF_KEY = "pensum.abschreiben.handoff.v1";
export const HANDOFF_MAX_AGE = 10 * 60 * 1000;

export interface Handoff { text: string; name: string; }

export function makeHandoff(text: string, name = "Tafelbild", now = Date.now()): string {
  return JSON.stringify({ text: String(text || ""), name: String(name || "Tafelbild"), at: now });
}

/** Liest eine Übergabe. Gibt { text, name } oder null zurück (leer, kaputt oder zu alt). */
export function readHandoff(raw: string | null | undefined, now = Date.now()): Handoff | null {
  if (!raw) return null;
  let data: any;
  try { data = JSON.parse(raw); } catch (_) { return null; }
  if (!data || typeof data.text !== "string" || !data.text.trim()) return null;
  if (typeof data.at !== "number" || now - data.at > HANDOFF_MAX_AGE || data.at > now + 60_000) return null;
  return { text: data.text, name: typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 80) : "Tafelbild" };
}

let slot: string | null = null;

/** Abschreiben legt den erkannten Text ab. */
export function putHandoff(text: string, name?: string, now = Date.now()): void { slot = makeHandoff(text, name, now); }

/** Goodnotes holt den Text genau einmal ab (danach ist der Slot leer). */
export function takeHandoff(now = Date.now()): Handoff | null {
  const raw = slot;
  slot = null;
  return readHandoff(raw, now);
}
