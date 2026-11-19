/* Karteikarten – Stapelliste. Web-Quelle: karteikarten.js renderList/deckRow (Web-Commit 770dbe4). */
import { Pressable, StyleSheet, View } from "react-native";
import { MAX_DECKS, dueCount, isLevelMode } from "../core";
import type { Deck } from "../core";
import { deckMeta, goLabel, listStats } from "../session-model";
import type { SaveStatus } from "../session-model";
import type { KarteikartenData } from "../store";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { AppText, Button, Card, EmptyState } from "../../../ui";
import { LevelBar, SaveNote } from "./common";

interface Props {
  data: KarteikartenData;
  signedIn: boolean;
  saveStatus: SaveStatus;
  onLogin: () => void;
  onNewDeck: () => void;
  onOpen: (id: string) => void;
  onQuickStart: (deck: Deck) => void;
}

export function DeckList({ data, signedIn, saveStatus, onLogin, onNewDeck, onOpen, onQuickStart }: Props) {
  const { colors } = usePensumTheme();
  const stats = listStats(data);
  return (
    <View style={styles.page}>
      <Card style={{ backgroundColor: colors.surface }}>
        <View style={styles.top}>
          <AppText variant="title" accessibilityRole="header" style={styles.grow}>Karteikarten.</AppText>
        </View>
        <Button title="+ Neuer Stapel" onPress={onNewDeck} disabled={stats.full} />
        <View style={styles.stats}>
          <Stat value={stats.decks} label="Stapel" />
          <Stat value={String(stats.cards)} label="Karten" />
          <Stat value={String(stats.due)} label="zu lernen" />
        </View>
        <SaveNote signedIn={signedIn} status={saveStatus} onLogin={onLogin} />
        <View style={[styles.banner, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
          <View style={[styles.bannerDot, { backgroundColor: colors.ink }]}>
            <AppText variant="caption" style={{ color: colors.onPrimary }}>{stats.due ? String(stats.due) : "✓"}</AppText>
          </View>
          <AppText variant="label" style={styles.grow}>{stats.banner}</AppText>
        </View>
      </Card>

      {data.decks.length ? (
        <View style={styles.decks} accessibilityLabel="Deine Stapel">
          {data.decks.map((deck) => <DeckRow key={deck.id} deck={deck} onOpen={onOpen} onQuickStart={onQuickStart} />)}
          {stats.full ? <AppText tone="muted" style={styles.center}>Du hast die maximal {MAX_DECKS} Stapel angelegt. Lösche einen, um einen neuen zu erstellen.</AppText> : null}
        </View>
      ) : (
        <EmptyState
          title="Noch keine Vokabelstapel."
          message="Lege bis zu 5 Stapel an, füge Karten mit Vorder- und Rückseite hinzu und lerne sie mit Leveln oder der Reihe nach."
          action={<Button title="Ersten Stapel erstellen" onPress={onNewDeck} />}
        />
      )}
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

function DeckRow({ deck, onOpen, onQuickStart }: { deck: Deck; onOpen: (id: string) => void; onQuickStart: (deck: Deck) => void }) {
  const { colors } = usePensumTheme();
  const label = goLabel(deck);
  return (
    <Card style={styles.deck}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${deck.name}, ${deckMeta(deck)}`} onPress={() => onOpen(deck.id)} style={styles.deckOpen}>
        <View style={[styles.squircle, { backgroundColor: colors.surface }]}>
          <AppText variant="section">{(deck.name[0] ?? "?").toUpperCase()}</AppText>
        </View>
        <View style={styles.grow}>
          <AppText variant="section" numberOfLines={2}>{deck.name}</AppText>
          <AppText variant="caption" tone="muted">{deckMeta(deck)}</AppText>
          {isLevelMode(deck) ? <LevelBar deck={deck} /> : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${deck.name} lernen, ${dueCount(deck)} Karten`}
        disabled={!deck.cards.length}
        onPress={() => onQuickStart(deck)}
        style={[styles.go, { borderColor: colors.ink, opacity: deck.cards.length ? 1 : 0.35 }]}
      >
        <AppText variant="section">{label ?? "→"}</AppText>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  grow: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center" },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, alignItems: "center", padding: spacing.md, borderRadius: radius.field, borderCurve: "continuous" },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  bannerDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  decks: { gap: spacing.sm },
  deck: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  deckOpen: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, minWidth: 0 },
  squircle: { width: 56, height: 56, borderRadius: radius.field, borderCurve: "continuous", alignItems: "center", justifyContent: "center" },
  go: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
});
