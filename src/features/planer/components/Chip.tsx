/* Planer – antippbarer Chip (Fach-Vorschläge, Stapel-Auswahl). */
import { Pressable, StyleSheet } from "react-native";
import { AppText } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";

export function Chip({ title, onPress, selected, accessibilityLabel, radio }: {
  title: string;
  onPress: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
  /** als Teil einer Einzelauswahl (Stapel) vorlesen */
  radio?: boolean;
}) {
  const { colors } = usePensumTheme();
  return (
    <Pressable
      accessibilityRole={radio ? "radio" : "button"}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={radio ? { selected: !!selected, checked: !!selected } : { selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: selected ? colors.ink : colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <AppText variant="label" style={{ color: selected ? colors.onPrimary : colors.ink }}>{title}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 44, maxWidth: "100%", paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
});
