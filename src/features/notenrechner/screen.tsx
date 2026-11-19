/* Notenrechner – Bildschirm (Fassung B-1, gebaut auf useNotenrechner.ts und components/*). Pro Fach wird eine Zeugnisnote eingetragen,
 * daraus entsteht der Zeugnisdurchschnitt.
 * Web-Quelle: tools/notenrechner/{index.html,notenrechner.js} (Pensum, Web-Commit 770dbe4). Zustand: useNotenrechner.ts, Logik: model.ts/ui-model.ts.
 * Einbinden: app/tools/notenrechner.tsx → `export { default } from "../../src/features/notenrechner/screen-b1";` */
import { useRouter } from "expo-router";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { AppText, Button, EmptyState, ErrorState, LoadingState, Screen } from "../../ui";
import { spacing } from "../../theme";
import { SYSTEMS } from "./core";
import { AddSubject, Suggestions } from "./components/AddSubject";
import { Converter } from "./components/Converter";
import { StorageNote } from "./components/StorageNote";
import { SubjectRow } from "./components/SubjectRow";
import { Summary } from "./components/Summary";
import { Toast } from "./components/Toast";
import { Toolbar } from "./components/Toolbar";
import { useNotenrechner } from "./useNotenrechner";

export default function NotenrechnerScreen() {
  const n = useNotenrechner();
  const router = useRouter();

  const body = (() => {
    if (n.status === "error") {
      return <ErrorState title="Dein Konto konnte nicht geprüft werden." message={n.sessionError ?? "Prüfe deine Verbindung."} onRetry={() => { void n.retrySession(); }} retryLabel="Neu laden" />;
    }
    if (!n.ready || (n.loading && !n.loadError)) return <LoadingState title="Lade deine Noten …" />;
    if (n.loadError) return <ErrorState title="Noten nicht geladen." message={n.loadError} onRetry={n.reload} retryLabel="Neu laden" />;
    const unit = SYSTEMS[n.view.system].unit;
    return (
      <>
        <Toolbar view={n.view} subjectYears={n.subjectYears} onChange={n.changeView} />
        <StorageNote
          accountName={n.accountName}
          saveStatus={n.saveStatus}
          localSubjects={n.guestSubjects}
          onLogin={() => router.push("/konto")}
          onImport={() => { void n.importLocal(); }}
        />
        <Summary summary={n.summary} />
        <Converter />
        <View style={styles.section}>
          <AppText variant="section" accessibilityRole="header">Deine Zeugnisnoten.</AppText>
          {n.subjects.length === 0 ? (
            <EmptyState
              title="Noch keine Fächer."
              message={`Für das Schuljahr ${n.view.schoolYear} gibt es noch kein Fach. Nimm die üblichen Schulfächer oder leg unten eigene an.`}
              action={<Button title="Standardfächer einfügen" onPress={n.seedDefaults} />}
            />
          ) : n.subjects.map((s) => (
            <SubjectRow
              key={`${s.id}|${n.view.system}|${n.view.half}|${n.version}`}
              subject={s}
              initialValue={n.fieldValue(s.id)}
              unit={unit}
              error={n.errors[s.id]}
              onRename={(text) => n.renameSubject(s.id, text)}
              onGradeText={(text) => n.setGradeText(s.id, text)}
              onRemove={() => { void n.removeSubject(s.id); }}
              onEditing={n.setEditing}
            />
          ))}
          <AddSubject onAdd={n.addSubject} />
          <Suggestions names={n.suggestions} onPick={n.addSuggestion} />
        </View>
      </>
    );
  })();

  return (
    <Screen navigationTitle="Notenrechner" scroll={false} contentStyle={styles.screen}>
      <View style={styles.fill}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustKeyboardInsets
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.intro}>
            <AppText variant="title" accessibilityRole="header">Notenrechner.</AppText>
            <AppText tone="muted">Trag pro Fach deine Zeugnisnote ein. Den Zeugnisdurchschnitt siehst du sofort.</AppText>
          </View>
          {body}
        </ScrollView>
        <Toast toast={n.toast} onDismiss={n.hideToast} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0, gap: 0, maxWidth: 760 },
  fill: { flex: 1 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: spacing.lg, paddingBottom: 96, gap: spacing.lg },
  intro: { gap: spacing.sm, paddingVertical: spacing.md },
  section: { gap: spacing.md },
});
