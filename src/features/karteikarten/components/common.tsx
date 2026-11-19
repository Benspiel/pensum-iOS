/* Karteikarten – kleine gemeinsame Bausteine (Dialog-Blatt, Speicherhinweis, Level-Anzeigen, Tabs).
 * Web-Quelle: karteikarten.js (noteHtml, levelBar, boxes, openDialog, Tab-Leiste), Web-Commit 770dbe4. */
import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LEVELS, levelCounts } from "../core";
import type { Deck } from "../core";
import { saveNote } from "../session-model";
import type { DeckTab, SaveStatus } from "../session-model";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { AppText, Button } from "../../../ui";

/** Dialog als Blatt über dem Screen (Web: <dialog class="modal">). */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { colors } = usePensumTheme();
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.sheet, { backgroundColor: colors.canvas }]} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.sheetHead}>
          <AppText variant="section" accessibilityRole="header" style={styles.flex}>{title}</AppText>
          <Button title="Schließen" variant="plain" onPress={onClose} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody} automaticallyAdjustKeyboardInsets>
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** Speicherhinweis unter der Kopfzeile der Liste. */
export function SaveNote({ signedIn, status, onLogin }: { signedIn: boolean; status: SaveStatus; onLogin: () => void }) {
  const { colors } = usePensumTheme();
  const note = saveNote(signedIn, status);
  return (
    <View style={styles.note} accessibilityLiveRegion="polite">
      <View style={[styles.dot, { borderColor: colors.ink, backgroundColor: note.hollow ? "transparent" : colors.ink }]} />
      <View style={styles.flex}>
        <AppText variant="caption" tone="muted">{note.text}</AppText>
        {note.loginHint ? <Button title="Anmelden, um sie in deinem Konto zu sichern." variant="plain" onPress={onLogin} style={styles.linkButton} /> : null}
      </View>
    </View>
  );
}

/** Die fünf Fächer als schmale Leiste (Web: kk-levels). */
export function LevelBar({ deck }: { deck: Deck }) {
  const { colors } = usePensumTheme();
  const opacity = [0.3, 0.45, 0.65, 0.85, 1];
  return (
    <View style={styles.levelBar} accessible={false} importantForAccessibility="no-hide-descendants">
      {levelCounts(deck).map((n, i) => (
        <View key={i} style={[styles.levelSeg, { backgroundColor: n ? colors.ink : colors.border, opacity: n ? (opacity[i] ?? 1) : 1 }]} />
      ))}
    </View>
  );
}

/** Karten pro Level als Kästen (Web: kk-boxes). */
export function LevelBoxes({ deck }: { deck: Deck }) {
  const { colors } = usePensumTheme();
  return (
    <View style={styles.boxes} accessibilityRole="list" accessibilityLabel="Karten pro Level">
      {levelCounts(deck).map((n, i) => (
        <View key={i} style={[styles.box, { backgroundColor: i === LEVELS - 1 ? colors.accentSurface : colors.canvas }]} accessible accessibilityLabel={`${i === LEVELS - 1 ? "Gelernt" : `Level ${i + 1}`}: ${n}`}>
          <AppText variant="section">{String(n)}</AppText>
          <AppText variant="caption" tone="muted">{i === LEVELS - 1 ? "Gelernt" : `Level ${i + 1}`}</AppText>
        </View>
      ))}
    </View>
  );
}

/** Tab-Leiste Lernen / Karten / Hinzufügen. */
export function Tabs({ tabs, value, onChange }: { tabs: Array<[DeckTab, string]>; value: DeckTab; onChange: (t: DeckTab) => void }) {
  const { colors } = usePensumTheme();
  return (
    <View style={[styles.tabs, { backgroundColor: colors.surface }]} accessibilityRole="tablist" accessibilityLabel="Bereiche des Stapels">
      {tabs.map(([id, title]) => (
        <Pressable
          key={id}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === id }}
          onPress={() => onChange(id)}
          style={[styles.tab, value === id && { backgroundColor: colors.canvas }]}
        >
          <AppText variant="label" tone={value === id ? "default" : "muted"} numberOfLines={1}>{title}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

export const common = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stats: { flexDirection: "row", gap: spacing.sm },
  grow: { flex: 1 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { flex: 1 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  sheetBody: { padding: spacing.lg, gap: spacing.lg },
  note: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: 5 },
  linkButton: { alignSelf: "flex-start", minHeight: 32, paddingHorizontal: 0, paddingVertical: spacing.xs, justifyContent: "flex-start" },
  levelBar: { flexDirection: "row", gap: 3, height: 8, marginTop: spacing.xs },
  levelSeg: { flex: 1, borderRadius: radius.pill },
  boxes: { flexDirection: "row", gap: spacing.xs },
  box: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.field, borderCurve: "continuous" },
  tabs: { flexDirection: "row", padding: spacing.xs, borderRadius: radius.pill, gap: spacing.xs },
  tab: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, paddingHorizontal: spacing.sm },
});
