/* Notenrechner – Zeugnisdurchschnitt (Web: .nr-summary mit #zeugnisValue und #zeugnisInfo). */
import { StyleSheet, View } from "react-native";
import { AppText } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";
import type { Summary as SummaryData } from "../ui-model";

export function Summary({ summary }: { summary: SummaryData }) {
  const { colors } = usePensumTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Zeugnisdurchschnitt ${summary.average === null ? "noch keiner" : summary.valueText}. ${summary.info}`}
      accessibilityLiveRegion="polite"
      style={[styles.card, { backgroundColor: colors.surface }]}
    >
      <AppText variant="label" tone="muted">Zeugnisdurchschnitt</AppText>
      <AppText variant="display" style={styles.big}>{summary.valueText}</AppText>
      <AppText variant="caption" tone="muted">{summary.info}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.card, borderCurve: "continuous" },
  big: { fontSize: 56, lineHeight: 64, fontVariant: ["tabular-nums"] },
});
