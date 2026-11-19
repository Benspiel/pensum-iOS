/* Planer – Kopf: drei Kennzahlen und Speicher-Hinweis. */
import { StyleSheet, View } from "react-native";
import { AppText } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { saveNote, type HeaderStats, type SaveState } from "../model";

function Stat({ value, label, alert }: { value: string; label: string; alert?: boolean }) {
  const { colors } = usePensumTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={[styles.stat, { backgroundColor: alert ? colors.dangerSurface : colors.canvas }]}
    >
      <AppText variant="section" tone={alert ? "danger" : "default"} style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</AppText>
      <AppText variant="caption" tone={alert ? "danger" : "muted"} style={styles.label} numberOfLines={2}>{label}</AppText>
    </View>
  );
}

export function StatsHeader({ stats, account, status }: { stats: HeaderStats; account: boolean; status: SaveState }) {
  const { colors } = usePensumTheme();
  const note = saveNote(account, status);
  return (
    <View style={[styles.box, { backgroundColor: colors.surface }]}>
      <View style={styles.stats}>
        <Stat value={String(stats.open)} label="offen" />
        <Stat value={String(stats.alertCount)} label={stats.alertLabel} alert={stats.alert} />
        <Stat value={stats.nextText} label={stats.nextLabel} alert={stats.nextAlert} />
      </View>
      <View style={styles.note} accessible accessibilityLabel={note.text} accessibilityLiveRegion="polite">
        <View style={[styles.dot, { borderColor: colors.ink, backgroundColor: note.filled ? colors.ink : "transparent" }]} />
        <AppText variant="caption" tone={account && status === "error" ? "danger" : "muted"} style={styles.noteText}>{note.text}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md, padding: spacing.md, borderRadius: radius.card, borderCurve: "continuous" },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, minWidth: 0, alignItems: "center", gap: 2, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, borderRadius: radius.field, borderCurve: "continuous" },
  value: { fontSize: 24, textAlign: "center" },
  label: { textAlign: "center" },
  note: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  dot: { width: 8, height: 8, marginTop: 6, borderRadius: 4, borderWidth: 2 },
  noteText: { flex: 1 },
});
