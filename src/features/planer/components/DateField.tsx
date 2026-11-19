/* Planer – Datumsfeld im Dialog. iOS: Feldfläche mit Datumswähler (compact, Sprache de) und Schalter „Datum festlegen“.
 * Sonst Textfeld „TT.MM.JJJJ“. Der Wert bleibt in beiden Fällen ein Text "TT.MM.JJJJ" (oder leer); model.ts → validateForm macht daraus das ISO-Datum. */
import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform, StyleSheet, Switch, View } from "react-native";
import { AppText, Field } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { formatDateInput, pickerDate, textFromPickerDate } from "../model";
import { FormMessage } from "./FormMessage";

export function DateField({ label, placeholder, value, today, error, onChange }: {
  label: string;
  placeholder: string;
  /** "TT.MM.JJJJ" oder "" */
  value: string;
  /** heute als "JJJJ-MM-TT" */
  today: string;
  error?: string;
  onChange: (text: string) => void;
}) {
  const { colors, scheme } = usePensumTheme();
  if (Platform.OS !== "ios") {
    return <Field label={label} value={value} onChangeText={onChange} maxLength={10} keyboardType="numbers-and-punctuation" placeholder={placeholder} error={error} />;
  }
  const enabled = value.trim() !== "";
  return (
    <View style={styles.box}>
      <AppText variant="fieldLabel" accessible={false}>{label}</AppText>
      <View style={[styles.field, { backgroundColor: colors.field }]}>
        {enabled ? (
          <DateTimePicker
            value={pickerDate(value, today)}
            mode="date"
            display="compact"
            locale="de-DE"
            themeVariant={scheme}
            accentColor={colors.accentFill}
            accessibilityLabel={label}
            onChange={(_event, date) => { if (date) onChange(textFromPickerDate(date)); }}
          />
        ) : (
          <AppText tone="muted" accessible={false} style={styles.placeholder}>{placeholder}</AppText>
        )}
        <Switch
          value={enabled}
          onValueChange={(on) => onChange(on ? formatDateInput(today) : "")}
          accessibilityLabel={`${label} festlegen`}
          trackColor={{ true: colors.accentFill }}
        />
      </View>
      {error ? <FormMessage text={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  /** Wie `Field`: Fläche `field`, Radius 16, mindestens 48 hoch */
  field: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingLeft: spacing.lg, paddingRight: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.field, borderCurve: "continuous" },
  placeholder: { flexShrink: 1 },
});
