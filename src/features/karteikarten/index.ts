/* Karteikarten – öffentliche API des Features und Vertrag mit dem Planer.
 * Web-Quellen: tools/karteikarten/{core,store}.js, karteikarten.js (Link aus dem Planer: Zeile ~769), tools/planer/planer.js (Zeile ~124) – Web-Commit 770dbe4. */
export * from "./core";
export * from "./store";
export * from "./ops";

import type { KarteikartenData, KarteikartenStore } from "./store";

/* ---------- Planer-Vertrag ---------- */

export interface DeckSummary {
  id: string;
  name: string;
  cardCount: number;
}

/**
 * Stapel für die Auswahl im Planer („Klausur → Stapel verknüpfen“). Nimmt einen bereits erzeugten Store
 * (Gast oder Konto, vgl. createGuestStore/createCloudStore) und lädt über store.load(). Reihenfolge wie im Store.
 * Hinweis: Wer denselben Cloud-Store auch in den Karteikarten benutzt, verliert nichts – load() speichert Ausstehendes zuerst.
 */
export async function listDeckSummaries(store: Pick<KarteikartenStore, "load">): Promise<DeckSummary[]> {
  const data: KarteikartenData = await store.load();
  return data.decks.map((d) => ({ id: d.id, name: d.name, cardCount: d.cards.length }));
}

/* ---------- Link vom Planer: ?deck=<id> ---------- */

type Params = Record<string, string | string[] | undefined>;

/**
 * Liest den Expo-Router-Parameter `deck` (z. B. aus useLocalSearchParams()).
 * Gibt die Stapel-ID zurück oder null, wenn der Parameter fehlt oder unbrauchbar ist.
 *
 * Unterschiede zum Web (karteikarten.js ~769: `/^#deck=(.+)$/.exec(location.hash)` und decodeURIComponent):
 *   - Query statt Hash. Der Planer verlinkt auf /tools/karteikarten?deck=<id>; ein Web-Link mit #deck=… wird in der App nicht gelesen.
 *   - Weitere Query-Parameter stören nicht (im Web würde `#deck=a&x=1` die ID „a&x=1“ ergeben und nicht gefunden).
 *   - Wiederholt sich `deck` (Array), gilt der erste Wert.
 *   - Der Router liefert den Wert meist schon decodiert. Steht noch ein „%“ darin (IDs enthalten nie eines), wird einmal
 *     decodiert; misslingt das (kaputte Sequenz), ist das Ergebnis null (Web: Ausnahme in decodeURIComponent).
 *   - Gültig ist nur eine ID mit 1 bis 36 Zeichen (Länge wie text(id, 36) im Speicher) ohne Leer- und Steuerzeichen.
 *     Ungültig → null. Ob der Stapel wirklich existiert, prüft resolveDeckParam (Web: deckById).
 */
export function parseDeckParam(params: Params | null | undefined): string | null {
  let value = params ? params.deck : undefined;
  if (Array.isArray(value)) value = value[0];
  if (typeof value !== "string" || !value) return null;
  if (value.includes("%")) {
    try { value = decodeURIComponent(value); } catch (_) { return null; }
  }
  if (value.length > 36 || /[\s\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

/** Wie parseDeckParam, liefert die ID aber nur, wenn es den Stapel in den geladenen Daten gibt (verwaiste IDs → null, dann Stapelliste zeigen). */
export function resolveDeckParam(data: KarteikartenData, params: Params | null | undefined): string | null {
  const id = parseDeckParam(params);
  return id !== null && data.decks.some((d) => d.id === id) ? id : null;
}
