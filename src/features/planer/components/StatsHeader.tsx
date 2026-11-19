/* Planer – Kopf (Web: .pl-hero): Titel „Planer.“ mit „+ Neu“-Knopf, drei Kennzahlen, Speicher-Hinweis auf einer getönten Fläche. */
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { AppText, Button, Panel } from "../../../ui";
import { WIDE_BREAKPOINT, radius, spacing, usePensumTheme } from "../../../theme";
import { saveNote, type HeaderStats, type SaveState } from "../model";

function Stat({ value, label, alert }: { value: string; label: string; alert?: boolean }) {
  const { colors } = usePensumTheme();
  const { width } = useWindowDimensions();
  const size = width <= 420 ? 22 : 26; // Web: 26 px, bis 420 px Breite 22 px
  const fg = alert ? colors.onPrimary : colors.ink;
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={[styles.stat, { backgroundColor: alert ? colors.ink : colors.canvas }]}
    >
      <AppText variant="h4" style={[styles.value, { color: fg, fontSize: size, lineHeight: Math.round(size * 1.1) }]} numberOfLines={1} adjustsFontSizeToFit>{value}</AppText>
      <AppText variant="bodySm" style={[styles.label, { color: alert ? colors.onPrimary : colors.muted, opacity: alert ? 0.8 : 1 }]} numberOfLines={1}>{label}</AppText>
    </View>
  );
}

export function StatsHeader({ stats, account, status, newLabel, onNew }: {
  stats: HeaderStats; account: boolean; status: SaveState;
  /** Beschriftung des „+ Neu“-Knopfs (wechselt mit dem Tab) */
  newLabel: string;
  onNew: () => void;
}) {
  const { colors } = usePensumTheme();
  const { width } = useWindowDimensions();
  const note = saveNote(account, status);
  return (
    <Panel style={styles.box}>
      <View style={styles.top}>
        <AppText variant="h1" accessibilityRole="header" style={{ fontSize: width >= WIDE_BREAKPOINT ? 40 : 32 }}>Planer.</AppText>
        <Button title={newLabel} onPress={onNew} />
      </View>
      <View style={styles.stats}>
        <Stat value={String(stats.open)} label="offen" />
        <Stat value={String(stats.alertCount)} label={stats.alertLabel} alert={stats.alert} />
        <Stat value={stats.nextText} label={stats.nextLabel} alert={stats.nextAlert} />
      </View>
      <View style={styles.note} accessible accessibilityLabel={note.text} accessibilityLiveRegion="polite">
        <View style={[styles.dot, { borderColor: colors.ink, backgroundColor: note.filled ? colors.ink : "transparent" }]} />
        <AppText variant="bodySm" tone="muted" style={[styles.noteText, account && status === "error" && styles.bold]}>{note.text}</AppText>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xl },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: spacing.lg, rowGap: spacing.lg },
  stats: { flexDirection: "row", gap: spacing.md },
  stat: { flex: 1, minWidth: 0, alignItems: "center", paddingVertical: spacing.lg, paddingHorizontal: spacing.sm, borderRadius: radius.field, borderCurve: "continuous" },
  value: { textAlign: "center", fontVariant: ["tabular-nums"] },
  label: { textAlign: "center", fontSize: 13, lineHeight: 19, paddingHorizontal: spacing.sm, alignSelf: "stretch" },
  note: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  dot: { width: 8, height: 8, marginTop: 7, borderRadius: 4, borderWidth: 2 },
  noteText: { flex: 1 },
  bold: { fontWeight: "600" },
});
