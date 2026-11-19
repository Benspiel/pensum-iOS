/* Notenrechner – Umrechnung Note ↔ Punkte (Web: section.card.nr-converter, wireConverter). Beim Tippen füllt sich das andere Feld. */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, Card, Field } from "../../../ui";
import { spacing } from "../../../theme";
import type { System } from "../core";
import { convertInput, interpretGradeInput } from "../ui-model";

export function Converter() {
  const [note, setNote] = useState("");
  const [points, setPoints] = useState("");
  const [bad, setBad] = useState<System | null>(null);

  const change = (from: System, text: string) => {
    const r = convertInput(text, from);
    if (from === "note") { setNote(text); setPoints(r.other); } else { setPoints(text); setNote(r.other); }
    setBad(r.invalid ? from : null);
  };
  const errorOf = (system: System, text: string) => {
    if (bad !== system) return undefined;
    const r = interpretGradeInput(text, system);
    return r.kind === "error" ? r.error : undefined;
  };

  return (
    <Card accessibilityLabel="Umrechnung" style={styles.card}>
      <AppText variant="h4" accessibilityRole="header">Umrechnung.</AppText>
      <AppText variant="bodySm" tone="muted">Note und Punkte rechnen sich gegenseitig um.</AppText>
      <View style={styles.row}>
        <View style={styles.cell}>
          <Field
            label="Note (1–6)"
            value={note}
            onChangeText={(t) => change("note", t)}
            error={errorOf("note", note)}
            placeholder="2,3"
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            autoComplete="off"
            style={styles.tabular}
          />
        </View>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.eq}>
          <AppText variant="link">≙</AppText>
        </View>
        <View style={styles.cell}>
          <Field
            label="Punkte (0–15)"
            value={points}
            onChangeText={(t) => change("punkte", t)}
            error={errorOf("punkte", points)}
            placeholder="10"
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            autoComplete="off"
            style={styles.tabular}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginTop: spacing.sm },
  cell: { flex: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
  /** Höhe des Labels (20) + Abstand (8), dann auf Feldhöhe (48) zentriert wie Web `.nr-converter-eq` */
  eq: { marginTop: 28, height: 48, justifyContent: "center" },
});
