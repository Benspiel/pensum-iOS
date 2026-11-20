/* Karteikarten – Stapelansicht mit Tabs Lernen / Karten / Hinzufügen. Web-Quelle: karteikarten.js renderDeck, noCardsHtml, karteikarten.css (.kk-bar, .kk-hero, .kk-add, .kk-row) (Web-Commit 770dbe4). */
import { useRef, useState } from "react";
import type { ComponentRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { dueCount, isLevelMode, MODES } from "../core";
import type { Card, Deck, StudyType } from "../core";
import { deckMeta, plural } from "../session-model";
import type { DeckTab } from "../session-model";
import type { ActionResult } from "../hooks";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { AppText, Button, Field, Panel, Segmented } from "../../../ui";
import { EmptyCard, FormMessage, IconButton, LevelBoxes, StatTile, SYMBOLS, TitleBar, useWide } from "./common";
import { StartButtons } from "./Dialogs";
import { kiVisibleFor } from "../ki/cards";
import type { KiState } from "../ki/cards";
import { KiBlock } from "../ki/KiBlock";

interface Props {
  deck: Deck;
  tab: DeckTab;
  onTab: (t: DeckTab) => void;
  /** Ohne `onBack` (Detailspalte auf dem iPad, Stapelliste steht daneben) gibt es keinen Zurück-Knopf. */
  onBack?: () => void;
  onEditDeck: () => void;
  onStart: (type: StudyType) => void;
  onAddCard: (front: string, back: string) => ActionResult;
  onEditCard: (card: Card) => void;
  onDeleteCard: (card: Card) => void;
  /** KI-Vorschlag (nur Ki-Tester); wird nur im Stapel gezeigt, für den die KI gefragt wurde. */
  ki?: KiState;
  onKiToggle?: (index: number) => void;
  onKiAdd?: () => void;
  onKiDiscard?: () => void;
}

export function DeckView({ deck, tab, onTab, onBack, onEditDeck, onStart, onAddCard, onEditCard, onDeleteCard, ki = null, onKiToggle, onKiAdd, onKiDiscard }: Props) {
  const level = isLevelMode(deck);
  const due = dueCount(deck);
  const tabs = [
    { id: "learn" as const, label: "Lernen" },
    { id: "cards" as const, label: `Karten (${deck.cards.length})` },
    { id: "add" as const, label: "Hinzufügen" },
  ];
  const noCards = (
    <EmptyCard compact title="Noch keine Karten." message="Füge deine erste Vokabel mit Vorder- und Rückseite hinzu." actionLabel="Erste Karte hinzufügen" onAction={() => onTab("add")} />
  );
  return (
    <View style={styles.page}>
      <TitleBar title={deck.name} onBack={onBack} backLabel="Zurück zu allen Stapeln" onAction={onEditDeck} actionLabel="Stapel bearbeiten" />
      {ki && kiVisibleFor(ki, deck.id) ? <KiBlock state={ki} onToggle={(i) => onKiToggle?.(i)} onAdd={() => onKiAdd?.()} onDiscard={() => onKiDiscard?.()} /> : null}
      <Segmented label="Bereiche des Stapels" role="tablist" options={tabs} value={tab} onChange={onTab} />
      {tab === "learn" ? (
        <Panel style={styles.hero}>
          {level ? <LevelBoxes deck={deck} /> : (
            <View style={styles.stats}>
              <StatTile value={String(deck.cards.length)} label="Karten" />
              <StatTile value={MODES.all.label.split(" ")[0] ?? "Alle"} label="Abfrage" />
              <StatTile value={String(deck.cards.length)} label="zu lernen" />
            </View>
          )}
          <AppText variant="bodySm" tone="muted">{deckMeta(deck)}{level ? ` · ${plural(due, "Karte", "Karten")} zu lernen` : ""}</AppText>
          <StartButtons onStart={onStart} disabled={!deck.cards.length} compact={!onBack} />
          {deck.cards.length ? null : noCards}
        </Panel>
      ) : tab === "add" ? (
        <AddForm onAdd={onAddCard} />
      ) : deck.cards.length ? (
        <View style={styles.cards} accessibilityLabel="Karten im Stapel">
          {deck.cards.map((c) => <CardRow key={c.id} card={c} level={level} onEdit={onEditCard} onDelete={onDeleteCard} />)}
        </View>
      ) : noCards}
    </View>
  );
}

/** Eine Karte der Liste (Web: .kk-row – Haarlinie, Radius 16, Beschriftung klein in Versalien, Symbolknöpfe). */
function CardRow({ card, level, onEdit, onDelete }: { card: Card; level: boolean; onEdit: (card: Card) => void; onDelete: (card: Card) => void }) {
  const { colors } = usePensumTheme();
  const wide = useWide();
  return (
    <View style={[styles.row, { backgroundColor: colors.canvas, borderColor: colors.hairlineSoft }]}>
      <View style={[styles.rowTexts, wide && styles.rowTextsWide]}>
        <View style={[styles.rowText, wide && styles.grow]}>
          <AppText variant="label" tone="muted" style={styles.rowLabel}>Vorderseite</AppText>
          <AppText>{card.front}</AppText>
        </View>
        <View style={[styles.rowText, wide && styles.grow]}>
          <AppText variant="label" tone="muted" style={styles.rowLabel}>{`Rückseite${level ? ` · Level ${card.level}` : ""}`}</AppText>
          <AppText>{card.back}</AppText>
        </View>
      </View>
      <View style={styles.rowActions}>
        <IconButton symbol={SYMBOLS.edit} label="Karte bearbeiten" haptic="open" onPress={() => onEdit(card)} />
        <IconButton symbol={SYMBOLS.trash} label="Karte löschen" haptic="warn" onPress={() => onDelete(card)} />
      </View>
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
    <Panel style={styles.add}>
      <Field ref={frontRef} label="Vorderseite" value={front} onChangeText={setFront} maxLength={1000} multiline placeholder="Frage oder Begriff" style={styles.textarea} />
      <Field label="Rückseite" value={back} onChangeText={setBack} maxLength={1000} multiline placeholder="Antwort" style={styles.textarea} />
      {error ? <FormMessage text={error} /> : null}
      <Button
        title="Karte hinzufügen"
        haptic="send"
        onPress={() => {
          const r = onAdd(front, back);
          if (!r.ok) { setError(r.error); return; }
          setError("");
          setFront("");
          setBack("");
          frontRef.current?.focus();
        }}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  hero: { gap: spacing.xl },
  stats: { flexDirection: "row", gap: spacing.md },
  cards: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingLeft: spacing.lg, paddingRight: spacing.sm, borderWidth: 1, borderRadius: radius.field, borderCurve: "continuous" },
  rowTexts: { flex: 1, minWidth: 0, gap: spacing.md },
  rowTextsWide: { flexDirection: "row" },
  rowText: { minWidth: 0, gap: 2 },
  grow: { flex: 1 },
  rowLabel: { fontSize: 11, lineHeight: 15, letterSpacing: 0.44, textTransform: "uppercase" },
  rowActions: { flexDirection: "row", alignItems: "center" },
  add: { padding: spacing.lg, gap: spacing.md },
  textarea: { minHeight: 96 },
});
