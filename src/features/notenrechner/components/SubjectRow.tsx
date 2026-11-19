/* Notenrechner – ein Fach mit Name, Zeugnisnote und Löschen (Web: subjectCard). Die Felder halten ihren Text selbst;
 * die Liste vergibt einen neuen `key`, wenn Ansicht oder Daten neu geladen wurden, dann gilt `initialValue` wieder. */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Field } from "../../../ui";
import { spacing } from "../../../theme";
import type { Subject } from "../core";

export function SubjectRow({ subject, initialValue, unit, error, onRename, onGradeText, onRemove, onEditing }: {
  subject: Subject;
  initialValue: string;
  /** "Note" oder "Punkte" */
  unit: string;
  error?: string;
  onRename: (text: string) => void;
  onGradeText: (text: string) => void;
  onRemove: () => void;
  onEditing: (editing: boolean) => void;
}) {
  const [name, setName] = useState(subject.name);
  const [value, setValue] = useState(initialValue);
  return (
    <Card>
      <Field
        label="Fach"
        accessibilityLabel={`Fachname ${subject.name}`}
        value={name}
        onChangeText={(t) => { setName(t); onRename(t); }}
        onFocus={() => onEditing(true)}
        onBlur={() => { onEditing(false); if (!name.trim()) setName(subject.name); } /* leerer Name: letzten gültigen zurückholen */}
        maxLength={120}
        autoComplete="off"
        returnKeyType="done"
      />
      <View style={styles.line}>
        <View style={styles.grow}>
          <Field
            label={`Zeugnisnote (${unit})`}
            accessibilityLabel={`Zeugnisnote ${subject.name} (${unit})`}
            value={value}
            onChangeText={(t) => { setValue(t); onGradeText(t); }}
            onFocus={() => onEditing(true)}
            onBlur={() => onEditing(false)}
            error={error}
            placeholder={unit}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="done"
          />
        </View>
        <Button title="Löschen" variant="danger" accessibilityLabel={`Fach ${subject.name} löschen`} onPress={onRemove} style={styles.remove} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  grow: { flex: 1 },
  remove: { marginTop: 26 },
});
