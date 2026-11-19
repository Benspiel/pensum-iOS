/* Notenrechner – neues Fach anlegen und Vorschlags-Chips (Web: #addSubjectForm, #suggestions). */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Button, Field } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";

export function AddSubject({ onAdd }: { onAdd: (name: string) => string | null }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const submit = () => {
    const err = onAdd(name);
    if (err) { setError(err); return; }
    setError(undefined);
    setName("");
  };
  return (
    <View style={styles.form}>
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
      <Button title="Fach hinzufügen" onPress={submit} />
    </View>
  );
}

export function Suggestions({ names, onPick }: { names: readonly string[]; onPick: (name: string) => void }) {
  const { colors } = usePensumTheme();
  if (!names.length) return null;
  return (
    <View style={styles.form}>
      <AppText variant="caption" tone="muted">Schnell hinzufügen:</AppText>
      <View style={styles.chips}>
        {names.map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n} hinzufügen`}
            onPress={() => onPick(n)}
            style={({ pressed }) => [styles.chip, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
          >
            <AppText variant="label">{`+ ${n}`}</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
});
