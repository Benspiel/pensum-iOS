/* iPad-Ansicht: Hilfen für Screens mit zwei Spalten.
 *
 *   const { split } = useWideLayout();
 *   <Screen wide title="…"> <TwoColumn split={split} primary={…} secondary={…} /> </Screen>
 *
 * `split` ist wahr, wenn das Fenster (ohne Seitenränder des Geräts) mindestens 900 pt breit ist (iPad quer, große iPads hoch)
 * und die Schrift nicht größer als 1,25 ist. Sonst stehen beide Teile untereinander wie auf dem Telefon (primary zuerst).
 * Der Screen muss `wide` setzen, damit seine Inhaltsbreite auf 1120 pt wächst (sonst bleibt es bei 760). */
import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gutter, spacing } from '../theme';
import { WIDE_LAYOUT_MIN, innerWidth } from './wide';

export interface WideLayout {
  /** zwei Spalten nebeneinander */
  split: boolean;
  /** nutzbare Inhaltsbreite in pt (für Rechenwerte wie Kartenbreiten) */
  inner: number;
  /** Fensterbreite in pt */
  width: number;
}

export function useWideLayout(): WideLayout {
  const { width, fontScale } = useWindowDimensions();
  const { left, right } = useSafeAreaInsets();
  const inner = innerWidth(width, left + right, gutter(width), true);
  return { split: width - left - right >= WIDE_LAYOUT_MIN && fontScale <= 1.25, inner, width };
}

export function TwoColumn({ split, primary, secondary, primaryWeight = 1, secondaryWeight = 1, gap = spacing.xl }: {
  split: boolean;
  primary: ReactNode;
  secondary?: ReactNode;
  primaryWeight?: number;
  secondaryWeight?: number;
  gap?: number;
}) {
  if (!split || secondary == null) {
    return (
      <View style={[styles.stack, { gap }]}>
        {primary}
        {secondary}
      </View>
    );
  }
  return (
    <View style={[styles.row, { gap }]}>
      <View style={[styles.col, { flex: primaryWeight }]}>{primary}</View>
      <View style={[styles.col, { flex: secondaryWeight }]}>{secondary}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { width: '100%', minWidth: 0 },
  row: { width: '100%', flexDirection: 'row', alignItems: 'flex-start' },
  col: { minWidth: 0, gap: spacing.lg },
});
