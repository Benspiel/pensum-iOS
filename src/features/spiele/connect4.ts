/* Vier gewinnt – Regeln und KI (Minimax mit Alpha-Beta). Brett: 6 Zeilen × 7 Spalten, 0 leer, 1 und 2 Spieler.
 * Web-Quelle: tools/spiele/connect4.js (Pensum, Web-Commit 770dbe4), Logik 1:1 übernommen und für TypeScript strict
 * (noUncheckedIndexedAccess) typisiert. Der Zufall ist über `rng` einspeisbar (Standard: Math.random). */

export type Player = 1 | 2;
export type Cell = 0 | Player;
export type Board = Cell[][];
/** Position im Brett als [Zeile, Spalte]; Zeile 0 ist oben. */
export type Pos = readonly [row: number, col: number];

export const COLS = 7, ROWS = 6;
export const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));

/** Feldwert mit Randprüfung; außerhalb des Bretts 0. */
const at = (b: Board, r: number, c: number): Cell => b[r]?.[c] ?? 0;

export const otherPlayer = (p: Player): Player => (p === 1 ? 2 : 1);

/** Wirft einen Stein in die Spalte. Liefert { board, row } oder null, wenn die Spalte voll ist. */
export function drop(b: Board, col: number, player: Player): { board: Board; row: number } | null {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!at(b, r, col)) {
      const nb = b.map((x) => x.slice());
      const line = nb[r];
      if (!line || col < 0 || col >= COLS) return null;
      line[col] = player;
      return { board: nb, row: r };
    }
  }
  return null;
}

export const validCols = (b: Board): number[] => [...Array(COLS).keys()].filter((c) => !at(b, 0, c));
export const isFull = (b: Board): boolean => validCols(b).length === 0;

const DIRECTIONS: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** { player, cells } der Vierergruppe oder null. */
export function winner(b: Board): { player: Player; cells: Pos[] } | null {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = at(b, r, c);
    if (!p) continue;
    for (const [dr, dc] of DIRECTIONS) {
      const cells: Pos[] = [[r, c]];
      for (let k = 1; k < 4; k++) {
        const rr = r + dr * k, cc = c + dc * k;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || at(b, rr, cc) !== p) break;
        cells.push([rr, cc]);
      }
      if (cells.length === 4) return { player: p, cells };
    }
  }
  return null;
}

function score(b: Board, me: Player): number {
  const opp = otherPlayer(me);
  let s = 0;
  for (let r = 0; r < ROWS; r++) {
    const mid = at(b, r, 3);
    if (mid === me) s += 3; else if (mid === opp) s -= 3;
  }
  const win = (cells: Pos[]): number => {
    let m = 0, o = 0;
    for (const [r, c] of cells) { const v = at(b, r, c); if (v === me) m++; else if (v === opp) o++; }
    if (m && o) return 0;
    if (m === 3) return 6; if (m === 2) return 2; if (o === 3) return -7; if (o === 2) return -2;
    return 0;
  };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    for (const [dr, dc] of DIRECTIONS) {
      const cells: Pos[] = [];
      for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) cells.push([rr, cc]); }
      if (cells.length === 4) s += win(cells);
    }
  }
  return s;
}

const ORDER = [3, 2, 4, 1, 5, 0, 6];

/** Stein in eine Spalte, die laut validCols frei ist (nur intern in der Suche). */
const dropFree = (b: Board, col: number, player: Player): Board => (drop(b, col, player) as { board: Board }).board;

function search(b: Board, depth: number, alpha: number, beta: number, turn: Player, me: Player): number {
  const w = winner(b);
  if (w) return w.player === me ? 100000 + depth : -100000 - depth;
  const cols = validCols(b);
  if (!cols.length) return 0;
  if (depth === 0) return score(b, me);
  const order = ORDER.filter((c) => cols.includes(c));
  if (turn === me) {
    let best = -Infinity;
    for (const c of order) { best = Math.max(best, search(dropFree(b, c, turn), depth - 1, alpha, beta, otherPlayer(turn), me)); alpha = Math.max(alpha, best); if (alpha >= beta) break; }
    return best;
  }
  let best = Infinity;
  for (const c of order) { best = Math.min(best, search(dropFree(b, c, turn), depth - 1, alpha, beta, otherPlayer(turn), me)); beta = Math.min(beta, best); if (alpha >= beta) break; }
  return best;
}

/** Bester Zug für player; bei gleich guten Zügen entscheidet der Zufall. Liefert null, wenn das Brett voll ist
 *  (im Web ergäbe das undefined). */
export function aiMove(b: Board, player: Player, depth = 4, rng: () => number = Math.random): number | null {
  const opp = otherPlayer(player);
  let bestScore = -Infinity, best: number[] = [];
  for (const c of validCols(b)) {
    const next = dropFree(b, c, player);
    const sc = search(next, depth - 1, -Infinity, Infinity, opp, player);
    if (sc > bestScore) { bestScore = sc; best = [c]; } else if (sc === bestScore) best.push(c);
  }
  return best[Math.floor(rng() * best.length)] ?? null;
}
