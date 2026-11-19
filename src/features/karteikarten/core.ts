/* Karteikarten – reine Logik (ohne Oberfläche, deshalb testbar).
 * Web-Quelle: tools/karteikarten/core.js (Pensum, Web-Commit 770dbe4). Verhalten unverändert; neu sind nur Typen.
 *
 * Stapel: { id, name, mode: "all" | "level", cards: [Karte] }
 * Karte:  { id, front, back, level: 1–5 }
 *
 * Abfrage-Arten:
 *   all   – alle Karten nacheinander, es gibt keine Level
 *   level – 5 Level: richtig = ein Level höher, falsch = ein Level tiefer und die Karte kommt nochmal dran.
 *           Karten in Level 5 gelten als gelernt und werden nicht mehr abgefragt.
 */

/** Level einer Karte: 1 (neu) bis 5 (gelernt). */
export type Level = 1 | 2 | 3 | 4 | 5;

/** Abfrage-Art eines Stapels: "all" = der Reihe nach, "level" = fünf Level. */
export type DeckMode = "all" | "level";

/** Lernmodus einer Runde: "practice" = Karte umdrehen und selbst bewerten, "test" = Antwort schriftlich eingeben. */
export type StudyType = "practice" | "test";

export interface Card {
  id: string;
  front: string;
  back: string;
  level: Level;
}

export interface Deck {
  id: string;
  name: string;
  mode: DeckMode;
  cards: Card[];
}

/** Für die reine Logik genügen Modus und Karten (die Web-Tests übergeben nur diese beiden Felder). */
export type DeckLike = Pick<Deck, "mode" | "cards">;

/** Zufallsquelle (0 ≤ x < 1). Standard Math.random; in Tests austauschbar. */
export type Rng = () => number;

export const MAX_DECKS = 5;
export const LEVELS = 5;
export const MODES: Record<DeckMode, { label: string; hint: string }> = {
  all: { label: "Alle hintereinander", hint: "Es gibt keine Level. Alle Karten kommen nacheinander dran." },
  level: { label: "Level (5 Stufen)", hint: "Richtig: die Karte steigt ein Level auf. Falsch: sie fällt ein Level zurück und wird nochmal abgefragt." },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function shuffle<T>(list: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T]; // i und j liegen im Bereich
  }
  return a;
}

/** Vergleichsform: Groß-/Kleinschreibung, doppelte Leerzeichen und Satzzeichen am Rand sind egal. */
export function normalize(s: unknown): string {
  return String(s ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:!?"'„“”‚‘’()]+|[\s.,;:!?"'„“”‚‘’()]+$/g, "");
}

/** Schriftliche Abfrage: richtig, wenn die Eingabe der ganzen Rückseite oder einer Alternative entspricht (getrennt mit / oder ;). */
export function isCorrect(input: unknown, answer: unknown): boolean {
  const given = normalize(input);
  if (!given) return false;
  if (given === normalize(answer)) return true;
  return String(answer ?? "").split(/[\/;]/).map(normalize).filter(Boolean).includes(given);
}

export const isLevelMode = (deck: Pick<Deck, "mode">): boolean => deck.mode === "level";

/** Level einer Karte; fehlende oder ungültige Werte (0, NaN) zählen wie im Web als Level 1. */
const levelOf = (c: Pick<Card, "level">): number => c.level || 1;

/** Anzahl Karten pro Level (Index 0 = Level 1). */
export function levelCounts(deck: DeckLike): number[] {
  const counts: number[] = Array(LEVELS).fill(0);
  for (const c of deck.cards) counts[clamp(levelOf(c), 1, LEVELS) - 1]! += 1; // Index liegt immer in 0..4
  return counts;
}

/** Karten, die beim Lernen drankommen. */
export function dueCount(deck: DeckLike): number {
  return isLevelMode(deck) ? deck.cards.filter((c) => levelOf(c) < LEVELS).length : deck.cards.length;
}

/** Reihenfolge einer Lernrunde (Karten-IDs). Im Level-Modus kommen niedrige Level zuerst. */
export function buildQueue(deck: DeckLike, rng: Rng = Math.random): string[] {
  const cards = isLevelMode(deck) ? deck.cards.filter((c) => levelOf(c) < LEVELS) : deck.cards;
  const mixed = shuffle(cards, rng);
  if (isLevelMode(deck)) mixed.sort((a, b) => levelOf(a) - levelOf(b));
  return mixed.map((c) => c.id);
}

/**
 * Wertet die vorderste Karte der Runde aus. Verändert Karte (Level) und Warteschlange.
 * Level-Modus: richtig → +1 Level, Karte ist durch; falsch → −1 Level, Karte kommt ans Ende und wird nochmal gefragt.
 * Alle-Modus: jede Karte genau einmal.
 */
export function answerCard(deck: DeckLike, queue: readonly string[], correct: boolean): { queue: string[]; card: Card | null } {
  const id = queue[0] as string; // bei leerer Warteschlange undefined, dann findet find keine Karte (wie im Web)
  const card = deck.cards.find((c) => c.id === id);
  const rest = queue.slice(1);
  if (!card) return { queue: rest, card: null };
  if (isLevelMode(deck)) {
    card.level = clamp(levelOf(card) + (correct ? 1 : -1), 1, LEVELS) as Level;
    return { queue: correct ? rest : [...rest, id], card };
  }
  return { queue: rest, card };
}

/** Alle Karten zurück auf Level 1. */
export function resetLevels(deck: DeckLike): void {
  for (const c of deck.cards) c.level = 1;
}
