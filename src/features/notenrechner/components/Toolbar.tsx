/* Notenrechner – Werkzeugleiste: Schuljahr, Halbjahr, Notensystem (Web: .nr-toolbar). */
import { StyleSheet, View } from "react-native";
import { SYSTEMS, schoolYearOptions, type Half, type System } from "../core";
import type { View as NotenView } from "../model";
import { spacing } from "../../../theme";
import { Segmented } from "./Segmented";
import { YearPicker } from "./YearPicker";

const HALVES: Array<{ value: Half; title: string }> = [{ value: 1, title: "1. Halbjahr" }, { value: 2, title: "2. Halbjahr" }];
const SYSTEM_OPTIONS = (Object.keys(SYSTEMS) as System[]).map((id) => ({ value: id, title: SYSTEMS[id].label }));

export function Toolbar({ view, subjectYears, onChange }: { view: NotenView; subjectYears: readonly string[]; onChange: (patch: Partial<NotenView>) => void }) {
  const years = schoolYearOptions([...subjectYears, view.schoolYear]);
  return (
    <View accessibilityLabel="Ansicht" style={styles.bar}>
      <YearPicker value={view.schoolYear} options={years} onChange={(schoolYear) => onChange({ schoolYear })} />
      <Segmented label="Zeitraum" options={HALVES} value={view.half} onChange={(half) => onChange({ half })} />
      <Segmented label="Notensystem" options={SYSTEM_OPTIONS} value={view.system} onChange={(system) => onChange({ system })} />
    </View>
  );
}

const styles = StyleSheet.create({ bar: { gap: spacing.md } });
