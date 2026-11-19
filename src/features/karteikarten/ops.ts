/* Karteikarten – Datenoperationen, die im Web direkt in der Oberfläche stehen (ohne Oberfläche, deshalb testbar).
 * Web-Quelle: tools/karteikarten/karteikarten.js (Pensum, Web-Commit 770dbe4):
 *   deckDialog (Prüfung Name/Limit), submit "addCard" und cardDialog (Prüfung Vorder-/Rückseite),
 *   kiAddChosen (KI-Karten übernehmen, Doppelte überspringen), runImport/offerImport (Gast-Daten ins Konto).
 * Die Meldungstexte sind wörtlich aus dem Web übernommen. */
import { MAX_DECKS } from "./core";
import type { Card, Deck, DeckMode } from "./core";
import type { CloudStore, KarteikartenData } from "./store";
import type { KeyValueStore } from "../shared/ports";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export { plural };

/* ---------- Stapel und Karten prüfen ---------- */

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** Neuer Stapel: Name (getrimmt, nicht leer) und Abfrage-Art; höchstens MAX_DECKS Stapel. */
export function checkNewDeck(data: KarteikartenData, input: { name: unknown; mode: unknown }, newId: () => string): Checked<Deck> {
  const name = String(input.name || "").trim();
  if (!name) return { ok: false, error: "Gib dem Stapel einen Namen." };
  if (data.decks.length >= MAX_DECKS) return { ok: false, error: "Du kannst höchstens 5 Stapel haben." };
  const mode: DeckMode = input.mode === "level" ? "level" : "all";
  return { ok: true, value: { id: newId(), name, mode, cards: [] } };
}

/** Stapel bearbeiten (Name und Abfrage-Art). */
export function checkDeckEdit(input: { name: unknown; mode: unknown }): Checked<{ name: string; mode: DeckMode }> {
  const name = String(input.name || "").trim();
  if (!name) return { ok: false, error: "Gib dem Stapel einen Namen." };
  return { ok: true, value: { name, mode: input.mode === "level" ? "level" : "all" } };
}

/** Karte anlegen oder bearbeiten: beide Seiten getrimmt und nicht leer. `empty` ist die Meldung aus Hinzufügen bzw. Bearbeiten. */
export function checkCardText(input: { front: unknown; back: unknown }, context: "add" | "edit" = "add"): Checked<{ front: string; back: string }> {
  const front = String(input.front || "").trim();
  const back = String(input.back || "").trim();
  if (!front || !back) return { ok: false, error: context === "add" ? "Fülle Vorder- und Rückseite aus." : "Vorder- und Rückseite dürfen nicht leer sein." };
  return { ok: true, value: { front, back } };
}

/** Neue Karte auf Level 1 (hängt sie an den Stapel an). */
export function addCard(deck: Deck, front: string, back: string, newId: () => string): Card {
  const card: Card = { id: newId(), front, back, level: 1 };
  deck.cards.push(card);
  return card;
}

/* ---------- KI-Vorschlag übernehmen ---------- */

/** Übernimmt die gewählten KI-Karten; Karten, deren Vorderseite (getrimmt, klein geschrieben) schon im Stapel steht, werden übersprungen. Gibt die Anzahl neu angelegter Karten zurück. */
export function mergeKiCards(deck: Deck, picked: ReadonlyArray<{ front: string; back: string }>, newId: () => string): number {
  const have = new Set(deck.cards.map((c) => c.front.trim().toLowerCase()));
  let added = 0;
  for (const c of picked) {
    if (have.has(c.front.trim().toLowerCase())) continue;
    deck.cards.push({ id: newId(), front: c.front, back: c.back, level: 1 });
    added++;
  }
  return added;
}

/** Meldung nach dem Übernehmen (wie im Web). */
export const kiAddedMessage = (added: number, picked: number): string =>
  added === picked ? `${plural(added, "Karte", "Karten")} hinzugefügt.` : `${plural(added, "Karte", "Karten")} hinzugefügt, Doppelte übersprungen.`;

/* ---------- Gast-Daten ins Konto übernehmen ---------- */

/** Wie im Web: Merkliste der Konten, die „Nicht übernehmen“ gewählt haben (auf iOS im KeyValueStore). */
export const DECLINED_KEY = "pensum.karteikarten.declined.v1";

export async function readDeclined(kv: KeyValueStore): Promise<string[]> {
  try {
    const v = JSON.parse((await kv.getItem(DECLINED_KEY)) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch (_) { return []; }
}

export async function markDeclined(kv: KeyValueStore, userId: string): Promise<void> {
  try { await kv.setItem(DECLINED_KEY, JSON.stringify([...new Set([...(await readDeclined(kv)), userId])])); } catch (_) { /* egal */ }
}

/** Soll die Übernahme angeboten werden? Nur wenn lokale Stapel da sind und dieses Konto sie nicht schon abgelehnt hat. */
export function shouldOfferImport(local: KarteikartenData, declined: readonly string[], userId: string): boolean {
  return local.decks.length > 0 && !declined.includes(userId);
}

export const countCards = (decks: readonly Deck[]): number => decks.reduce((n, d) => n + d.cards.length, 0);

/** Text der Rückfrage (wörtlich wie im Web). */
export function importPrompt(local: KarteikartenData): { title: string; text: string; confirm: string; cancel: string } {
  const n = countCards(local.decks);
  return {
    title: "Lokale Karten übernehmen?",
    text: `Auf diesem Gerät ${local.decks.length === 1 ? "liegt 1 Stapel" : `liegen ${local.decks.length} Stapel`} mit ${plural(n, "Karte", "Karten")} aus dem Gast-Modus. Sollen sie in dein Konto übernommen werden? Sonst bleiben sie getrennt auf diesem Gerät.`,
    confirm: "Ins Konto übernehmen",
    cancel: "Nicht übernehmen",
  };
}

export interface ImportResult {
  /** Neuer Stand des Kontos (das übergebene Objekt bleibt unverändert; ohne Änderung kommt dasselbe Objekt zurück). */
  data: KarteikartenData;
  /** Angelegte oder um Karten ergänzte Stapel und neu angelegte Karten. */
  decks: number;
  cards: number;
  /** true, wenn alles Lokale im Konto angekommen oder dort schon vorhanden ist (dann darf der Gast-Speicher geleert werden). */
  complete: boolean;
  /** true, wenn nichts übernommen werden konnte, weil das Konto schon voll war. */
  noRoom: boolean;
  /** Meldung für die Oberfläche (wie im Web, ergänzt um „schon vorhanden“). */
  message: string;
}

/** Höchstzahl Karten je Stapel (wie in clean() im Store). */
const MAX_CARDS = 2000;
const cardKey = (c: { front: string; back: string }) => JSON.stringify([c.front, c.back]);

/**
 * Übernimmt lokale Stapel ins Konto, höchstens bis MAX_DECKS Stapel, mit neuen IDs.
 * Wiederholbar ohne Duplikate: Gibt es im Konto schon einen Stapel mit demselben Namen, kommen nur Karten hinzu, deren Paar
 * (Vorderseite, Rückseite) dort noch fehlt (genauer Vergleich); sind alle Paare da, passiert nichts. So verdoppelt ein zweiter
 * Versuch nach einem Teilfehler oder einem nicht geleerten Gast-Speicher nichts. Der Modus eines vorhandenen Stapels bleibt.
 */
export function importGuestDecks(current: KarteikartenData, local: KarteikartenData, newId: () => string): ImportResult {
  const decks: Deck[] = [...current.decks];
  const byName = new Map<string, number[]>();
  decks.forEach((d, i) => byName.set(d.name, [...(byName.get(d.name) ?? []), i]));
  let touched = 0, cards = 0, noRoomLeft = false, capLeft = false;

  for (const d of local.decks) {
    const same = byName.get(d.name);
    if (same && same.length) {
      const known = new Set<string>();
      for (const i of same) for (const c of decks[i]!.cards) known.add(cardKey(c));
      const fresh: Deck["cards"] = [];
      for (const c of d.cards) { const k = cardKey(c); if (!known.has(k)) { known.add(k); fresh.push(c); } }
      if (!fresh.length) continue;
      const target = decks[same[0]!]!;
      const take = fresh.slice(0, Math.max(0, MAX_CARDS - target.cards.length));
      if (take.length < fresh.length) capLeft = true;
      if (!take.length) continue;
      decks[same[0]!] = { ...target, cards: [...target.cards, ...take.map((c) => ({ id: newId(), front: c.front, back: c.back, level: c.level }))] };
      touched++; cards += take.length;
      continue;
    }
    if (decks.length >= MAX_DECKS) { noRoomLeft = true; continue; }
    decks.push({ id: newId(), name: d.name, mode: d.mode, cards: d.cards.map((c) => ({ id: newId(), front: c.front, back: c.back, level: c.level })) });
    byName.set(d.name, [decks.length - 1]);
    touched++; cards += d.cards.length;
  }

  const complete = !noRoomLeft && !capLeft;
  const leftover = noRoomLeft ? " Mehr als 5 Stapel passen nicht." : capLeft ? " Nicht alle Karten passen (höchstens 2000 pro Stapel)." : "";
  if (!touched) {
    return {
      data: current, decks: 0, cards: 0, complete, noRoom: noRoomLeft,
      message: noRoomLeft ? "Dein Konto hat schon 5 Stapel. Lösche einen, um lokale Stapel zu übernehmen." : capLeft ? "Ein Stapel im Konto hat schon 2000 Karten. Es wurde nichts übernommen." : "Alle lokalen Karten sind schon in deinem Konto.",
    };
  }
  return {
    data: { decks }, decks: touched, cards, complete, noRoom: false,
    message: `${plural(touched, "Stapel", "Stapel")} mit ${plural(cards, "Karte", "Karten")} in dein Konto übernommen.${leftover}`,
  };
}

export interface ImportOutcome {
  result: ImportResult;
  /** Das Konto hat die Daten sicher gespeichert (flushOrThrow gelang). */
  saved: boolean;
  /** Der Gast-Speicher wurde geleert (nur bei vollständigem Erfolg). */
  cleared: boolean;
  /** Grund, wenn das Speichern scheiterte; die Gastdaten bleiben dann erhalten. */
  error?: unknown;
}

/**
 * Gastimport mit Sicherung: übernimmt `local` in die Konto-Daten, speichert über den Cloud-Store und leert den Gast-Speicher
 * nur, wenn alles übernommen UND sicher gespeichert ist (store.flushOrThrow). Bei Fehlern bleiben die Gastdaten, ein erneuter
 * Aufruf erzeugt dank der Namens-/Kartenpaar-Prüfung keine Duplikate.
 */
export async function importIntoAccount(a: {
  local: KarteikartenData;
  getData: () => KarteikartenData;
  setData: (data: KarteikartenData) => void;
  store: Pick<CloudStore, "save" | "flushOrThrow" | "newId">;
  guest: { clear(): Promise<void> };
}): Promise<ImportOutcome> {
  const before = a.getData();
  const result = importGuestDecks(before, a.local, a.store.newId);
  if (result.noRoom) return { result, saved: false, cleared: false };
  if (result.data !== before) {
    a.setData(result.data);
    await a.store.save(result.data);
  }
  try {
    await a.store.flushOrThrow();
  } catch (error) {
    return { result, saved: false, cleared: false, error };
  }
  if (!result.complete) return { result, saved: true, cleared: false };
  await a.guest.clear();
  return { result, saved: true, cleared: true };
}
