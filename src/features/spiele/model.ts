/* Vier gewinnt – Spielzustand, Texte und Siegzähler als reine Funktionen (ohne React, getestet).
 * Web-Quelle: tools/spiele/ui-vier.js und common.js (Pensum, Web-Commit 770dbe4):
 * - Stufen leicht/mittel/schwer = Suchtiefe 2/4/6, Start „mittel“, Mensch (gelb, Spieler 1) beginnt immer,
 * - Zähler „Siege hier“ je Stufe unter dem Schlüssel `c4wins_<stufe>` im Objekt `pensum.spiele.best.v1` (nur auf dem Gerät). */
import { ROWS, drop, emptyBoard, isFull, winner, type Board, type Player, type Pos } from "./connect4";

export type LevelId = "leicht" | "mittel" | "schwer";
export const LEVELS: Record<LevelId, { depth: number; label: string }> = {
  leicht: { depth: 2, label: "Leicht" },
  mittel: { depth: 4, label: "Mittel" },
  schwer: { depth: 6, label: "Schwer" },
};
export const LEVEL_IDS: readonly LevelId[] = ["leicht", "mittel", "schwer"];
export const DEFAULT_LEVEL: LevelId = "mittel";
/** Wartezeit vor dem Zug des Computers (Web: 350 ms). */
export const AI_DELAY_MS = 350;
export const HUMAN: Player = 1;
export const COMPUTER: Player = 2;

export interface GameState {
  board: Board;
  over: boolean;
  /** Gewinnreihe oder null (bei Unentschieden und laufendem Spiel). */
  win: { player: Player; cells: Pos[] } | null;
  /** Zuletzt gesetzter Stein; `no` zählt hoch und macht jeden Wurf eindeutig (für die Fallanimation). */
  lastDrop: { row: number; col: number; no: number } | null;
  moves: number;
}

export const newGame = (): GameState => ({ board: emptyBoard(), over: false, win: null, lastDrop: null, moves: 0 });

/** Setzt einen Stein. null, wenn das Spiel vorbei oder die Spalte voll bzw. ungültig ist. */
export function playMove(state: GameState, col: number, player: Player): GameState | null {
  if (state.over) return null;
  const r = drop(state.board, col, player);
  if (!r) return null;
  const win = winner(r.board);
  const moves = state.moves + 1;
  return {
    board: r.board,
    over: !!win || isFull(r.board),
    win,
    lastDrop: { row: r.row, col, no: moves },
    moves,
  };
}

export type StatusTone = "turn" | "wait" | "win" | "lose" | "draw";
export interface Status { tone: StatusTone; title: string; text: string }

/** Statuszeile. Sieg-/Niederlage-/Unentschieden-Texte wie im Web (Overlay), die Zeilen für „dran“ sind neu. */
export function statusOf(state: GameState, thinking: boolean): Status {
  if (state.over) {
    if (!state.win) return { tone: "draw", title: "Unentschieden", text: "Das Brett ist voll." };
    if (state.win.player === HUMAN) return { tone: "win", title: "Du gewinnst!", text: "Vier in einer Reihe." };
    return { tone: "lose", title: "Der Computer gewinnt", text: "Probier es noch einmal." };
  }
  if (thinking) return { tone: "wait", title: "Der Computer überlegt …", text: "Gleich bist du wieder dran." };
  return { tone: "turn", title: "Du bist dran", text: "Tippe auf eine Spalte, um einen gelben Stein zu setzen." };
}

/** Anzahl belegter Felder in der Spalte. */
export function filledInColumn(board: Board, col: number): number {
  let n = 0;
  for (let r = 0; r < ROWS; r++) if (board[r]?.[col]) n++;
  return n;
}

/** VoiceOver-Beschriftung einer Spalte, z. B. „Spalte 3, 2 von 6 belegt“; volle Spalte wie im Web „Spalte 3, voll“. */
export function columnLabel(board: Board, col: number): string {
  const n = filledInColumn(board, col);
  return n >= ROWS ? `Spalte ${col + 1}, voll` : `Spalte ${col + 1}, ${n} von ${ROWS} belegt`;
}

/** Beschriftung eines einzelnen Felds für die Sprachausgabe (Zeile 1 = oben). */
export function cellLabel(value: number): string {
  return value === 1 ? "gelb" : value === 2 ? "rot" : "leer";
}

export const isColumnFull = (board: Board, col: number): boolean => filledInColumn(board, col) >= ROWS;

/* ---------- Siegzähler („Siege hier“) ---------- */

export const BEST_KEY = "pensum.spiele.best.v1";
export const winsKey = (level: LevelId): string => "c4wins_" + level;
export type BestRecord = Record<string, unknown>;

/** Liest das gespeicherte Objekt wie common.js (best.read): bei Fehlern oder Nicht-Objekt {}. */
export function parseBest(raw: string | null): BestRecord {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as BestRecord) : {};
  } catch { return {}; }
}

export function winsOf(best: BestRecord, level: LevelId): number {
  const v = best[winsKey(level)];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Zählt einen Sieg dazu und lässt fremde Schlüssel (Bestwerte anderer Spiele) unverändert. */
export function withWin(best: BestRecord, level: LevelId): BestRecord {
  return { ...best, [winsKey(level)]: winsOf(best, level) + 1 };
}
