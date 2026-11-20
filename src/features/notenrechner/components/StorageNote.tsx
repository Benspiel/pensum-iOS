/* Notenrechner – Speicherhinweis (Web: .storage-note.on-tint mit Punkt, Text, Text-Link und Speicherstatus). */
import { StyleSheet, View } from "react-native";
import type { SaveStatus } from "../../shared/ports";
import { AppText, Card } from "../../../ui";
import { PressableScale } from "../../../ui/motion";
import { radius, spacing, usePensumTheme } from "../../../theme";

const STATUS_TEXT: Record<SaveStatus, string> = { saving: "Speichert …", saved: "Gespeichert", error: "Nicht gespeichert" };

function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <PressableScale scaleTo={1} haptic="tap" accessibilityRole="link" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
      <AppText variant="bodySm" tone="muted" accessible={false} style={styles.underline}>{title}</AppText>
    </PressableScale>
  );
}

export function StorageNote({ accountName, saveStatus, localSubjects, onLogin, onImport }: {
  /** null = Gastmodus */
  accountName: string | null;
  saveStatus: SaveStatus;
  /** Anzahl Fächer im Gastspeicher dieses Geräts (nur im Konto relevant) */
  localSubjects: number;
  onLogin: () => void;
  onImport: () => void;
}) {
  const { colors } = usePensumTheme();
  const dot = (
    <View
      accessible={false}
      style={[styles.dot, accountName ? { backgroundColor: colors.ink } : { borderColor: colors.ink, borderWidth: 2 }]}
    />
  );
  return (
    <Card variant="soft" accessibilityLiveRegion="polite" style={styles.note}>
      <View style={styles.line}>
        {dot}
        {accountName === null ? (
          <AppText variant="bodySm" style={styles.text}><AppText variant="fieldLabel">Gast-Modus. </AppText>Deine Noten liegen nur auf diesem Gerät.</AppText>
        ) : (
          <AppText variant="bodySm" style={styles.text}><AppText variant="fieldLabel">Mit deinem Konto synchronisiert. </AppText>{`Angemeldet als ${accountName}.`}</AppText>
        )}
        {accountName === null ? <TextLink title="Anmelden und synchronisieren" onPress={onLogin} /> : null}
        {accountName !== null && localSubjects > 0 ? <TextLink title={`Lokale Daten übernehmen (${localSubjects})`} onPress={onImport} /> : null}
        {accountName !== null ? (
          <AppText variant="caption" tone={saveStatus === "error" ? "default" : "muted"} style={styles.status}>{STATUS_TEXT[saveStatus]}</AppText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  note: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.field, gap: 0 },
  line: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, alignSelf: "flex-start", marginTop: 6 },
  text: { flexGrow: 1, flexShrink: 1, flexBasis: 220 },
  link: { minHeight: 44, justifyContent: "center" },
  underline: { textDecorationLine: "underline" },
  status: { marginLeft: "auto", fontWeight: "600" },
});
