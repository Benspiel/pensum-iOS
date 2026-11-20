/* Planer – antippbarer Chip (Fach-Vorschläge, Stapel-Auswahl). Optik und Verhalten wie der gemeinsame `Chip` (src/ui);
 * er kennt aber keine Radio-Rolle. Die Stapel-Auswahl ist eine Einzelauswahl und braucht sie für VoiceOver, daher dort ein eigener Pressable. */
import { StyleSheet } from "react-native";
import { AppText, Chip as SharedChip } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { PressableScale } from "../../../ui/motion";

export function Chip({ title, onPress, selected, accessibilityLabel, radio }: {
  title: string;
  onPress: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
  /** als Teil einer Einzelauswahl (Stapel) vorlesen */
  radio?: boolean;
}) {
  const { colors } = usePensumTheme();
  if (!radio) return <SharedChip label={title} selected={selected} onPress={onPress} accessibilityLabel={accessibilityLabel} />;
  return (
    <PressableScale scaleTo={0.96}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ selected: !!selected, checked: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? (pressed ? colors.inkSoft : colors.ink) : pressed ? colors.border : colors.surface },
      ]}
    >
      <AppText variant="bodySm" style={{ color: selected ? colors.onPrimary : colors.ink }}>{title}</AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 44, maxWidth: "100%", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
