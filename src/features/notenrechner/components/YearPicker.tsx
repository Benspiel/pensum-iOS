/* Notenrechner – Schuljahr wählen (Web: <select id="yearSelect"> mit „Schuljahr 2026/27“). Auf iOS ein Blatt mit Auswahlliste. */
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
        style={({ pressed }) => [styles.button, { backgroundColor: colors.field, borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
      >
        <AppText>{`Schuljahr ${value}`}</AppText>
        <AppText tone="muted" accessibilityElementsHidden importantForAccessibility="no">▾</AppText>
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: colors.canvas }]}>
          <View style={styles.head}>
            <AppText variant="section" accessibilityRole="header">Schuljahr</AppText>
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
                  style={({ pressed }) => [styles.option, { backgroundColor: active ? colors.accentSurface : colors.surface, opacity: pressed ? 0.72 : 1 }]}
                >
                  <AppText style={{ fontWeight: active ? "600" : "400" }}>{`Schuljahr ${y}`}</AppText>
                  {active ? <AppText tone="accent" accessibilityElementsHidden importantForAccessibility="no">✓</AppText> : null}
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
  button: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.field, borderCurve: "continuous", borderWidth: StyleSheet.hairlineWidth },
  sheet: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  list: { padding: spacing.lg, gap: spacing.sm },
  option: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, borderRadius: radius.field, borderCurve: "continuous" },
});
