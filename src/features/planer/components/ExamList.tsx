/* Planer – Tab „Klausuren“: Karten mit Countdown, Link zu Karteikarten, Leerzustand, vergangene Klausuren. */
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Button, Card, EmptyState } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { splitExams, type PlanItem } from "../core";
import { resolveDeck, type DeckSummary } from "../links";
import { EXAM_EMPTY, examCardModel } from "../model";
import { Disclosure } from "./Disclosure";

function ExamCard({ exam, today, decks, onOpenDeck, onEdit, onDelete }: {
  exam: PlanItem; today: string; decks: readonly DeckSummary[];
  onOpenDeck: (deckId: string) => void; onEdit: () => void; onDelete: () => void;
}) {
  const { colors } = usePensumTheme();
  const m = examCardModel(exam, today);
  const deck = resolveDeck(exam, decks); // verwaiste Stapel-IDs ergeben keinen Link
  const hot = m.state === "soon" || m.state === "today";
  const fg = hot ? colors.onPrimary : colors.ink;
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View
          accessible
          accessibilityLabel={`${m.big} ${m.small}`}
          style={[styles.count, { backgroundColor: hot ? colors.ink : colors.surface, opacity: m.state === "past" ? 0.6 : 1 }]}
        >
          <AppText variant="section" style={[{ color: fg }, m.longBig && styles.longBig]} numberOfLines={1} adjustsFontSizeToFit>{m.big}</AppText>
          <AppText variant="caption" style={{ color: fg }} numberOfLines={2}>{m.small}</AppText>
        </View>
        <View style={styles.main}>
          <AppText variant="section">{exam.title}</AppText>
          <View style={styles.meta}>
            {exam.subject ? (
              <View style={[styles.chip, { backgroundColor: colors.surface }]}>
                <AppText variant="caption" tone="muted">{exam.subject}</AppText>
              </View>
            ) : null}
            <AppText variant="caption" tone="muted">{m.dateText}</AppText>
          </View>
          {exam.note ? <AppText variant="caption" tone="muted">{exam.note}</AppText> : null}
        </View>
      </View>
      <View style={styles.actions}>
        {deck ? <Button title="Karteikarten lernen" accessibilityHint={`Öffnet den Stapel ${deck.name}`} onPress={() => onOpenDeck(deck.id)} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Bearbeiten: ${exam.title}`} onPress={onEdit} style={styles.action}>
          <AppText variant="label" tone="accent" accessible={false}>Bearbeiten</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Löschen: ${exam.title}`} onPress={onDelete} style={styles.action}>
          <AppText variant="label" tone="danger" accessible={false}>Löschen</AppText>
        </Pressable>
      </View>
    </Card>
  );
}

export function ExamList({ items, today, decks, onNew, onOpenDeck, onEdit, onDelete }: {
  items: readonly PlanItem[]; today: string; decks: readonly DeckSummary[];
  onNew: () => void; onOpenDeck: (deckId: string) => void; onEdit: (item: PlanItem) => void; onDelete: (item: PlanItem) => void;
}) {
  const { upcoming, past } = splitExams(items.filter((i) => i.kind === "exam"), today);
  const card = (e: PlanItem) => (
    <ExamCard key={e.id} exam={e} today={today} decks={decks} onOpenDeck={onOpenDeck} onEdit={() => onEdit(e)} onDelete={() => onDelete(e)} />
  );
  return (
    <View style={styles.list}>
      {upcoming.length ? upcoming.map(card) : (
        <EmptyState title={EXAM_EMPTY.title} message={EXAM_EMPTY.message} action={<Button title={EXAM_EMPTY.action} onPress={onNew} />} />
      )}
      {past.length ? <Disclosure title={`Vergangene Klausuren (${past.length})`}>{past.map(card)}</Disclosure> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  card: { gap: spacing.md },
  top: { flexDirection: "row", gap: spacing.md },
  count: { width: 92, minHeight: 88, alignItems: "center", justifyContent: "center", gap: 2, padding: spacing.sm, borderRadius: radius.field, borderCurve: "continuous" },
  longBig: { fontSize: 18 },
  main: { flex: 1, minWidth: 0, gap: spacing.xs },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md },
  action: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: spacing.xs },
});
