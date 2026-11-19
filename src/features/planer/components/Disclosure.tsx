/* Planer – einklappbarer Bereich („Erledigt (n)“, „Vergangene Klausuren (n)“; Web: details.pl-details, getönt, „+“ / „–“ rechts). */
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Panel } from "../../../ui";
import { spacing } from "../../../theme";

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    // Wie im Web liegen die Zeilen darin als weiße Karten auf der Tönung; Schaltflächen „soft“ werden dort weiß (TintContext des Panels).
    <Panel style={styles.box}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.head}
      >
        <AppText variant="link" style={styles.title}>{title}</AppText>
        <AppText variant="h4" accessible={false}>{open ? "–" : "+"}</AppText>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  box: { padding: 0, gap: 0 },
  head: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  title: { flexShrink: 1 },
  body: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
