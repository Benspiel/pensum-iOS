/* Planer – Tab „Hausaufgaben“: Schnellerfassung, Gruppen, Zeilen, Erledigt-Bereich. Dünne Komponenten, Logik in model.ts/core.ts. */
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText, Button, EmptyState } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { groupTasks, type PlanItem } from "../core";
import { groupHeading, taskEmpty, taskRowModel } from "../model";
import { Disclosure } from "./Disclosure";

function TextAction({ label, accessibilityLabel, danger, onPress }: { label: string; accessibilityLabel: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} hitSlop={4} style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
      <AppText variant="label" tone={danger ? "danger" : "accent"} accessible={false}>{label}</AppText>
    </Pressable>
  );
}

function TaskRow({ task, today, done, onToggle, onEdit, onDelete }: {
  task: PlanItem; today: string; done?: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { colors } = usePensumTheme();
  const m = taskRowModel(task, today);
  return (
    <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.canvas }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`${done ? "Wieder öffnen" : "Als erledigt markieren"}: ${task.title}`}
        accessibilityState={{ checked: !!done }}
        onPress={onToggle}
        style={styles.checkHit}
      >
        <View style={[styles.check, { borderColor: colors.ink, backgroundColor: done ? colors.ink : "transparent" }]}>
          {done ? <AppText accessible={false} style={{ color: colors.onPrimary }}>✓</AppText> : null}
        </View>
      </Pressable>
      <View style={styles.body}>
        <AppText variant="label" style={done ? styles.done : undefined}>{task.title}</AppText>
        <View style={styles.meta}>
          {task.subject ? (
            <View style={[styles.chip, { backgroundColor: colors.surface }]}>
              <AppText variant="caption" tone="muted">{task.subject}</AppText>
            </View>
          ) : null}
          {done ? null : (
            <AppText variant="caption" tone={m.tone === "late" ? "danger" : "muted"} style={m.tone === "normal" ? undefined : styles.strong}>{m.dueText}</AppText>
          )}
        </View>
        {task.note ? <AppText variant="caption" tone="muted">{task.note}</AppText> : null}
        <View style={styles.actions}>
          <TextAction label="Bearbeiten" accessibilityLabel={`Bearbeiten: ${task.title}`} onPress={onEdit} />
          <TextAction label="Löschen" accessibilityLabel={`Löschen: ${task.title}`} danger onPress={onDelete} />
        </View>
      </View>
    </View>
  );
}

export function QuickAdd({ onAdd }: { onAdd: (title: string) => boolean }) {
  const { colors, scheme } = usePensumTheme();
  const [text, setText] = useState("");
  const submit = () => { if (onAdd(text)) setText(""); };
  return (
    <View style={styles.quick}>
      <TextInput
        accessibilityLabel="Neue Hausaufgabe"
        value={text}
        onChangeText={setText}
        maxLength={120}
        placeholder="Neue Hausaufgabe eintippen und Enter …"
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        keyboardAppearance={scheme}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={submit}
        style={[styles.quickInput, { color: colors.ink, backgroundColor: colors.field, borderColor: colors.border }]}
      />
      <Button title="Hinzufügen" onPress={submit} />
    </View>
  );
}

export function TaskList({ items, today, onAdd, onToggle, onEdit, onDelete, onClearDone }: {
  items: readonly PlanItem[];
  today: string;
  onAdd: (title: string) => boolean;
  onToggle: (id: string) => void;
  onEdit: (item: PlanItem) => void;
  onDelete: (item: PlanItem) => void;
  onClearDone: () => void;
}) {
  const tasks = items.filter((i) => i.kind === "task");
  const groups = groupTasks(tasks, today);
  const done = tasks.filter((t) => t.done);
  const empty = taskEmpty(items);
  const row = (t: PlanItem, isDone = false) => (
    <TaskRow key={t.id} task={t} today={today} done={isDone} onToggle={() => onToggle(t.id)} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} />
  );
  return (
    <View style={styles.list}>
      <QuickAdd onAdd={onAdd} />
      {groups.length ? groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <AppText variant="label" tone={g.key === "overdue" ? "danger" : "muted"} accessibilityRole="header">{groupHeading(g.label, g.items.length)}</AppText>
          {g.items.map((t) => row(t))}
        </View>
      )) : <EmptyState title={empty.title} message={empty.message} />}
      {done.length ? (
        <Disclosure title={`Erledigt (${done.length})`}>
          {done.map((t) => row(t, true))}
          <Button title="Erledigte löschen" variant="secondary" onPress={onClearDone} />
        </Disclosure>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  group: { gap: spacing.sm },
  quick: { gap: spacing.sm },
  quickInput: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill, borderCurve: "continuous", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs, paddingVertical: spacing.xs, paddingRight: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, borderCurve: "continuous" },
  checkHit: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0, gap: spacing.xs, paddingVertical: spacing.sm },
  done: { textDecorationLine: "line-through", opacity: 0.6 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  strong: { fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.lg },
  action: { minHeight: 44, justifyContent: "center" },
});
