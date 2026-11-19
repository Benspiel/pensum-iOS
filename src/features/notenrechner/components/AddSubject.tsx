/* Notenrechner – neues Fach anlegen und Vorschlags-Chips (Web: form.nr-add-subject, #suggestions mit .chip). */
import { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { AppText, Button, Chip, Field, Panel } from "../../../ui";
import { spacing, usePensumTheme } from "../../../theme";

export function AddSubject({ onAdd }: { onAdd: (name: string) => string | null }) {
  const { width } = useWindowDimensions();
  const wide = width >= 480; // Web: ab 480 px Feld und Knopf nebeneinander, Innenabstand 24
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const submit = () => {
    const err = onAdd(name);
    if (err) { setError(err); return; }
    setError(undefined);
    setName("");
  };
  return (
    <Panel style={[styles.form, wide && styles.formWide]}>
      <View style={wide ? styles.grow : undefined}>
        <Field
          label="Neues Fach"
          value={name}
          onChangeText={(t) => { setName(t); setError(undefined); }}
          onSubmitEditing={submit}
          error={error}
          maxLength={120}
          placeholder="z. B. Mathe"
          autoComplete="off"
          returnKeyType="done"
          blurOnSubmit={false}
        />
      </View>
      <Button title="Fach hinzufügen" onPress={submit} style={wide ? styles.buttonWide : undefined} />
    </Panel>
  );
}

export function Suggestions({ names, onPick }: { names: readonly string[]; onPick: (name: string) => void }) {
  const { colors } = usePensumTheme();
  if (!names.length) return null;
  return (
    <View style={styles.suggest}>
      <AppText variant="bodySm" tone="muted">Schnell hinzufügen:</AppText>
      <View style={styles.chips}>
        {names.map((n) => (
          <Chip key={n} label={`+ ${n}`} accessibilityLabel={`${n} hinzufügen`} onPress={() => onPick(n)} style={[styles.chip, { backgroundColor: colors.canvas, borderColor: colors.border }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, gap: spacing.md },
  formWide: { padding: spacing.xl, flexDirection: "row", alignItems: "flex-start" },
  grow: { flex: 1 },
  /** Label (20) + Abstand (8): Knopf auf Höhe des Feldes */
  buttonWide: { marginTop: 28 },
  suggest: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  /** Web `.chip`: weiße Pille mit Haarlinie, 44 px hoch */
  chip: { minHeight: 44, borderWidth: 1 },
});
