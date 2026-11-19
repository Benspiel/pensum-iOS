/* Notenrechner – Schuljahr wählen (Web: <select class="select" id="yearSelect"> mit „Schuljahr 2026/27“, Pill mit Pfeil rechts).
 * Auf iOS ein Blatt mit Auswahlliste. */
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Button } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";

export function YearPicker({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (year: string) => void }) {
  const { colors } = usePensumTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Schuljahr ${value}`}
        accessibilityHint="Öffnet die Auswahl des Schuljahrs"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, { backgroundColor: pressed ? colors.border : colors.field }]}
      >
        <AppText variant="body" style={styles.value}>{`Schuljahr ${value}`}</AppText>
        <View accessible={false} importantForAccessibility="no-hide-descendants">
          <SymbolView name="chevron.down" size={16} tintColor={colors.ink} fallback={<AppText variant="bodySm">▾</AppText>} />
        </View>
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: colors.canvas }]}>
          <View style={styles.head}>
            <AppText variant="h4" accessibilityRole="header">Schuljahr</AppText>
            <Button title="Fertig" variant="plain" onPress={() => setOpen(false)} />
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {options.map((y) => {
              const active = y === value;
              return (
                <Pressable
                  key={y}
                  accessibilityRole="radio"
                  accessibilityLabel={`Schuljahr ${y}`}
                  accessibilityState={{ checked: active }}
                  onPress={() => { setOpen(false); if (!active) onChange(y); }}
                  style={({ pressed }) => [styles.option, { backgroundColor: active ? (pressed ? colors.inkSoft : colors.ink) : pressed ? colors.border : colors.surface }]}
                >
                  <AppText variant="link" style={{ color: active ? colors.onPrimary : colors.ink }}>{`Schuljahr ${y}`}</AppText>
                  {active ? <AppText accessibilityElementsHidden importantForAccessibility="no" style={{ color: colors.onPrimary }}>✓</AppText> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingLeft: spacing.lg, paddingRight: 14, paddingVertical: spacing.md, borderRadius: radius.pill, borderCurve: "continuous" },
  value: { fontWeight: "600" },
  sheet: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  list: { padding: spacing.xl, gap: spacing.sm },
  option: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, borderRadius: radius.field, borderCurve: "continuous" },
});
