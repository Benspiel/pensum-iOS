/* Karteikarten mit KI – Block über den Tabs des Stapels (Web: kiBlock in karteikarten.js, Web-Commit 770dbe4):
 * Laden, Fehler, Vorschlagsliste mit Häkchen, „<n> Karten hinzufügen“ und „Verwerfen“.
 * Optik: .kk-add/.kk-ki (getönte Fläche), .kk-row (Haarlinie, Radius 16), Häkchenfeld in Ink. */
import { StyleSheet, View } from "react-native";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { AppText, Button, Panel, PensumLoadingMark } from "../../../ui";
import { PressableScale } from "../../../ui/motion";
import { FormMessage } from "../components/common";
import { addButtonLabel, chosenCount } from "./cards";
import type { KiState } from "./cards";

interface Props {
  state: NonNullable<KiState>;
  onToggle: (index: number) => void;
  onAdd: () => void;
  onDiscard: () => void;
}

export function KiBlock({ state, onToggle, onAdd, onDiscard }: Props) {
  const { colors } = usePensumTheme();
  if (state.phase === "busy") {
    const title = "Die KI liest und schreibt deine Karten …";
    return (
      <Panel accessible accessibilityRole="progressbar" accessibilityLabel={title} accessibilityState={{ busy: true }} style={styles.busy}>
        <PensumLoadingMark />
        <AppText variant="bodySm" style={styles.busyText}>{title}</AppText>
      </Panel>
    );
  }
  if (state.phase === "error") {
    return (
      <Panel style={styles.panel}>
        <FormMessage text={state.error} />
        <Button title="Schließen" variant="secondary" onPress={onDiscard} />
      </Panel>
    );
  }
  const chosen = chosenCount(state);
  const n = state.suggestions.length;
  return (
    <View style={styles.page}>
      <AppText variant="bodyLg" accessibilityRole="header">{`Vorschlag der KI (${n} ${n === 1 ? "Karte" : "Karten"})`}</AppText>
      <View style={styles.list} accessibilityLabel="Vorschlag der KI">
        {state.suggestions.map((s, i) => (
          <PressableScale
            key={`${i}-${s.front}`}
            scaleTo={0.99}
            haptic="select"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: s.on }}
            accessibilityLabel={`${s.front}, ${s.back}`}
            onPress={() => onToggle(i)}
            style={[styles.row, { borderColor: colors.hairlineSoft, backgroundColor: s.on ? colors.surface : colors.canvas }]}
          >
            <View accessible={false} style={[styles.check, { borderColor: colors.ink, backgroundColor: s.on ? colors.ink : "transparent" }]}>
              {s.on ? <AppText variant="label" style={{ color: colors.onPrimary }}>✓</AppText> : null}
            </View>
            <View style={styles.texts}>
              <AppText variant="label" tone="muted" style={styles.caps}>Vorderseite</AppText>
              <AppText>{s.front}</AppText>
              <AppText variant="label" tone="muted" style={[styles.caps, styles.back]}>Rückseite</AppText>
              <AppText>{s.back}</AppText>
            </View>
          </PressableScale>
        ))}
      </View>
      <Button title={addButtonLabel(chosen)} onPress={onAdd} disabled={!chosen} />
      <Button title="Verwerfen" variant="secondary" haptic="warn" onPress={onDiscard} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.md },
  panel: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.field },
  busy: { padding: spacing.lg, borderRadius: radius.field, flexDirection: "row", alignItems: "center", gap: spacing.md },
  busyText: { flex: 1 },
  list: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderRadius: radius.field, borderCurve: "continuous", minHeight: 56 },
  check: { width: 24, height: 24, borderRadius: 8, borderCurve: "continuous", borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 2 },
  texts: { flex: 1, gap: 2 },
  caps: { fontSize: 11, lineHeight: 15, letterSpacing: 0.44, textTransform: "uppercase" },
  back: { marginTop: spacing.xs },
});
