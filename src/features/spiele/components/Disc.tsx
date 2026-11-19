/* Vier gewinnt – ein Feld: Loch, darin ggf. ein Stein. Der zuletzt geworfene Stein fällt kurz von oben ein
 * (Web: .is-drop, 0,35 s); Gewinnsteine tragen einen weißen Ring und pulsieren (Web: .is-win). Beides entfällt bei reduzierter Bewegung. */
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import type { Cell } from "../connect4";

export const CHIP_COLORS = { 1: "#f2b84b", 2: "#e5527a" } as const;
const DROP_MS = 350;

interface DiscProps {
  value: Cell;
  size: number;
  /** Abstand zum nächsten Feld (für die Fallhöhe). */
  gap: number;
  row: number;
  hole: string;
  falling: boolean;
  winning: boolean;
  reduceMotion: boolean;
}

export function Disc({ value, size, gap, row, hole, falling, winning, reduceMotion }: DiscProps) {
  const fall = useRef(new Animated.Value(falling && !reduceMotion ? -(row + 1) * (size + gap) : 0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!falling || reduceMotion || !value) { fall.setValue(0); return; }
    fall.setValue(-(row + 1) * (size + gap));
    const run = Animated.timing(fall, { toValue: 0, duration: DROP_MS, easing: Easing.bezier(0.5, 0, 0.9, 0.6), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [falling, reduceMotion, value, row, size, gap, fall]);

  useEffect(() => {
    if (!winning || reduceMotion) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.55, duration: 450, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [winning, reduceMotion, pulse]);

  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[round, { backgroundColor: hole }]}>
      {value ? (
        <Animated.View
          style={[
            round, styles.chip,
            { backgroundColor: CHIP_COLORS[value], opacity: pulse, transform: [{ translateY: fall }] },
            winning && styles.win,
          ]}
        >
          {/* Rot trägt zusätzlich einen inneren Ring, damit die Steine nicht nur an der Farbe zu unterscheiden sind. */}
          {value === 2 ? <View style={[styles.ring, { width: size * 0.56, height: size * 0.56, borderRadius: size * 0.28 }]} /> : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  win: { borderWidth: 3, borderColor: "#ffffff" },
  ring: { borderWidth: 3, borderColor: "rgba(255,255,255,0.75)" },
});
