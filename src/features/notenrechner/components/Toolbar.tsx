/* Notenrechner – Werkzeugleiste: Schuljahr, Halbjahr, Notensystem (Web: .nr-toolbar mit .select und zwei .segmented). */
import { StyleSheet, View } from "react-native";
import { Segmented } from "../../../ui";
import { spacing } from "../../../theme";
import { SYSTEMS, schoolYearOptions, type Half, type System } from "../core";
import type { View as NotenView } from "../model";
import { YearPicker } from "./YearPicker";

const HALVES = [{ id: "1", label: "1. Halbjahr" }, { id: "2", label: "2. Halbjahr" }] as const;
const SYSTEM_OPTIONS = (Object.keys(SYSTEMS) as System[]).map((id) => ({ id, label: SYSTEMS[id].label }));

export function Toolbar({ view, subjectYears, onChange }: { view: NotenView; subjectYears: readonly string[]; onChange: (patch: Partial<NotenView>) => void }) {
  const years = schoolYearOptions([...subjectYears, view.schoolYear]);
  return (
    <View accessibilityLabel="Ansicht" style={styles.bar}>
      <YearPicker value={view.schoolYear} options={years} onChange={(schoolYear) => onChange({ schoolYear })} />
      <Segmented
        label="Zeitraum"
        options={HALVES}
        value={String(view.half) as "1" | "2"}
        onChange={(id) => { const half = Number(id) as Half; if (half !== view.half) onChange({ half }); }}
      />
      <Segmented
        label="Notensystem"
        options={SYSTEM_OPTIONS}
        value={view.system}
        onChange={(system) => { if (system !== view.system) onChange({ system }); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ bar: { gap: spacing.md } });
