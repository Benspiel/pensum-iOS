/* Planer – Tab „Hausaufgaben“: Schnellerfassung, Gruppen, Zeilen, Erledigt-Bereich (Web: .pl-quick, .pl-group, .pl-row, .pl-details).
 * Dünne Komponenten, Logik in model.ts/core.ts. */
import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText, Badge, Button, TintContext } from "../../../ui";
import { radius, resolveTextStyle, spacing, usePensumTheme } from "../../../theme";
import { groupTasks, type PlanItem } from "../core";
import { groupHeading, taskEmpty, taskRowModel } from "../model";
import { Disclosure } from "./Disclosure";
import { Empty } from "./Empty";
import { IconButton } from "./IconButton";
import { useReduceMotion } from "./useReduceMotion";

/** Abhaken: Zeile blendet kurz aus und gleitet weg (Web: .leaving, 280 ms), danach wird umgeschaltet. Bei „Bewegung reduzieren“ sofort. */
const LEAVE_MS = 280;

function TaskRow({ task, today, done, reduceMotion, onToggle, onEdit, onDelete }: {
  task: PlanItem; today: string; done?: boolean; reduceMotion: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { colors } = usePensumTheme();
  const m = taskRowModel(task, today);
  const leave = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);
  const press = () => {
    if (leaving.current) return;
    if (reduceMotion) { onToggle(); return; }
    leaving.current = true;
    Animated.timing(leave, { toValue: 1, duration: LEAVE_MS, useNativeDriver: true }).start(() => { leaving.current = false; onToggle(); });
  };
  return (
    <TintContext.Provider value={false}>
      <Animated.View style={[styles.row, { borderColor: colors.hairlineSoft, backgroundColor: colors.canvas, opacity: leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateX: leave.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) }] }]}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`${done ? "Wieder öffnen" : "Als erledigt markieren"}: ${task.title}`}
          accessibilityState={{ checked: !!done }}
          onPress={press}
          style={styles.checkHit}
        >
          <View style={[styles.check, { borderColor: colors.ink, backgroundColor: done ? colors.ink : "transparent" }]}>
            {done ? <AppText accessible={false} style={[styles.checkMark, { color: colors.onPrimary }]}>✓</AppText> : null}
          </View>
        </Pressable>
        <View style={styles.body}>
          <AppText variant="link" style={done ? { textDecorationLine: "line-through", color: colors.mutedOnCanvas } : undefined}>{task.title}</AppText>
          <View style={styles.meta}>
            {task.subject ? <Badge label={task.subject} style={styles.badge} /> : null}
            {done ? null : (
              <AppText variant="caption" style={[styles.small, { color: m.tone === "normal" ? colors.mutedOnCanvas : colors.ink }, m.tone !== "normal" && styles.strong]}>{m.dueText}</AppText>
            )}
          </View>
          {task.note ? <AppText variant="caption" style={[styles.small, styles.note, { color: colors.mutedOnCanvas }]}>{task.note}</AppText> : null}
        </View>
        <View style={styles.actions}>
          <IconButton symbol="pencil" fallback="✎" label={`Bearbeiten: ${task.title}`} onPress={onEdit} />
          <IconButton symbol="trash" fallback="✕" label={`Löschen: ${task.title}`} hint="Destruktive Aktion" onPress={onDelete} />
        </View>
      </Animated.View>
    </TintContext.Provider>
  );
}

/** Schnellerfassung (Web: .pl-quick): Pillen-Feld und „Hinzufügen“. Das Feld hat im Web ein verstecktes Label, hier das Zugänglichkeits-Label. */
export function QuickAdd({ onAdd }: { onAdd: (title: string) => boolean }) {
  const { colors, scheme, customFonts } = usePensumTheme();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const body = resolveTextStyle("body", { customFonts });
  const submit = () => { if (onAdd(text)) setText(""); };
  return (
    <View style={styles.quick}>
      <View style={styles.quickField}>
        <TextInput
          accessibilityLabel="Neue Hausaufgabe"
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={120}
          placeholder="Neue Hausaufgabe eintippen und Enter …"
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          keyboardAppearance={scheme}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={submit}
          style={[styles.quickInput, { color: colors.ink, backgroundColor: colors.field, fontSize: body.fontSize, fontFamily: body.fontFamily, fontWeight: body.fontWeight }]}
        />
        {focused ? <View pointerEvents="none" style={[styles.ring, { borderColor: colors.ink }]} /> : null}
      </View>
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
  const { colors } = usePensumTheme();
  const tasks = items.filter((i) => i.kind === "task");
  const groups = groupTasks(tasks, today);
  const done = tasks.filter((t) => t.done);
  const empty = taskEmpty(items);
  const reduceMotion = useReduceMotion();
  const row = (t: PlanItem, isDone = false) => (
    <TaskRow key={t.id} task={t} today={today} done={isDone} reduceMotion={reduceMotion} onToggle={() => onToggle(t.id)} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} />
  );
  return (
    <View style={styles.list}>
      <QuickAdd onAdd={onAdd} />
      {groups.length ? groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <AppText variant="fieldLabel" accessibilityRole="header" style={[styles.heading, { color: g.key === "overdue" ? colors.ink : colors.mutedOnCanvas }]}>{groupHeading(g.label, g.items.length)}</AppText>
          {g.items.map((t) => row(t))}
        </View>
      )) : <Empty title={empty.title} message={empty.message} />}
      {done.length ? (
        <Disclosure title={`Erledigt (${done.length})`}>
          {done.map((t) => row(t, true))}
          <View style={styles.clear}>
            <Button title="Erledigte löschen" variant="soft" size="sm" onPress={onClearDone} />
          </View>
        </Disclosure>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  group: { gap: spacing.sm },
  /** Web `.pl-group h2`: 14 px / 600, Großbuchstaben, Buchstabenabstand .04em */
  heading: { textTransform: "uppercase", letterSpacing: 0.56, marginTop: spacing.sm },
  quick: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  quickField: { flex: 1 },
  quickInput: { minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill, borderCurve: "continuous" },
  ring: { ...StyleSheet.absoluteFill, borderWidth: 2, borderRadius: radius.pill, borderCurve: "continuous" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingLeft: spacing.md, paddingRight: spacing.lg, borderWidth: 1, borderRadius: radius.card, borderCurve: "continuous" },
  checkHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  checkMark: { fontSize: 15, lineHeight: 18 },
  body: { flex: 1, minWidth: 0 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  badge: { minHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  note: { marginTop: spacing.xs },
  strong: { fontWeight: "600" },
  actions: { flexDirection: "row" },
  clear: { alignItems: "flex-start", paddingHorizontal: spacing.xs, paddingTop: spacing.xs },
});
