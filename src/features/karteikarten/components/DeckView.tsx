/* Karteikarten – Stapelansicht mit Tabs Lernen / Karten / Hinzufügen. Web-Quelle: karteikarten.js renderDeck, noCardsHtml (Web-Commit 770dbe4). */
import { useRef, useState } from "react";
import type { ComponentRef } from "react";
import { StyleSheet, View } from "react-native";
import { TextInput } from "react-native";
import { dueCount, isLevelMode, MODES } from "../core";
import type { Card, Deck, StudyType } from "../core";
import { deckMeta, plural } from "../session-model";
import type { DeckTab } from "../session-model";
import type { ActionResult } from "../hooks";
import { spacing, usePensumTheme } from "../../../theme";
import { AppText, Button, Card as Box, EmptyState, Field } from "../../../ui";
import { LevelBoxes, Tabs } from "./common";
import { StartButtons } from "./Dialogs";

interface Props {
  deck: Deck;
  tab: DeckTab;
  onTab: (t: DeckTab) => void;
  onBack: () => void;
  onEditDeck: () => void;
  onStart: (type: StudyType) => void;
  onAddCard: (front: string, back: string) => ActionResult;
  onEditCard: (card: Card) => void;
  onDeleteCard: (card: Card) => void;
}

export function DeckView({ deck, tab, onTab, onBack, onEditDeck, onStart, onAddCard, onEditCard, onDeleteCard }: Props) {
  const level = isLevelMode(deck);
  const due = dueCount(deck);
  const tabs: Array<[DeckTab, string]> = [["learn", "Lernen"], ["cards", `Karten (${deck.cards.length})`], ["add", "Hinzufügen"]];
  const noCards = (
    <EmptyState title="Noch keine Karten." message="Füge deine erste Vokabel mit Vorder- und Rückseite hinzu." action={<Button title="Erste Karte hinzufügen" onPress={() => onTab("add")} />} />
  );
  return (
    <View style={styles.page}>
      <View style={styles.bar}>
        <Button title="‹ Zurück" accessibilityLabel="Zurück zu allen Stapeln" variant="plain" onPress={onBack} />
        <View style={styles.grow} />
        <Button title="Bearbeiten" accessibilityLabel="Stapel bearbeiten" variant="plain" onPress={onEditDeck} />
      </View>
      <AppText variant="title" accessibilityRole="header">{deck.name}</AppText>
      <Tabs tabs={tabs} value={tab} onChange={onTab} />
      {tab === "learn" ? (
        <Box>
          {level ? <LevelBoxes deck={deck} /> : (
            <View style={styles.stats}>
              <Stat value={String(deck.cards.length)} label="Karten" />
              <Stat value={MODES.all.label.split(" ")[0] ?? "Alle"} label="Abfrage" />
              <Stat value={String(deck.cards.length)} label="zu lernen" />
            </View>
          )}
          <AppText variant="caption" tone="muted">{deckMeta(deck)}{level ? ` · ${plural(due, "Karte", "Karten")} zu lernen` : ""}</AppText>
          <StartButtons onStart={onStart} disabled={!deck.cards.length} />
          {deck.cards.length ? null : noCards}
        </Box>
      ) : tab === "add" ? (
        <AddForm onAdd={onAddCard} />
      ) : deck.cards.length ? (
        <View style={styles.cards} accessibilityLabel="Karten im Stapel">
          {deck.cards.map((c) => (
            <Box key={c.id}>
              <View>
                <AppText variant="caption" tone="muted">Vorderseite</AppText>
                <AppText>{c.front}</AppText>
              </View>
              <View>
                <AppText variant="caption" tone="muted">{`Rückseite${level ? ` · Level ${c.level}` : ""}`}</AppText>
                <AppText>{c.back}</AppText>
              </View>
              <View style={styles.actions}>
                <Button title="Bearbeiten" accessibilityLabel="Karte bearbeiten" variant="secondary" onPress={() => onEditCard(c)} />
                <Button title="Löschen" accessibilityLabel="Karte löschen" variant="danger" onPress={() => onDeleteCard(c)} />
              </View>
            </Box>
          ))}
        </View>
      ) : noCards}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = usePensumTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.canvas }]} accessible accessibilityLabel={`${value} ${label}`}>
      <AppText variant="section">{value}</AppText>
      <AppText variant="caption" tone="muted">{label}</AppText>
    </View>
  );
}

/** Formular „Hinzufügen“: nach dem Hinzufügen bleiben die Felder leer und der Fokus liegt wieder auf der Vorderseite. */
function AddForm({ onAdd }: { onAdd: (front: string, back: string) => ActionResult }) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState("");
  const frontRef = useRef<ComponentRef<typeof TextInput>>(null);
  return (
    <Box>
      <Field ref={frontRef} label="Vorderseite" value={front} onChangeText={setFront} maxLength={1000} multiline placeholder="Frage oder Begriff" />
      <Field label="Rückseite" value={back} onChangeText={setBack} maxLength={1000} multiline placeholder="Antwort" />
      {error ? <AppText tone="danger" accessibilityRole="alert">{error}</AppText> : null}
      <Button
        title="Karte hinzufügen"
        onPress={() => {
          const r = onAdd(front, back);
          if (!r.ok) { setError(r.error); return; }
          setError("");
          setFront("");
          setBack("");
          frontRef.current?.focus();
        }}
      />
    </Box>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  bar: { flexDirection: "row", alignItems: "center" },
  grow: { flex: 1 },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, alignItems: "center", padding: spacing.md, borderRadius: 16 },
  cards: { gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
});
