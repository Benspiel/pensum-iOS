/* Notenrechner – Bildschirm (Fassung B-1, gebaut auf useNotenrechner.ts und components/*). Pro Fach wird eine Zeugnisnote eingetragen,
 * daraus entsteht der Zeugnisdurchschnitt.
 * Web-Quelle: tools/notenrechner/{index.html,notenrechner.js,notenrechner.css} (Pensum, Web-Commit 770dbe4). Zustand: useNotenrechner.ts, Logik: model.ts/ui-model.ts.
 * Einbinden: app/tools/notenrechner.tsx → `export { default } from "../../src/features/notenrechner/screen";` */
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppText, Button, Card, ErrorState, LoadingState, Panel, Screen } from "../../ui";
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
          <AppText variant="h3" accessibilityRole="header">Deine Zeugnisnoten.</AppText>
          {n.subjects.length === 0 ? (
            <Panel style={styles.empty}>
              <AppText variant="h4" accessibilityRole="header" style={styles.center}>Noch keine Fächer.</AppText>
              <AppText variant="bodySm" tone="muted" style={styles.center}>
                {`Für das Schuljahr ${n.view.schoolYear} gibt es noch kein Fach. Nimm die üblichen Schulfächer oder leg unten eigene an.`}
              </AppText>
              <Button title="Standardfächer einfügen" size="sm" onPress={n.seedDefaults} />
            </Panel>
          ) : (
            <Card style={styles.list}>
              {n.subjects.map((s, index) => (
                <SubjectRow
                  key={`${s.id}|${n.view.system}|${n.view.half}|${n.version}`}
                  subject={s}
                  initialValue={n.fieldValue(s.id)}
                  unit={unit}
                  error={n.errors[s.id]}
                  divider={index > 0}
                  onRename={(text) => n.renameSubject(s.id, text)}
                  onGradeText={(text) => n.setGradeText(s.id, text)}
                  onRemove={() => { void n.removeSubject(s.id); }}
                  onEditing={n.setEditing}
                />
              ))}
            </Card>
          )}
          <View style={styles.add}>
            <AddSubject onAdd={n.addSubject} />
          </View>
          {n.suggestions.length ? (
            <View style={styles.suggest}>
              <Suggestions names={n.suggestions} onPick={n.addSuggestion} />
            </View>
          ) : null}
        </View>
      </>
    );
  })();

  return (
    <View style={styles.root}>
      <Screen
        title="Notenrechner."
        navigationTitle="Notenrechner"
        description="Trag pro Fach deine Zeugnisnote ein. Den Zeugnisdurchschnitt siehst du sofort."
        contentStyle={styles.page}
      >
        {body}
      </Screen>
      <Toast toast={n.toast} onDismiss={n.hideToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  /** Platz unter dem Inhalt, damit der Hinweis (Toast) nichts verdeckt */
  page: { paddingBottom: 96 },
  /** Web `.nr-subjects-section { margin-top: 48px }`: 16 liefert schon der Seitenabstand, 32 kommen dazu */
  section: { marginTop: spacing.xxl },
  /** Web `.nr-subjects`: Karte mit Innenabstand 8 / 16, 24 unter der Überschrift */
  list: { marginTop: spacing.xl, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, gap: 0 },
  /** Web `.nr-empty`: zentriert, Innenabstand 48 / 16 */
  empty: { marginTop: spacing.xl, alignItems: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  center: { textAlign: "center" },
  add: { marginTop: spacing.xl },
  suggest: { marginTop: spacing.lg },
});
