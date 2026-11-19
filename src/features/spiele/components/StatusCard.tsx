/* Vier gewinnt – Statuszeile: wer ist dran, Sieg, Niederlage, Unentschieden (Web: Chips oben, Ergebnis im Overlay). */
import { StyleSheet, View } from "react-native";

import { usePensumTheme, spacing } from "../../../theme";
import { AppText, Button, Card } from "../../../ui";
import type { Status } from "../model";
import { CHIP_COLORS } from "./Disc";

interface StatusCardProps {
  status: Status;
  wins: number;
  levelLabel: string;
  onRestart: () => void;
}

export function StatusCard({ status, wins, levelLabel, onRestart }: StatusCardProps) {
  const { colors } = usePensumTheme();
  const finished = status.tone === "win" || status.tone === "lose" || status.tone === "draw";
  return (
    <Card>
      <View accessible accessibilityRole="header" accessibilityLiveRegion="polite" accessibilityLabel={`${status.title}. ${status.text}`} style={styles.text}>
        <AppText variant="section" tone={status.tone === "lose" ? "danger" : status.tone === "win" ? "accent" : "default"}>{status.title}</AppText>
        <AppText tone="muted">{status.text}</AppText>
      </View>
      <View style={styles.legend}>
        <Legend color={CHIP_COLORS[1]} label="Du (gelb)" border={colors.border} />
        <Legend color={CHIP_COLORS[2]} label="Computer (rot)" border={colors.border} />
        <View accessible accessibilityLabel={`Siege auf Stufe ${levelLabel}: ${wins}`}>
          <AppText variant="label">Siege hier {wins}</AppText>
        </View>
      </View>
      <Button title={finished ? "Nochmal" : "Neues Spiel"} variant={finished ? "primary" : "secondary"} onPress={onRestart} />
    </Card>
  );
}

function Legend({ color, label, border }: { color: string; label: string; border: string }) {
  return (
    <View style={styles.legendItem} accessible accessibilityLabel={label}>
      <View style={[styles.swatch, { backgroundColor: color, borderColor: border }]} />
      <AppText variant="label">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { gap: spacing.xs },
  legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.lg, rowGap: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
});
