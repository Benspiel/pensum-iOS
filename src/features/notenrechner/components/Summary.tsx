/* Notenrechner – Zeugnisdurchschnitt (Web: section.card-soft.nr-summary mit .nr-big, #zeugnisValue und #zeugnisInfo). */
import { StyleSheet, useWindowDimensions } from "react-native";
import { AppText, Panel } from "../../../ui";
import { WIDE_BREAKPOINT, spacing } from "../../../theme";
import type { Summary as SummaryData } from "../ui-model";

export function Summary({ summary }: { summary: SummaryData }) {
  const { width } = useWindowDimensions();
  const size = width >= WIDE_BREAKPOINT ? 80 : 56; // Web .nr-big: 56 px, ab 640 px 80 px
  return (
    <Panel
      accessible
      accessibilityLabel={`Zeugnisdurchschnitt ${summary.average === null ? "noch keiner" : summary.valueText}. ${summary.info}`}
      accessibilityLiveRegion="polite"
      style={styles.card}
    >
      <AppText variant="fieldLabel">Zeugnisdurchschnitt</AppText>
      <AppText variant="display" style={[styles.big, { fontSize: size, lineHeight: size }]}>{summary.valueText}</AppText>
      <AppText variant="bodySm" tone="muted" style={styles.info}>{summary.info}</AppText>
    </Panel>
  );
}

const styles = StyleSheet.create({
  card: { gap: 0 },
  big: { marginTop: spacing.xs, fontVariant: ["tabular-nums"] },
  info: { marginTop: spacing.md },
});
