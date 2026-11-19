/* Vier gewinnt – das Brett: sieben antippbare Spalten à sechs Felder (Web: .c4-board / .c4-col, Maße 8 pt Rand, 6 pt Abstand).
 * Je Spalte ein Button mit VoiceOver-Text „Spalte 3, 2 von 6 belegt“. Die Größe folgt der verfügbaren Breite. */
import { useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { usePensumTheme } from "../../../theme";
import { COLS, ROWS, type Board as BoardData } from "../connect4";
import { columnLabel, isColumnFull, type GameState } from "../model";
import { Disc } from "./Disc";

const PAD = 8, GAP = 6;
const BOARD_BLUE = "#0b5fc7";
const MAX_WIDTH = 520;

interface BoardProps {
  game: GameState;
  /** Eingaben sperren (Computer am Zug, Spiel vorbei). */
  locked: boolean;
  reduceMotion: boolean;
  onColumn: (col: number) => void;
}

export function Board({ game, locked, reduceMotion, onColumn }: BoardProps) {
  const { colors } = usePensumTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.min(e.nativeEvent.layout.width, MAX_WIDTH));
  const size = width > 0 ? Math.max(0, Math.floor((width - 2 * PAD - (COLS - 1) * GAP) / COLS)) : 0;
  const winCells = new Set((game.win ? game.win.cells : []).map(([r, c]) => `${r},${c}`));
  const board: BoardData = game.board;

  return (
    <View onLayout={onLayout} style={styles.host}>
      {size > 0 ? (
        <View style={[styles.board, { backgroundColor: BOARD_BLUE, padding: PAD, gap: GAP }]}>
          {Array.from({ length: COLS }, (_, c) => {
            const full = isColumnFull(board, c);
            const disabled = locked || full;
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={columnLabel(board, c)}
                accessibilityHint={disabled ? undefined : "Setzt einen Stein in diese Spalte."}
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={() => onColumn(c)}
                style={({ pressed }) => [styles.col, { gap: GAP, borderRadius: size / 2, backgroundColor: pressed ? "rgba(255,255,255,0.24)" : "transparent" }]}
              >
                {Array.from({ length: ROWS }, (_, r) => {
                  const last = game.lastDrop;
                  const falling = !!last && last.row === r && last.col === c;
                  return (
                    <Disc
                      key={r + ":" + (falling ? last?.no ?? 0 : 0)}
                      value={board[r]?.[c] ?? 0}
                      size={size}
                      gap={GAP}
                      row={r}
                      hole={colors.canvas}
                      falling={falling}
                      winning={winCells.has(`${r},${c}`)}
                      reduceMotion={reduceMotion}
                    />
                  );
                })}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" },
  board: { flexDirection: "row", borderRadius: 16, borderCurve: "continuous", alignSelf: "center" },
  col: { overflow: "hidden" },
});
