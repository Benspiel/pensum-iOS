/* Karteikarten mit KI – reine Logik (ohne React Native und ohne Netzwerk, deshalb testbar).
 * Web-Quellen (Pensum, Web-Commit 770dbe4): tools/karteikarten/ki.js (generateCards, COUNTS, MAX_FILE, MAX_PDF),
 * tools/karteikarten/karteikarten.js (kiBlock, kiGenerate, kiAddChosen), functions/ki-chat/lib.js (Action "cards", CARDS, Fehlertexte).
 * Die Function ki-chat prüft Team „ki-tester“, bestätigte E-Mail und das Tageslimit selbst und speichert nichts. */
import type { Deck } from "../core";
import { kiAddedMessage, mergeKiCards } from "../ops";

/* ---------- Grenzen (wie ki.js und die Function) ---------- */

export const MAX_FILE = 12 * 1024 * 1024; // Foto vom Handy, wird vor dem Senden verkleinert
export const MAX_PDF = 2.5 * 1024 * 1024; // PDFs gehen unverändert hin
export const COUNTS = [10, 15, 20, 30, 40, 60] as const;
export const DEFAULT_COUNT = 60;
export const TOPIC_MAX = 500; // Eingabefeld „Dein Thema oder Text“
export const TEXT_MAX = 8000; // CARDS.textMax der Function
export const COUNT_MAX = 60;
export const COUNT_DEFAULT = 15; // Standard der Function, wenn count fehlt
export const CARD_SIDE_MAX = 1000;

/* ---------- Anfrage ---------- */

export interface CardsInput { text?: string; image?: string; count?: number }

export interface CardsRequest { action: "cards"; text: string; image?: string; count: number }

/** Entfernt Steuerzeichen, vereinheitlicht Zeilenenden, trimmt und kürzt (wie cleanText der Function). */
export function cleanText(value: unknown, max: number): string {
  return String(value == null ? "" : value)
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

/** Zahl der gewünschten Karten: gerundet, 1 bis 60; ungültig → 15 (wie die Function). */
export function clampCount(count: unknown): number {
  return Math.min(COUNT_MAX, Math.max(1, Math.round(Number(count)) || COUNT_DEFAULT));
}

/** Baut den Body für `executeFunction(functionIds.kiChat, …)`. Wirft, wenn weder Thema noch Bild da ist (Meldung wie im Web). */
export function buildCardsRequest(input: CardsInput): CardsRequest {
  const text = cleanText(input.text, TEXT_MAX);
  const image = input.image ? input.image : undefined;
  if (!text && !image) throw new KiError("input", MISSING_INPUT);
  const req: CardsRequest = { action: "cards", text, count: clampCount(input.count ?? DEFAULT_COUNT) };
  if (image) req.image = image;
  return req;
}

export const MISSING_INPUT = "Gib ein Thema ein oder wähle ein Foto für die KI.";

/** Prüfung im Dialog „Neuer Stapel“ (karteikarten.js: `useAi && !topic && !hasFile`). */
export function checkKiInput(topic: unknown, hasFile: boolean): string | null {
  return !String(topic ?? "").trim() && !hasFile ? MISSING_INPUT : null;
}

/* ---------- Fehler ---------- */

export type KiErrorCode = "input" | "auth" | "unverified" | "forbidden" | "limit" | "image" | "empty" | "blocked" | "busy" | "error" | "setup" | "invalid";

/** Texte wie in der Function (functions/ki-chat). Für „setup“ gilt im Web der Text des KI-Dienstes. */
export const KI_MESSAGES: Record<Exclude<KiErrorCode, "input" | "invalid">, string> = {
  auth: "Nicht angemeldet.",
  unverified: "Bitte bestätige zuerst deine E-Mail-Adresse.",
  forbidden: "Der KI-Chat ist nur für das Team „Ki-Tester“ freigeschaltet.",
  limit: "Für heute ist das Limit erreicht. Morgen geht es weiter.",
  image: "Diese Datei kann die KI nicht lesen. Nimm ein JPEG, PNG, WebP oder ein PDF (bis ca. 2,5 MB).",
  empty: "Daraus konnte die KI keine Karten machen. Versuch ein anderes Thema oder ein deutlicheres Foto.",
  blocked: "Dazu kann die KI nichts sagen. Formuliere die Frage anders.",
  busy: "Die KI ist gerade überlastet. Probier es in ein paar Minuten noch einmal.",
  error: "Die KI antwortet gerade nicht. Versuch es später noch einmal.",
  setup: "Der KI-Dienst ist noch nicht eingerichtet.",
};

export const NOT_SET_UP = "Der KI-Dienst ist noch nicht eingerichtet.";
export const FALLBACK_ERROR = "Die KI antwortet gerade nicht. Versuch es später noch einmal.";

export class KiError extends Error {
  constructor(public readonly kiCode: KiErrorCode, message: string) {
    super(message);
    this.name = "KiError";
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Text für einen Server-Code ("limit", "image", …); unbekannt → null. */
export function messageForCode(code: unknown): string | null {
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(KI_MESSAGES, code) ? KI_MESSAGES[code as keyof typeof KI_MESSAGES] : null;
}

/**
 * Meldung für beliebige Fehler beim Erzeugen.
 *   - KiError: eigene Meldung (Antwort mit ok:false oder unbrauchbar).
 *   - HTTP-Status 404 (Appwrite kennt die Function nicht): „Der KI-Dienst ist noch nicht eingerichtet.“ (wie ki.js).
 *   - Sonst der Text der Function (executeFunction legt body.error in message; „unverified“ und „forbidden“ haben beide Status 403,
 *     deshalb entscheidet der Text, nicht der Status).
 */
export function kiErrorText(error: unknown): string {
  if (error instanceof KiError) return error.message;
  if (isRecord(error)) {
    const status = typeof error.status === "number" ? error.status : typeof error.code === "number" ? error.code : undefined;
    if (status === 404) return NOT_SET_UP;
    if (typeof error.message === "string" && error.message.trim()) return error.message;
  }
  return FALLBACK_ERROR;
}

/* ---------- Antwort ---------- */

export interface KiCard { front: string; back: string }

/**
 * Prüft die Antwort der Function: `{ ok: true, cards: [{front, back}] }`.
 * `{ ok: false, error, code }` (oder Unbrauchbares) wirft KiError mit deutscher Meldung. Unvollständige Karten fallen weg,
 * Seiten werden getrimmt und auf 1000 Zeichen gekürzt, doppelte Vorderseiten (ohne Groß-/Kleinschreibung) übersprungen, höchstens 60.
 */
export function parseCardsResponse(body: unknown): KiCard[] {
  if (!isRecord(body)) throw new KiError("error", FALLBACK_ERROR);
  if (body.ok !== true) {
    const text = typeof body.error === "string" && body.error.trim() ? body.error : messageForCode(body.code) ?? FALLBACK_ERROR;
    throw new KiError(typeof body.code === "string" && messageForCode(body.code) ? (body.code as KiErrorCode) : "error", text);
  }
  const list = Array.isArray(body.cards) ? body.cards : [];
  const seen = new Set<string>();
  const cards: KiCard[] = [];
  for (const c of list) {
    if (!isRecord(c) || typeof c.front !== "string" || typeof c.back !== "string") continue;
    const front = cleanText(c.front, CARD_SIDE_MAX);
    const back = cleanText(c.back, CARD_SIDE_MAX);
    const key = front.toLowerCase();
    if (!front || !back || seen.has(key)) continue;
    seen.add(key);
    cards.push({ front, back });
    if (cards.length >= COUNT_MAX) break;
  }
  if (!cards.length) throw new KiError("empty", KI_MESSAGES.empty);
  return cards;
}

/** Führt die Anfrage aus. `execute` ist `(payload) => executeFunction(functionIds.kiChat, payload)` (so bleibt die Logik ohne Netzwerk testbar). */
export async function generateCards(execute: (payload: CardsRequest) => Promise<unknown>, input: CardsInput): Promise<KiCard[]> {
  const request = buildCardsRequest(input);
  let body: unknown;
  try {
    body = await execute(request);
  } catch (error) {
    throw error instanceof KiError ? error : new KiError("error", kiErrorText(error));
  }
  return parseCardsResponse(body);
}

/* ---------- Zustand des KI-Blocks über den Tabs ---------- */

export interface Suggestion extends KiCard { on: boolean }

export type KiState =
  | { deckId: string; phase: "busy" }
  | { deckId: string; phase: "error"; error: string }
  | { deckId: string; phase: "result"; suggestions: Suggestion[] }
  | null;

export const kiBusy = (deckId: string): KiState => ({ deckId, phase: "busy" });
export const kiFailed = (deckId: string, error: string): KiState => ({ deckId, phase: "error", error });
/** Alle Vorschläge sind zunächst gewählt (wie im Web). */
export const kiLoaded = (deckId: string, cards: KiCard[]): KiState => ({ deckId, phase: "result", suggestions: cards.map((c) => ({ ...c, on: true })) });

export function kiToggle(state: KiState, index: number, on?: boolean): KiState {
  if (!state || state.phase !== "result" || !state.suggestions[index]) return state;
  return { ...state, suggestions: state.suggestions.map((s, i) => (i === index ? { ...s, on: on ?? !s.on } : s)) };
}

export const chosenCount = (state: KiState): number => (state && state.phase === "result" ? state.suggestions.filter((s) => s.on).length : 0);

/** Sichtbar nur im Stapel, für den die KI gefragt wurde. */
export const kiVisibleFor = (state: KiState, deckId: string): boolean => !!state && state.deckId === deckId;

/** Beschriftung des Knopfs „<n> Karten hinzufügen“ (wie im Web). */
export function addButtonLabel(chosen: number): string {
  return chosen ? `${chosen} ${chosen === 1 ? "Karte" : "Karten"} hinzufügen` : "Nichts ausgewählt";
}

export interface AddResult { added: number; picked: number; message: string }

/** Übernimmt die gewählten Vorschläge in den Stapel (Doppelte überspringen, über mergeKiCards) und liefert die Meldung. */
export function addChosen(deck: Deck, state: KiState, newId: () => string): AddResult | null {
  if (!state || state.phase !== "result") return null;
  const picked = state.suggestions.filter((s) => s.on);
  if (!picked.length) return null;
  const added = mergeKiCards(deck, picked, newId);
  return { added, picked: picked.length, message: kiAddedMessage(added, picked.length) };
}

/** Beschreibung für das Einverständnis vor dem Senden (Text bzw. Datei gehen an Google Gemini). */
export const consentDescription = (hasFile: boolean): string => (hasFile ? "Dein Thema oder Text und die ausgewählte Datei" : "Dein Thema oder Text");
