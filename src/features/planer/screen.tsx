/* Planer – Bildschirm. Web-Quelle: tools/planer/{index.html,planer.js} (Pensum, Web-Commit 770dbe4).
 * Dünne Zusammensetzung: Zustand in controller.ts, Regeln in model.ts/core.ts, Teile in components/. Route: app/tools/planer.tsx. */
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { AppText, Button, ErrorState, LoadingState, Screen, Segmented } from "../../ui";
import { spacing } from "../../theme";
import { TwoColumn, useWideLayout } from "../../ui/TwoColumn";
import type { PlanItem } from "./core";
import { ExamList } from "./components/ExamList";
import { ItemDialog } from "./components/ItemDialog";
import { StatsHeader } from "./components/StatsHeader";
import { TaskList } from "./components/TaskList";
import { ToastHost, useToast } from "./components/Toast";
import { usePlanerController } from "./controller";
import { deckLinkHref } from "./links";
import {
  TEXT, headerNewTab, headerStats, newButtonLabel, openEditDialog, openNewDialog, planerColumns, tabTitles,
  type DialogState, type FormFields, type PlanerBlock, type Tab,
} from "./model";

/** Im Web steht der Titel „Planer.“ im Kopf-Panel (`StatsHeader`); bei Laden/Fehler gibt es dort keinen Kopf, daher dann als Seitenüberschrift. */
const TITLE = "Planer.";

export default function PlanerScreen() {
  const { toast, show } = useToast();
  const router = useRouter();
  const p = usePlanerController(show);
  const { split } = useWideLayout();
  const [tab, setTab] = useState<Tab>("task");
  const [dialog, setDialog] = useState<DialogState>(null);
  const { items, today } = p;

  const stats = useMemo(() => headerStats(items, today), [items, today]);
  const titles = useMemo(() => tabTitles(items, today), [items, today]);

  let body;
  let ready = false;
  if (p.session.status === "error") {
    body = <ErrorState message="Dein Konto konnte nicht geprüft werden. Versuche es noch einmal." onRetry={() => { void p.refreshSession(); }} retryLabel="Neu laden" />;
  } else if (p.phase === "loading") {
    body = <LoadingState title={TEXT.loading} />;
  } else if (p.phase === "error") {
    body = <ErrorState title="Planer nicht geladen" message="Dein Planer konnte nicht geladen werden. Prüfe deine Verbindung und versuche es noch einmal." onRetry={p.reload} retryLabel="Neu laden" />;
  } else {
    ready = true;
    const editing = dialog?.itemId ? items.find((i) => i.id === dialog.itemId) ?? null : null;

    const askDelete = (item: PlanItem) => {
      if (item.kind === "task") { p.remove(item.id); return; } // Hausaufgaben ohne Rückfrage (wie im Web)
      Alert.alert("Klausur löschen?", `„${item.title}“ wird gelöscht.`, [
        { text: "Abbrechen", style: "cancel" },
        { text: "Löschen", style: "destructive", onPress: () => p.remove(item.id) },
      ]);
    };
    const askClearDone = () => Alert.alert("Erledigte löschen?", "Alle erledigten Hausaufgaben werden gelöscht.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: p.clearDoneTasks },
    ]);
    const submit = (fields: FormFields) => {
      if (dialog) p.saveItem(dialog.kind, dialog.itemId, fields);
      setDialog(null);
    };

    const newTab = headerNewTab(split, tab);
    const cols = planerColumns(split, tab);
    const blocks: Record<PlanerBlock, ReactNode> = {
      header: <StatsHeader key="header" stats={stats} account={p.account} status={p.saveStatus} newLabel={newButtonLabel(newTab)} onNew={() => setDialog(openNewDialog(newTab))} roomy={split} />,
      tabs: (
        <Segmented
          key="tabs"
          role="tablist"
          label="Bereiche"
          options={[{ id: "task", label: titles.task }, { id: "exam", label: titles.exam }]}
          value={tab}
          onChange={setTab}
        />
      ),
      tasks: (
        <TaskList
          key="tasks"
          items={items}
          today={today}
          onAdd={p.addQuick}
          onToggle={p.toggle}
          onEdit={(item) => setDialog(openEditDialog(item))}
          onDelete={askDelete}
          onClearDone={askClearDone}
        />
      ),
      exams: (
        <ExamList
          key="exams"
          items={items}
          today={today}
          decks={p.decks}
          header={split ? (
            <View style={styles.examHead}>
              <AppText variant="h3" accessibilityRole="header" style={styles.examTitle}>{titles.exam}</AppText>
              <Button title={newButtonLabel("exam")} onPress={() => setDialog(openNewDialog("exam"))} />
            </View>
          ) : undefined}
          onNew={() => setDialog(openNewDialog("exam"))}
          onOpenDeck={(id) => router.push(deckLinkHref(id))}
          onEdit={(item) => setDialog(openEditDialog(item))}
          onDelete={askDelete}
        />
      ),
    };

    body = (
      <>
        <TwoColumn
          split={split}
          gap={split ? spacing.xxl : spacing.lg}
          primaryWeight={cols.weights.primary}
          secondaryWeight={cols.weights.secondary}
          primary={cols.primary.map((id) => blocks[id])}
          secondary={cols.secondary.length ? cols.secondary.map((id) => blocks[id]) : undefined}
        />
        {dialog && (dialog.itemId === null || editing) ? (
          <ItemDialog
            key={`${dialog.kind}:${dialog.itemId ?? "neu"}`}
            kind={dialog.kind}
            item={editing}
            items={items}
            decks={p.decks}
            today={today}
            onClose={() => setDialog(null)}
            onSubmit={submit}
          />
        ) : null}
      </>
    );
  }

  return (
    <View style={styles.root}>
      <Screen navigationTitle="Planer" title={ready ? undefined : TITLE} wide contentStyle={styles.page}>{body}</Screen>
      <ToastHost toast={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  /** Platz unter dem Inhalt, damit der Hinweis (Toast) nichts verdeckt */
  page: { gap: spacing.lg, paddingBottom: 96 },
  /** Kopfzeile der Klausuren-Spalte (iPad): Überschrift links, „+ Neue Klausur“ rechts */
  examHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: spacing.lg, rowGap: spacing.sm },
  examTitle: { flexShrink: 1 },
});
