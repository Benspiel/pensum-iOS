/* Planer – Umschalter „Hausaufgaben / Klausuren“ (Web: Tab-Leiste). */
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";
import type { Tab } from "../model";

const ORDER: Tab[] = ["task", "exam"];

export function Tabs({ value, titles, onChange }: { value: Tab; titles: Record<Tab, string>; onChange: (tab: Tab) => void }) {
  const { colors } = usePensumTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Bereiche" style={[styles.bar, { backgroundColor: colors.surface }]}>
      {ORDER.map((id) => {
        const selected = id === value;
        return (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityLabel={titles[id]}
            accessibilityState={{ selected }}
            onPress={() => onChange(id)}
            style={[styles.tab, selected && { backgroundColor: colors.canvas }]}
          >
            <AppText variant="label" tone={selected ? "default" : "muted"} style={styles.text}>{titles[id]}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", padding: spacing.xs, borderRadius: radius.pill, gap: spacing.xs },
  tab: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderCurve: "continuous" },
  text: { textAlign: "center" },
});
