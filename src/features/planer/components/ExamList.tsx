/* Planer – Tab „Klausuren“: Karten mit Countdown, Link zu Karteikarten, Leerzustand, vergangene Klausuren (Web: .pl-exam, .pl-count, .pl-empty). */
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, Badge, Button, Card, TintContext } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { splitExams, type PlanItem } from "../core";
import { resolveDeck, type DeckSummary } from "../links";
import { EXAM_EMPTY, examCardModel } from "../model";
import { Disclosure } from "../../../ui/Disclosure";
import { Empty } from "./Empty";
import { IconButton } from "./IconButton";

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
    <TintContext.Provider value={false}>
      <Card style={styles.card}>
        <View
          accessible
          accessibilityLabel={`${m.big} ${m.small}`}
          style={[styles.count, { backgroundColor: hot ? colors.ink : colors.surface, opacity: m.state === "past" ? 0.6 : 1 }]}
        >
          <AppText variant="h3" style={[styles.big, { color: fg }, m.longBig && styles.longBig]} numberOfLines={1} adjustsFontSizeToFit>{m.big}</AppText>
          <AppText variant="caption" style={{ color: hot ? colors.onPrimary : colors.muted, opacity: hot ? 0.8 : 1 }} numberOfLines={2}>{m.small}</AppText>
        </View>
        <View style={styles.main}>
          <AppText variant="link">{exam.title}</AppText>
          <View style={styles.meta}>
            {exam.subject ? <Badge label={exam.subject} style={styles.badge} /> : null}
            <AppText variant="caption" style={[styles.small, { color: colors.mutedOnCanvas }]}>{m.dateText}</AppText>
          </View>
          {exam.note ? <AppText variant="caption" style={[styles.small, { color: colors.mutedOnCanvas }]}>{exam.note}</AppText> : null}
          <View style={styles.actions}>
            {deck ? <Button title="Karteikarten lernen" size="sm" accessibilityHint={`Öffnet den Stapel ${deck.name}`} onPress={() => onOpenDeck(deck.id)} /> : null}
            <View style={styles.icons}>
              <IconButton symbol="pencil" fallback="✎" label={`Bearbeiten: ${exam.title}`} haptic="open" onPress={onEdit} />
              <IconButton symbol="trash" fallback="✕" label={`Löschen: ${exam.title}`} hint="Destruktive Aktion" haptic={false} onPress={onDelete} />
            </View>
          </View>
        </View>
      </Card>
    </TintContext.Provider>
  );
}

export function ExamList({ items, today, decks, header, onNew, onOpenDeck, onEdit, onDelete }: {
  items: readonly PlanItem[]; today: string; decks: readonly DeckSummary[];
  /** Kopfzeile über der Liste (iPad ohne Tabs: Überschrift mit „+ Neue Klausur“) */
  header?: ReactNode;
  onNew: () => void; onOpenDeck: (deckId: string) => void; onEdit: (item: PlanItem) => void; onDelete: (item: PlanItem) => void;
}) {
  const { upcoming, past } = splitExams(items.filter((i) => i.kind === "exam"), today);
  const card = (e: PlanItem) => (
    <ExamCard key={e.id} exam={e} today={today} decks={decks} onOpenDeck={onOpenDeck} onEdit={() => onEdit(e)} onDelete={() => onDelete(e)} />
  );
  return (
    <View style={styles.list}>
      {header}
      {upcoming.length ? <View style={styles.cards}>{upcoming.map(card)}</View> : (
        <Empty title={EXAM_EMPTY.title} message={EXAM_EMPTY.message} action={<Button title={EXAM_EMPTY.action} onPress={onNew} />} />
      )}
      {past.length ? <Disclosure title={`Vergangene Klausuren (${past.length})`}>{past.map(card)}</Disclosure> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  cards: { gap: spacing.md },
  /** Web `.pl-exam`: Zähler (88 px) links, Inhalt rechts, Innenabstand 16 */
  card: { flexDirection: "row", gap: spacing.lg, padding: spacing.lg },
  count: { width: 88, minHeight: 88, alignSelf: "flex-start", alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: spacing.xs, borderRadius: radius.field, borderCurve: "continuous" },
  big: { fontSize: 30, lineHeight: 30, textAlign: "center", fontVariant: ["tabular-nums"] },
  longBig: { fontSize: 20, lineHeight: 20 },
  main: { flex: 1, minWidth: 0, gap: spacing.sm },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  badge: { minHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  icons: { flexDirection: "row", marginLeft: "auto" },
});
