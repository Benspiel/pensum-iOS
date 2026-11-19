/* Planer – einklappbarer Bereich („Erledigt (n)“, „Vergangene Klausuren (n)“; Web: <details>). */
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = usePensumTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.box, { backgroundColor: colors.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.head}
      >
        <AppText variant="label" style={styles.title}>{title}</AppText>
        <AppText variant="section" accessible={false}>{open ? "–" : "+"}</AppText>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.card, borderCurve: "continuous" },
  head: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  title: { flexShrink: 1 },
  body: { gap: spacing.sm, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
});
