/* Planer – Leerzustand (Web: .pl-empty): getönte Fläche, mittig, Überschrift h4, Text höchstens 40 Zeichen breit, optional ein Knopf. */
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { AppText, Panel } from "../../../ui";
import { spacing } from "../../../theme";

export function Empty({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <Panel style={styles.box}>
      <AppText variant="h4" accessibilityRole="header" style={styles.center}>{title}</AppText>
      <AppText tone="muted" style={[styles.center, styles.text]}>{message}</AppText>
      {action}
    </Panel>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
  center: { textAlign: "center" },
  text: { maxWidth: 360 },
});
