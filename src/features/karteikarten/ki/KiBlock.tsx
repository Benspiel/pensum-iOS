/* Karteikarten mit KI – Block über den Tabs des Stapels (Web: kiBlock in karteikarten.js, Web-Commit 770dbe4):
 * Laden, Fehler, Vorschlagsliste mit Häkchen, „<n> Karten hinzufügen“ und „Verwerfen“. */
import { Pressable, StyleSheet, View } from "react-native";
import { spacing, usePensumTheme } from "../../../theme";
import { AppText, Button, Card, LoadingState } from "../../../ui";
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
  if (state.phase === "busy") return <LoadingState title="Die KI liest und schreibt deine Karten …" />;
  if (state.phase === "error") {
    return (
      <Card>
        <AppText tone="danger" accessibilityRole="alert">{state.error}</AppText>
        <Button title="Schließen" variant="secondary" onPress={onDiscard} />
      </Card>
    );
  }
  const chosen = chosenCount(state);
  const n = state.suggestions.length;
  return (
    <View style={styles.page}>
      <AppText variant="section" accessibilityRole="header">{`Vorschlag der KI (${n} ${n === 1 ? "Karte" : "Karten"})`}</AppText>
      <View style={styles.list} accessibilityLabel="Vorschlag der KI">
        {state.suggestions.map((s, i) => (
          <Pressable
            key={`${i}-${s.front}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: s.on }}
            accessibilityLabel={`${s.front}, ${s.back}`}
            onPress={() => onToggle(i)}
            style={[styles.row, { borderColor: colors.border, backgroundColor: s.on ? colors.accentSurface : colors.canvas }]}
          >
            <AppText accessible={false} style={styles.check}>{s.on ? "☑" : "☐"}</AppText>
            <View style={styles.texts}>
              <AppText variant="caption" tone="muted">Vorderseite</AppText>
              <AppText>{s.front}</AppText>
              <AppText variant="caption" tone="muted">Rückseite</AppText>
              <AppText>{s.back}</AppText>
            </View>
          </Pressable>
        ))}
      </View>
      <Button title={addButtonLabel(chosen)} onPress={onAdd} disabled={!chosen} />
      <Button title="Verwerfen" variant="secondary" onPress={onDiscard} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.md },
  list: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, minHeight: 56 },
  check: { fontSize: 22 },
  texts: { flex: 1, gap: 2 },
});
