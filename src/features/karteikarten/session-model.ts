/* Karteikarten – Zustandsautomat der Oberfläche und Lernrunden-Logik (reine Funktionen, ohne React; deshalb testbar).
 * Web-Quelle: tools/karteikarten/karteikarten.js (Pensum, Web-Commit 770dbe4): `view` (boot/list/deck/loading/study/result),
 * startStudy, flipCard, checkAnswer, grade, renderResult, renderList (Banner), deckMeta, noteHtml.
 * Texte stehen wörtlich wie im Web. Der Reducer verändert nichts; die Rundenfunktionen verändern nur das Level der Karte (answerCard). */
import { MAX_DECKS, answerCard, buildQueue, dueCount, isCorrect, isLevelMode, resetLevels } from "./core";
import type { Card, Deck, Rng, StudyType } from "./core";
import type { KarteikartenData } from "./store";

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/* ---------- Lernrunde ---------- */

export interface Feedback { ok: boolean; given: string }

export interface Round {
  deckId: string;
  type: StudyType;
  queue: string[];
  total: number;
  right: number;
  wrong: number;
  wrongIds: string[];
  flipped: boolean;
  feedback: Feedback | null;
}

export type StartResult =
  | { kind: "empty"; message: string }
  | { kind: "needsReset" }
  | { kind: "ready"; round: Round };

export const newRound = (deckId: string, type: StudyType, queue: string[]): Round =>
  ({ deckId, type, queue, total: queue.length, right: 0, wrong: 0, wrongIds: [], flipped: false, feedback: null });

/**
 * Start einer Runde. `queueOverride` = „Falsche nochmal“. Ohne Karten: Hinweis; im Level-Modus ohne fällige Karten:
 * "needsReset" (die Oberfläche fragt „Von vorn beginnen?“, ruft resetLevels und startet erneut).
 */
export function startRound(deck: Deck, type: StudyType, options: { queueOverride?: string[]; rng?: Rng } = {}): StartResult {
  if (!deck.cards.length) return { kind: "empty", message: "Füge dem Stapel zuerst Karten hinzu." };
  let queue = options.queueOverride;
  if (!queue) {
    if (isLevelMode(deck) && !dueCount(deck)) return { kind: "needsReset" };
    queue = buildQueue(deck, options.rng);
  }
  return { kind: "ready", round: newRound(deck.id, type, queue) };
}

/** „Von vorn beginnen“: alle Karten zurück auf Level 1 (verändert den Stapel). */
export const restartDeck = (deck: Deck): void => resetLevels(deck);

export const currentCard = (deck: Deck, round: Round): Card | undefined => deck.cards.find((c) => c.id === round.queue[0]);

/** Karte umdrehen (Üben). Doppeltes Umdrehen ändert nichts. */
export const flipRound = (round: Round): Round => (round.flipped ? round : { ...round, flipped: true });

/** Test: Eingabe prüfen. Ohne aktuelle Karte oder bei bereits vorhandenem Feedback bleibt die Runde gleich. */
export function checkRound(round: Round, card: Card | undefined, given: unknown): Round {
  if (!card || round.feedback) return round;
  return { ...round, feedback: { ok: isCorrect(given, card.back), given: String(given ?? "") } };
}

/** „Trotzdem richtig“. */
export const overrideRound = (round: Round): Round =>
  round.feedback ? { ...round, feedback: { ...round.feedback, ok: true } } : round;

/** Wertet die vorderste Karte aus (Level ändert sich im Level-Modus am Stapel) und gibt die neue Runde zurück. */
export function gradeRound(deck: Deck, round: Round, ok: boolean): Round {
  const id = round.queue[0];
  if (id === undefined) return round;
  const { queue } = answerCard(deck, round.queue, ok);
  return {
    ...round,
    queue,
    right: round.right + (ok ? 1 : 0),
    wrong: round.wrong + (ok ? 0 : 1),
    wrongIds: !ok && !round.wrongIds.includes(id) ? [...round.wrongIds, id] : round.wrongIds,
    flipped: false,
    feedback: null,
  };
}

/** „Weiter“ nach dem Test-Feedback. */
export const nextRound = (deck: Deck, round: Round): Round => (round.feedback ? gradeRound(deck, round, round.feedback.ok) : round);

export const progressPercent = (round: Round): number => Math.round(((round.total - round.queue.length) / Math.max(1, round.total)) * 100);

export const roundBadge = (deck: Deck, round: Round, card: Card | undefined): string =>
  `${round.queue.length} übrig${isLevelMode(deck) && card ? ` · Level ${card.level}` : ""}`;

export const loadingTitle = (type: StudyType): string => `${type === "test" ? "Dein Test" : "Deine Runde"} wird vorbereitet …`;
export const loadingSubtitle = (deckName: string, count: number): string => `${deckName} · ${plural(count, "Karte wird", "Karten werden")} gemischt`;
/** Dauer des Ladeschritts vor der Runde in ms (Web: 900, bei reduzierter Bewegung 200). */
export const loadingDelay = (reduceMotion: boolean): number => (reduceMotion ? 200 : 900);

export interface ResultTexts {
  big: string;
  title: string;
  text: string;
  /** „Falsche nochmal“ anbieten (nur Alle-Modus mit Fehlern). */
  retry: boolean;
  /** Level-Kästen zeigen. */
  boxes: boolean;
}

export function resultTexts(deck: Deck, round: Round): ResultTexts {
  const level = isLevelMode(deck);
  const answers = round.right + round.wrong;
  return {
    big: level ? "✓" : `${round.right}/${round.total}`,
    title: level ? "Runde geschafft." : round.wrong ? "Fast geschafft." : "Alles richtig!",
    text: level ? `${plural(answers, "Antwort", "Antworten")}, davon ${round.right} richtig.` : `${round.right} von ${round.total} Karten gewusst.`,
    retry: !level && round.wrongIds.length > 0,
    boxes: level,
  };
}

/* ---------- Texte der Listen- und Stapelansicht ---------- */

export function deckMeta(deck: Deck): string {
  return `${plural(deck.cards.length, "Karte", "Karten")} · ${isLevelMode(deck) ? "Level" : "Alle hintereinander"}`;
}

export function listStats(data: KarteikartenData): { decks: string; cards: number; due: number; full: boolean; banner: string } {
  const cards = data.decks.reduce((n, d) => n + d.cards.length, 0);
  const due = data.decks.reduce((n, d) => n + dueCount(d), 0);
  const banner = !data.decks.length
    ? "Leg deinen ersten Stapel an."
    : due ? `Lerne heute: ${plural(due, "Karte wartet", "Karten warten")} auf dich.` : cards ? "Alles gelernt. Stark!" : "Füge deinen Stapeln Karten hinzu.";
  return { decks: `${data.decks.length}/${MAX_DECKS}`, cards, due, full: data.decks.length >= MAX_DECKS, banner };
}

/** Beschriftung des runden Start-Knopfs in der Liste: fällige Karten, „✓“ wenn im Level-Modus alles gelernt ist, sonst null (= Pfeil). */
export function goLabel(deck: Deck): string | null {
  const due = dueCount(deck);
  if (isLevelMode(deck) && deck.cards.length && !due) return "✓";
  return due ? String(due) : null;
}

export type SaveStatus = "saving" | "saved" | "error";

/** Speicherhinweis (Gast oder Konto), wie noteHtml im Web. `loginHint` = true bei Gast. */
export function saveNote(signedIn: boolean, status: SaveStatus): { text: string; hollow: boolean; loginHint: boolean } {
  if (!signedIn) return { text: "Nur auf diesem Gerät gespeichert.", hollow: true, loginHint: true };
  if (status === "saving") return { text: "Speichert …", hollow: true, loginHint: false };
  if (status === "error") return { text: "Speichern fehlgeschlagen. Es wird erneut versucht, sobald du wieder online bist.", hollow: true, loginHint: false };
  return { text: "In deinem Konto gespeichert, auf allen deinen Geräten.", hollow: false, loginHint: false };
}

/* ---------- Zustandsautomat ---------- */

export type DeckTab = "learn" | "cards" | "add";

export type View =
  | { name: "boot" }
  | { name: "list" }
  | { name: "deck"; id: string; tab: DeckTab }
  | { name: "loading"; round: Round; count: number }
  | { name: "study"; round: Round }
  | { name: "result"; round: Round };

export type ViewAction =
  | { type: "boot" }
  /** Daten sind geladen; `deckId` aus dem Planer-Link (schon geprüft) öffnet den Stapel. */
  | { type: "loaded"; deckId: string | null }
  | { type: "list" }
  | { type: "openDeck"; id: string; tab?: DeckTab }
  | { type: "setTab"; tab: DeckTab }
  | { type: "beginRound"; round: Round }
  | { type: "roundReady" }
  | { type: "updateRound"; round: Round }
  /** Runde abbrechen („Beenden“) oder Ergebnis → Stapel: zurück zum Stapel, Tab „Lernen“. */
  | { type: "toDeck" };

export const initialView: View = { name: "boot" };

export function viewReducer(view: View, action: ViewAction): View {
  switch (action.type) {
    case "boot": return { name: "boot" };
    case "loaded": return action.deckId ? { name: "deck", id: action.deckId, tab: "learn" } : { name: "list" };
    case "list": return { name: "list" };
    case "openDeck": return { name: "deck", id: action.id, tab: action.tab ?? "learn" };
    case "setTab": return view.name === "deck" ? { ...view, tab: action.tab } : view;
    case "beginRound": return { name: "loading", round: action.round, count: action.round.queue.length };
    case "roundReady": return view.name === "loading" ? { name: "study", round: view.round } : view;
    case "updateRound":
      if (view.name !== "study") return view;
      return action.round.queue.length ? { name: "study", round: action.round } : { name: "result", round: action.round };
    case "toDeck": return view.name === "study" || view.name === "result" || view.name === "loading" ? { name: "deck", id: view.round.deckId, tab: "learn" } : view;
  }
}
