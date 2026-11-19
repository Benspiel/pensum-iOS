/* Notenrechner – Speicherhinweis (Web: #storageNote mit Gast-/Konto-Text und Speicherstatus). */
import { StyleSheet, View } from "react-native";
import type { SaveStatus } from "../../shared/ports";
import { AppText, Button } from "../../../ui";
import { spacing, usePensumTheme } from "../../../theme";

const STATUS_TEXT: Record<SaveStatus, string> = { saving: "Speichert …", saved: "Gespeichert", error: "Nicht gespeichert" };

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
  const dot = <View accessible={false} style={[styles.dot, accountName ? { backgroundColor: colors.accent } : { borderColor: colors.muted, borderWidth: 2 }]} />;
  if (accountName === null) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.wrap}>
        <View style={styles.line}>
          {dot}
          <AppText variant="caption" style={styles.text}><AppText variant="label">Gast-Modus. </AppText>Deine Noten liegen nur auf diesem Gerät.</AppText>
        </View>
        <Button title="Anmelden und synchronisieren" variant="plain" onPress={onLogin} />
      </View>
    );
  }
  return (
    <View accessibilityLiveRegion="polite" style={styles.wrap}>
      <View style={styles.line}>
        {dot}
        <AppText variant="caption" style={styles.text}><AppText variant="label">Mit deinem Konto synchronisiert. </AppText>{`Angemeldet als ${accountName}.`}</AppText>
      </View>
      {localSubjects > 0 ? <Button title={`Lokale Daten übernehmen (${localSubjects})`} variant="plain" onPress={onImport} /> : null}
      <AppText variant="caption" tone={saveStatus === "error" ? "danger" : "muted"}>{STATUS_TEXT[saveStatus]}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, alignItems: "flex-start" },
  line: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  text: { flexShrink: 1 },
});
