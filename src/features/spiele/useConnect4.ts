/* Vier gewinnt – Spielsteuerung als Hook: Zug des Menschen, verzögerter Zug des Computers, Stufenwechsel, Siegzähler.
 * Der Ablauf folgt tools/spiele/ui-vier.js (Web-Commit 770dbe4): Stufenwechsel startet neu, der Mensch beginnt immer. */
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

import type { KeyValueStore } from "../shared/ports";
import { aiMove } from "./connect4";
import { haptic } from "./haptics";
import {
  AI_DELAY_MS, BEST_KEY, COMPUTER, DEFAULT_LEVEL, HUMAN, LEVELS, newGame, parseBest, playMove, statusOf, winsOf, withWin,
  type BestRecord, type GameState, type LevelId,
} from "./model";

export function useConnect4(kv: KeyValueStore) {
  const [level, setLevelState] = useState<LevelId>(DEFAULT_LEVEL);
  const [game, setGame] = useState<GameState>(newGame);
  const [thinking, setThinking] = useState(false);
  const [best, setBest] = useState<BestRecord>({});

  const gameRef = useRef(game);
  const thinkingRef = useRef(false);
  const levelRef = useRef(level);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const kvRef = useRef(kv);
  kvRef.current = kv;

  const setState = (g: GameState, t: boolean) => {
    gameRef.current = g; thinkingRef.current = t;
    setGame(g); setThinking(t);
  };
  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  useEffect(() => {
    alive.current = true;
    kvRef.current.getItem(BEST_KEY).then((raw) => { if (alive.current) setBest(parseBest(raw)); }).catch(() => { /* ohne Zähler weiterspielen */ });
    return () => { alive.current = false; clearTimer(); };
  }, []);

  /** Spielende melden: Sprachausgabe; beim eigenen Sieg zählt der Siegzähler (frisch gelesen, fremde Schlüssel bleiben). */
  const finish = (g: GameState) => {
    const s = statusOf(g, false);
    void AccessibilityInfo.announceForAccessibility(`${s.title} ${s.text}`);
    if (g.win?.player !== HUMAN) return;
    const lv = levelRef.current;
    void (async () => {
      try {
        const next = withWin(parseBest(await kvRef.current.getItem(BEST_KEY)), lv);
        await kvRef.current.setItem(BEST_KEY, JSON.stringify(next));
        if (alive.current) setBest(next);
      } catch { /* Speicher nicht verfügbar: dann eben nicht */ }
    })();
  };

  const restart = useCallback(() => {
    clearTimer();
    setState(newGame(), false);
  }, []);

  const setLevel = useCallback((id: LevelId) => {
    if (id === levelRef.current) return;
    levelRef.current = id;
    setLevelState(id);
    restart();
  }, [restart]);

  const humanMove = useCallback((col: number) => {
    const g = gameRef.current;
    if (g.over || thinkingRef.current) return;
    const next = playMove(g, col, HUMAN);
    if (!next) return;
    haptic(next.over ? "success" : "light");
    if (next.over) { setState(next, false); finish(next); return; }
    setState(next, true);
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      const cur = gameRef.current;
      const col2 = aiMove(cur.board, COMPUTER, LEVELS[levelRef.current].depth);
      const after = col2 === null ? null : playMove(cur, col2, COMPUTER);
      if (!after) { setState(cur, false); return; }
      setState(after, false);
      if (after.over) finish(after);
    }, AI_DELAY_MS);
  }, []);

  return {
    level, setLevel, game, thinking, restart, humanMove,
    status: statusOf(game, thinking),
    wins: winsOf(best, level),
  };
}
