/* Tests für Vier gewinnt und die Spiele-Helfer.
 * Web-Quelle: tests/spiele2.test.mjs (Pensum, Web-Commit 770dbe4) – die vier Web-Tests mit unveränderten Erwartungswerten
 * (nur Imports und Typen angepasst), danach neue Tests: Gewinn in allen Richtungen und an den Rändern, volles Brett,
 * Computer gewinnt/blockt, Zufall einspeisbar, Spielzustand, Texte, Siegzähler. */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, shuffle, clock, fitScale } from "../util";
import * as C4 from "../connect4";
import {
  AI_DELAY_MS, LEVELS, columnLabel, newGame, parseBest, playMove, statusOf, winsKey, winsOf, withWin,
  type GameState,
} from "../model";

test("util: Zufall mit Startwert ist reproduzierbar, Mischen verliert nichts, Uhr", () => {
  assert.equal(seeded(5)(), seeded(5)());
  assert.notEqual(seeded(5)(), seeded(6)());
  assert.deepEqual(shuffle([1, 2, 3, 4, 5], seeded(2)).sort(), [1, 2, 3, 4, 5]);
  assert.equal(clock(75), "1:15");
  assert.equal(clock(9), "0:09");
});

/* ---------- Vier gewinnt ---------- */

/** Brett nach einem Wurf; für Tests, in denen der Wurf sicher gelingt. */
const dropped = (b: C4.Board, col: number, p: C4.Player): C4.Board => {
  const r = C4.drop(b, col, p);
  assert.ok(r, `Spalte ${col} sollte frei sein`);
  return r.board;
};
const set = (b: C4.Board, r: number, c: number, p: C4.Cell) => { (b[r] as C4.Cell[])[c] = p; };
const fromRows = (rows: string[]): C4.Board => rows.map((line) => [...line].map((ch) => Number(ch) as C4.Cell));

test("Vier gewinnt: Steine fallen, Gewinn in allen Richtungen, volles Brett", () => {
  let b = C4.emptyBoard();
  b = dropped(b, 3, 1); assert.equal(b[5]?.[3], 1);
  const r = C4.drop(b, 3, 2); assert.equal(r?.row, 4);
  for (let i = 0; i < 6; i++) b = dropped(b, 0, i % 2 ? 2 : 1);
  assert.equal(C4.drop(b, 0, 1), null);
  assert.ok(!C4.validCols(b).includes(0));
  const horizontal = C4.emptyBoard(); for (let c = 1; c <= 4; c++) set(horizontal, 5, c, 1);
  assert.equal(C4.winner(horizontal)?.player, 1);
  const vertical = C4.emptyBoard(); for (let r2 = 2; r2 <= 5; r2++) set(vertical, r2, 6, 2);
  assert.equal(C4.winner(vertical)?.player, 2);
  const diag = C4.emptyBoard(); for (let k = 0; k < 4; k++) set(diag, 5 - k, k, 1);
  assert.equal(C4.winner(diag)?.cells.length, 4);
  const diag2 = C4.emptyBoard(); for (let k = 0; k < 4; k++) set(diag2, 2 + k, k, 2);
  assert.equal(C4.winner(diag2)?.player, 2);
  assert.equal(C4.winner(C4.emptyBoard()), null);
  assert.equal(C4.isFull(C4.emptyBoard()), false);
});

test("Vier gewinnt: die KI gewinnt sofort, blockt und spielt nur gültige Züge", () => {
  const win = C4.emptyBoard(); for (let c = 0; c < 3; c++) set(win, 5, c, 2);       // 2 hat drei in der Reihe
  assert.equal(C4.aiMove(win, 2, 4, seeded(1)), 3);
  const block = C4.emptyBoard(); for (let c = 0; c < 3; c++) set(block, 5, c, 1);    // 1 droht, 2 muss blocken
  assert.equal(C4.aiMove(block, 2, 4, seeded(1)), 3);
  const full = C4.emptyBoard(); for (let r = 0; r < 6; r++) set(full, r, 0, r % 2 ? 1 : 2);
  for (let s = 1; s <= 5; s++) assert.ok(C4.validCols(full).includes(C4.aiMove(full, 1, 3, seeded(s)) ?? -1));
});

test("fitScale: das Spiel passt ganz in die Fläche, nie über max, ungültige Maße ergeben 1", () => {
  assert.equal(fitScale(780, 540, 1560, 2000), 2, "Breite begrenzt nicht, Höhe 2000/540=3,7: Breite gewinnt");
  assert.equal(fitScale(780, 540, 2000, 540), 1, "Höhe begrenzt");
  assert.equal(fitScale(600, 260, 300, 800), 0.5, "verkleinert bei schmaler Fläche");
  assert.equal(fitScale(600, 260, 6000, 6000, 3), 3, "max begrenzt die Vergrößerung");
  assert.equal(fitScale(0, 260, 100, 100), 1);
  assert.equal(fitScale(600, 260, 0, 100), 1);
});

/* ---------- Neu: Regeln im Detail ---------- */

test("Brett: 6 × 7, leer, Würfe stapeln sich von unten", () => {
  const b = C4.emptyBoard();
  assert.equal(b.length, C4.ROWS);
  assert.ok(b.every((row) => row.length === C4.COLS && row.every((v) => v === 0)));
  assert.equal(C4.validCols(b).length, 7);
  let x = b;
  for (let i = 0; i < 6; i++) { const r = C4.drop(x, 2, 1); assert.equal(r?.row, 5 - i); x = (r as { board: C4.Board }).board; }
  assert.equal(C4.drop(x, 2, 1), null);
  assert.equal(C4.drop(b, -1, 1), null, "ungültige Spalte");
  assert.equal(C4.drop(b, 7, 1), null, "ungültige Spalte");
  assert.equal(b[5]?.[2], 0, "das ursprüngliche Brett bleibt unverändert");
});

test("Gewinn: waagerecht am linken und rechten Rand, jede Zeile", () => {
  for (const startCol of [0, 3]) for (let r = 0; r < 6; r++) {
    const b = C4.emptyBoard(); for (let k = 0; k < 4; k++) set(b, r, startCol + k, 1);
    const w = C4.winner(b);
    assert.equal(w?.player, 1);
    assert.deepEqual(w?.cells, [0, 1, 2, 3].map((k) => [r, startCol + k]));
  }
});

test("Gewinn: senkrecht in jeder Spalte, oben und unten", () => {
  for (let c = 0; c < 7; c++) for (const top of [0, 2]) {
    const b = C4.emptyBoard(); for (let k = 0; k < 4; k++) set(b, top + k, c, 2);
    assert.equal(C4.winner(b)?.player, 2);
  }
});

test("Gewinn: beide Diagonalen, auch in den Ecken", () => {
  const up = C4.emptyBoard(); for (let k = 0; k < 4; k++) set(up, 5 - k, 3 + k, 1); // unten links nach oben rechts, ganz rechts
  const w = C4.winner(up);
  assert.equal(w?.player, 1);
  assert.deepEqual(w?.cells, [[2, 6], [3, 5], [4, 4], [5, 3]], "Fundstelle ist die oberste Zelle, dann abwärts");
  const down = C4.emptyBoard(); for (let k = 0; k < 4; k++) set(down, k, k, 2);
  assert.equal(C4.winner(down)?.player, 2);
  const down2 = C4.emptyBoard(); for (let k = 0; k < 4; k++) set(down2, 2 + k, 3 + k, 1);
  assert.equal(C4.winner(down2)?.player, 1);
});

test("Kein Gewinn: nur drei in Reihe, gemischte Farben, Reihe über die Kante", () => {
  const three = C4.emptyBoard(); for (let c = 0; c < 3; c++) set(three, 5, c, 1);
  assert.equal(C4.winner(three), null);
  const mixed = C4.emptyBoard(); for (let c = 0; c < 4; c++) set(mixed, 5, c, c === 2 ? 2 : 1);
  assert.equal(C4.winner(mixed), null);
  const wrap = C4.emptyBoard(); for (const c of [5, 6]) set(wrap, 4, c, 1); for (const c of [0, 1]) set(wrap, 5, c, 1);
  assert.equal(C4.winner(wrap), null, "Zeilenende und nächster Zeilenanfang zählen nicht zusammen");
});

/** Volles Brett ohne Vierergruppe in irgendeiner Richtung. */
const DRAW = ["1122112", "1122112", "2211221", "1122112", "2211221", "2211221"];

test("Volles Brett ohne Sieger: isFull, keine gültigen Spalten, kein Sieger, kein Zug", () => {
  const b = fromRows(DRAW);
  assert.equal(C4.winner(b), null);
  assert.equal(C4.isFull(b), true);
  assert.deepEqual(C4.validCols(b), []);
  assert.equal(C4.aiMove(b, 1, 2, seeded(1)), null, "auf vollem Brett gibt es keinen Zug");
});

test("Computer: gewinnt senkrecht und diagonal sofort", () => {
  const vertical = C4.emptyBoard(); for (let r = 3; r < 6; r++) set(vertical, r, 4, 2);
  assert.equal(C4.aiMove(vertical, 2, 4, seeded(3)), 4);
  // Diagonale unten links nach oben rechts: (5,0),(4,1),(3,2) gehören 2, (2,3) fehlt; Spalte 3 ist bis Zeile 3 gefüllt
  const diag = C4.emptyBoard();
  set(diag, 5, 0, 2); set(diag, 4, 1, 2); set(diag, 5, 1, 1); set(diag, 3, 2, 2); set(diag, 5, 2, 1); set(diag, 4, 2, 1);
  set(diag, 5, 3, 1); set(diag, 4, 3, 1); set(diag, 3, 3, 1);
  assert.equal(C4.winner(diag), null);
  assert.equal(C4.aiMove(diag, 2, 4, seeded(3)), 3);
});

test("Computer: blockt senkrecht und waagerecht an den Rändern, auch auf Stufe leicht", () => {
  const vertical = C4.emptyBoard(); for (let r = 3; r < 6; r++) set(vertical, r, 6, 1);
  for (const depth of [2, 4]) assert.equal(C4.aiMove(vertical, 2, depth, seeded(1)), 6);
  const edge = C4.emptyBoard(); for (let c = 1; c <= 3; c++) set(edge, 5, c, 1);       // 1 droht links (0) und rechts (4)
  set(edge, 5, 4, 2);                                                                    // rechts ist schon zu
  assert.equal(C4.aiMove(edge, 2, 2, seeded(1)), 0);
});

test("Computer: Gewinn geht vor Blocken", () => {
  const b = C4.emptyBoard();
  for (let c = 0; c < 3; c++) set(b, 5, c, 2);       // 2 gewinnt mit Spalte 3
  for (let c = 4; c < 7; c++) set(b, 5, c, 1);       // 1 hätte mit Spalte 3 auch gewonnen
  assert.equal(C4.aiMove(b, 2, 4, seeded(1)), 3);
});

test("Computer: Zufall ist einspeisbar, wirkt nur zwischen gleich guten Zügen und ist reproduzierbar", () => {
  const b = C4.emptyBoard();
  const lo = C4.aiMove(b, 2, 2, () => 0), hi = C4.aiMove(b, 2, 2, () => 0.999999);
  assert.ok(lo !== null && hi !== null && lo >= 0 && hi <= 6);
  assert.equal(C4.aiMove(b, 2, 2, seeded(9)), C4.aiMove(b, 2, 2, seeded(9)), "gleicher Startwert, gleicher Zug");
  // eindeutig bester Zug: der Zufall darf nichts ändern
  const win = C4.emptyBoard(); for (let c = 0; c < 3; c++) set(win, 5, c, 2);
  for (const v of [0, 0.5, 0.999999]) assert.equal(C4.aiMove(win, 2, 4, () => v), 3);
});

test("Computer: alle drei Stufen spielen gültig (Tiefe 6 bleibt benutzbar schnell)", () => {
  let b = C4.emptyBoard();
  for (const [col, p] of [[3, 1], [3, 2], [2, 1], [4, 2], [2, 1], [2, 2]] as [number, C4.Player][]) b = dropped(b, col, p);
  for (const level of Object.values(LEVELS)) {
    const t = Date.now();
    const col = C4.aiMove(b, 1, level.depth, seeded(4));
    assert.ok(col !== null && C4.validCols(b).includes(col));
    assert.ok(Date.now() - t < 20000);
  }
});

/* ---------- Spielzustand, Texte, Siegzähler ---------- */

test("playMove: setzt Steine, meldet Sieg, sperrt danach", () => {
  let g: GameState = newGame();
  assert.equal(g.over, false);
  for (let i = 0; i < 3; i++) {
    g = playMove(g, 0, 1) as GameState;
    g = playMove(g, 1, 2) as GameState;
  }
  assert.equal(g.over, false);
  const end = playMove(g, 0, 1) as GameState;
  assert.equal(end.over, true);
  assert.equal(end.win?.player, 1);
  assert.deepEqual(end.lastDrop, { row: 2, col: 0, no: 7 });
  assert.equal(playMove(end, 3, 2), null, "nach dem Ende keine Züge mehr");
  assert.equal(g.board[2]?.[0], 0, "alter Zustand bleibt unverändert");
});

test("playMove: volle Spalte wird abgelehnt, letzter Stein auf vollem Brett endet unentschieden", () => {
  let g: GameState = newGame();
  for (let i = 0; i < 6; i++) g = playMove(g, 0, i % 2 ? 2 : 1) as GameState;
  assert.equal(playMove(g, 0, 1), null);
  assert.equal(columnLabel(g.board, 0), "Spalte 1, voll");
  // Unentschieden-Muster mit einer Lücke oben links; der letzte Stein füllt das Brett
  const rows = DRAW.map((line, r) => (r === 0 ? "0" + line.slice(1) : line));
  const almost: GameState = { ...newGame(), board: fromRows(rows), moves: 41 };
  const end = playMove(almost, 0, 1) as GameState;
  assert.equal(end.over, true);
  assert.equal(end.win, null);
  assert.deepEqual(statusOf(end, false).tone, "draw");
});

test("Texte: Status und VoiceOver-Beschriftung der Spalten", () => {
  const g = newGame();
  assert.equal(statusOf(g, false).tone, "turn");
  assert.equal(statusOf(g, true).tone, "wait");
  assert.deepEqual(statusOf({ ...g, over: true, win: null }, false), { tone: "draw", title: "Unentschieden", text: "Das Brett ist voll." });
  assert.equal(statusOf({ ...g, over: true, win: { player: 1, cells: [] } }, false).title, "Du gewinnst!");
  assert.equal(statusOf({ ...g, over: true, win: { player: 2, cells: [] } }, false).title, "Der Computer gewinnt");
  assert.equal(columnLabel(g.board, 2), "Spalte 3, 0 von 6 belegt");
  const two = playMove(playMove(g, 2, 1) as GameState, 2, 2) as GameState;
  assert.equal(columnLabel(two.board, 2), "Spalte 3, 2 von 6 belegt");
  assert.equal(AI_DELAY_MS, 350);
});

test("Siegzähler: Schlüssel und Format wie im Web, fremde Werte bleiben erhalten, kaputte Daten ergeben 0", () => {
  assert.equal(winsKey("mittel"), "c4wins_mittel");
  assert.deepEqual(parseBest(null), {});
  assert.deepEqual(parseBest("kein json"), {});
  assert.deepEqual(parseBest("[1,2]"), {});
  assert.deepEqual(parseBest("42"), {});
  const stored = parseBest(JSON.stringify({ dino: 120, c4wins_leicht: 2 }));
  assert.equal(winsOf(stored, "leicht"), 2);
  assert.equal(winsOf(stored, "schwer"), 0);
  const next = withWin(stored, "leicht");
  assert.equal(winsOf(next, "leicht"), 3);
  assert.equal(next.dino, 120);
  assert.equal(winsOf({ c4wins_mittel: "x" }, "mittel"), 0);
  assert.equal(winsOf(withWin({}, "schwer"), "schwer"), 1);
});
