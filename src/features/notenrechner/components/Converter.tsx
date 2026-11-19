/* Notenrechner – Umrechnung Note ↔ Punkte (Web: .nr-converter, wireConverter). Beim Tippen füllt sich das andere Feld. */
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
    <Card accessibilityLabel="Umrechnung">
      <AppText variant="section" accessibilityRole="header">Umrechnung.</AppText>
      <AppText variant="caption" tone="muted">Note und Punkte rechnen sich gegenseitig um.</AppText>
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
          />
        </View>
        <AppText tone="muted" accessibilityElementsHidden importantForAccessibility="no" style={styles.eq}>≙</AppText>
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
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  cell: { flex: 1 },
  eq: { paddingTop: 36, fontSize: 20 },
});
