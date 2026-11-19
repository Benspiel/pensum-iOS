/* Notenrechner – eine Zeile je Fach: Name, Zeugnisnote, Löschen (Web: .nr-subject, drei Spalten mit Haarlinie dazwischen).
 * Die Felder halten ihren Text selbst; die Liste vergibt einen neuen `key`, wenn Ansicht oder Daten neu geladen wurden,
 * dann gilt `initialValue` wieder. Die Zeile steht in einer Karte (Innenabstand 8/16), die der Bildschirm liefert. */
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "../../../ui";
import { radius, resolveTextStyle, spacing, usePensumTheme } from "../../../theme";
import type { Subject } from "../core";

export function SubjectRow({ subject, initialValue, unit, error, divider, onRename, onGradeText, onRemove, onEditing }: {
  subject: Subject;
  initialValue: string;
  /** "Note" oder "Punkte" */
  unit: string;
  error?: string;
  /** Haarlinie über der Zeile (alle außer der ersten) */
  divider?: boolean;
  onRename: (text: string) => void;
  onGradeText: (text: string) => void;
  onRemove: () => void;
  onEditing: (editing: boolean) => void;
}) {
  const { colors, scheme, customFonts } = usePensumTheme();
  const [name, setName] = useState(subject.name);
  const [value, setValue] = useState(initialValue);
  const [nameFocus, setNameFocus] = useState(false);
  const [gradeFocus, setGradeFocus] = useState(false);
  const strong = resolveTextStyle("h4", { customFonts }); // 18 px im Web: Inter 650 → hier der Überschriftenschnitt
  const grade = resolveTextStyle("link", { customFonts }); // Web: 600
  const ring = { borderColor: colors.ink };

  return (
    <View style={[styles.item, divider && { borderTopWidth: 1, borderTopColor: colors.hairlineSoft }]}>
      <View style={styles.row}>
        <View style={styles.name}>
          <TextInput
            accessibilityLabel={`Fachname ${subject.name}`}
            value={name}
            onChangeText={(t) => { setName(t); onRename(t); }}
            onFocus={() => { setNameFocus(true); onEditing(true); }}
            onBlur={() => { setNameFocus(false); onEditing(false); if (!name.trim()) setName(subject.name); } /* leerer Name: letzten gültigen zurückholen */}
            maxLength={120}
            autoComplete="off"
            returnKeyType="done"
            selectionColor={colors.accent}
            keyboardAppearance={scheme}
            style={[
              styles.nameInput,
              { color: colors.ink, fontFamily: strong.fontFamily, fontWeight: strong.fontWeight, backgroundColor: nameFocus ? colors.field : "transparent" },
            ]}
          />
          {nameFocus ? <View pointerEvents="none" style={[styles.ring, styles.nameRing, ring]} /> : null}
        </View>
        <View style={styles.gradeWrap}>
          <TextInput
            accessibilityLabel={`Zeugnisnote ${subject.name} (${unit})`}
            accessibilityHint={error}
            value={value}
            onChangeText={(t) => { setValue(t); onGradeText(t); }}
            onFocus={() => { setGradeFocus(true); onEditing(true); }}
            onBlur={() => { setGradeFocus(false); onEditing(false); }}
            placeholder={unit}
            placeholderTextColor={colors.muted}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="done"
            selectionColor={colors.accent}
            keyboardAppearance={scheme}
            style={[
              styles.gradeInput,
              { color: colors.ink, backgroundColor: colors.field, fontFamily: grade.fontFamily, fontWeight: grade.fontWeight },
            ]}
          />
          {gradeFocus || error ? <View pointerEvents="none" style={[styles.ring, styles.gradeRing, ring, { borderStyle: error ? "dashed" : "solid" }]} /> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Fach ${subject.name} löschen`}
          accessibilityHint="Destruktive Aktion"
          onPress={onRemove}
          style={({ pressed }) => [styles.remove, { backgroundColor: pressed ? colors.surface : "transparent" }]}
        >
          <SymbolView name="trash" size={20} tintColor={colors.muted} fallback={<AppText variant="bodySm" tone="muted">✕</AppText>} />
        </Pressable>
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <View accessible={false} style={[styles.errorMark, { backgroundColor: colors.ink }]}>
            <AppText variant="label" style={{ color: colors.onPrimary }}>!</AppText>
          </View>
          <AppText variant="bodySm" tone="danger" style={styles.errorText} accessibilityRole="alert">{error}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { paddingVertical: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { flex: 1, minWidth: 0, marginLeft: -spacing.sm },
  nameInput: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.field, borderCurve: "continuous", fontSize: 18 },
  gradeWrap: { width: 96 },
  gradeInput: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.field, borderCurve: "continuous", fontSize: 18, textAlign: "center", fontVariant: ["tabular-nums"] },
  ring: { ...StyleSheet.absoluteFill, borderWidth: 2, borderCurve: "continuous" },
  nameRing: { borderRadius: radius.field },
  gradeRing: { borderRadius: radius.field },
  remove: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.xs },
  errorMark: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  errorText: { flex: 1, fontWeight: "600" },
});
