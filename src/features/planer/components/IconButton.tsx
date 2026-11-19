/* Planer – runder Symbol-Knopf, 44 pt (Web: .icon-btn mit Stift / Papierkorb / Schließen-Kreuz). */
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Pressable, StyleSheet } from "react-native";
import { AppText } from "../../../ui";
import { usePensumTheme } from "../../../theme";

export function IconButton({ symbol, fallback, label, hint, onPress }: {
  symbol: SymbolViewProps["name"];
  /** Zeichen, wo es keine SF Symbols gibt (Web-Vorschau, Android) */
  fallback: string;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  const { colors } = usePensumTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: pressed ? colors.surface : "transparent" }]}
    >
      <SymbolView name={symbol} size={20} tintColor={colors.muted} fallback={<AppText variant="body" tone="muted" accessible={false}>{fallback}</AppText>} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
