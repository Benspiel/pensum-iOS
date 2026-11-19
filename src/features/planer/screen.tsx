/* Planer – Bildschirm. Web-Quelle: tools/planer/{index.html,planer.js} (Pensum, Web-Commit 770dbe4).
 * Dünne Zusammensetzung: Zustand in controller.ts, Regeln in model.ts/core.ts, Teile in components/. Route: app/tools/planer.tsx. */
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, ErrorState, LoadingState, Screen } from "../../ui";
import { spacing } from "../../theme";
import type { PlanItem } from "./core";
import { ExamList } from "./components/ExamList";
import { ItemDialog } from "./components/ItemDialog";
import { StatsHeader } from "./components/StatsHeader";
import { Tabs } from "./components/Tabs";
import { TaskList } from "./components/TaskList";
import { ToastHost, useToast } from "./components/Toast";
import { usePlanerController } from "./controller";
import { deckLinkHref } from "./links";
import {
  TEXT, headerStats, newButtonLabel, openEditDialog, openNewDialog, tabTitles, type DialogState, type FormFields, type Tab,
} from "./model";

const INTRO = { title: "Planer.", navigationTitle: "Planer" } as const;

export default function PlanerScreen() {
  const { toast, show } = useToast();
  const router = useRouter();
  const p = usePlanerController(show);
  const [tab, setTab] = useState<Tab>("task");
  const [dialog, setDialog] = useState<DialogState>(null);
  const { items, today } = p;

  const stats = useMemo(() => headerStats(items, today), [items, today]);
  const titles = useMemo(() => tabTitles(items, today), [items, today]);

  let body;
  if (p.session.status === "error") {
    body = <ErrorState message="Dein Konto konnte nicht geprüft werden. Versuche es noch einmal." onRetry={() => { void p.refreshSession(); }} retryLabel="Neu laden" />;
  } else if (p.phase === "loading") {
    body = <LoadingState title={TEXT.loading} />;
  } else if (p.phase === "error") {
    body = <ErrorState title="Planer nicht geladen" message="Dein Planer konnte nicht geladen werden. Prüfe deine Verbindung und versuche es noch einmal." onRetry={p.reload} retryLabel="Neu laden" />;
  } else {
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

    body = (
      <>
        <StatsHeader stats={stats} account={p.account} status={p.saveStatus} />
        <Tabs value={tab} titles={titles} onChange={setTab} />
        <Button title={newButtonLabel(tab)} onPress={() => setDialog(openNewDialog(tab))} />
        {tab === "task" ? (
          <TaskList
            items={items}
            today={today}
            onAdd={p.addQuick}
            onToggle={p.toggle}
            onEdit={(item) => setDialog(openEditDialog(item))}
            onDelete={askDelete}
            onClearDone={askClearDone}
          />
        ) : (
          <ExamList
            items={items}
            today={today}
            decks={p.decks}
            onNew={() => setDialog(openNewDialog("exam"))}
            onOpenDeck={(id) => router.push(deckLinkHref(id))}
            onEdit={(item) => setDialog(openEditDialog(item))}
            onDelete={askDelete}
          />
        )}
        {dialog && (dialog.itemId === null || editing) ? (
          <ItemDialog
            key={`${dialog.kind}:${dialog.itemId ?? "neu"}`}
            kind={dialog.kind}
            item={editing}
            items={items}
            decks={p.decks}
            onClose={() => setDialog(null)}
            onSubmit={submit}
          />
        ) : null}
      </>
    );
  }

  return (
    <View style={styles.root}>
      <Screen {...INTRO} contentStyle={styles.page}>{body}</Screen>
      <ToastHost toast={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { gap: spacing.lg },
});
