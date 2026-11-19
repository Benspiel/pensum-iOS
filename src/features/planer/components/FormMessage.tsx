/* Planer – Fehlermeldung im Formular (Web: .form-message): Ink-Kreis mit „!“ und fetter Text; kein Rot allein als Träger.
 * `boxed` = getönte Fläche über die ganze Breite (Meldung des Dialogs), sonst nur Zeile (unter einem Feld, wie in `Field`). */
import { StyleSheet, View } from "react-native";
import { AppText } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";

export function FormMessage({ text, boxed }: { text: string; boxed?: boolean }) {
  const { colors } = usePensumTheme();
  return (
    <View style={[styles.row, boxed && styles.boxed, boxed && { backgroundColor: colors.surface }]}>
      <View accessible={false} style={[styles.mark, { backgroundColor: colors.ink }]}>
        <AppText variant="label" style={{ color: colors.onPrimary }}>!</AppText>
      </View>
      <AppText variant="bodySm" tone="danger" style={styles.text} accessibilityRole="alert">{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  boxed: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.field, borderCurve: "continuous" },
  mark: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  text: { flex: 1, fontWeight: "600" },
});
