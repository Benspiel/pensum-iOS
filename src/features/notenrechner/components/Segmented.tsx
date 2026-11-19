/* Notenrechner – Umschalter mit zwei oder drei festen Optionen (Web: .segmented mit aria-pressed). */
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";

export interface SegmentedOption<T> { value: T; title: string }

export function Segmented<T extends string | number>({ label, options, value, onChange }: {
  label: string; options: readonly SegmentedOption<T>[]; value: T; onChange: (value: T) => void;
}) {
  const { colors } = usePensumTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.title}
            accessibilityState={{ checked: active }}
            onPress={() => { if (!active) onChange(o.value); }}
            style={({ pressed }) => [styles.item, { backgroundColor: active ? colors.ink : "transparent", opacity: pressed ? 0.72 : 1 }]}
          >
            <AppText variant="label" style={{ color: active ? colors.onPrimary : colors.ink, textAlign: "center" }}>{o.title}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", padding: 3, gap: 3, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, justifyContent: "center", alignItems: "center" },
});
