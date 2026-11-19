/* Karteikarten – Stapelliste. Web-Quelle: karteikarten.js renderList/deckRow, karteikarten.css (.kk-hero, .kk-deck, .kk-go) (Web-Commit 770dbe4). */
import { Pressable, StyleSheet, View } from "react-native";
import { MAX_DECKS, dueCount, isLevelMode } from "../core";
import type { Deck } from "../core";
import { deckMeta, goLabel, listStats } from "../session-model";
import type { SaveStatus } from "../session-model";
import type { KarteikartenData } from "../store";
import { radius, spacing, squircleRadius, usePensumTheme } from "../../../theme";
import { AppText, Button, Card, Panel } from "../../../ui";
import { EmptyCard, LevelBar, SaveNote, StatTile, useWide } from "./common";

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
  const wide = useWide();
  const stats = listStats(data);
  return (
    <View style={styles.page}>
      <Panel style={styles.hero}>
        <View style={styles.top}>
          <AppText variant="h1" accessibilityRole="header" style={[styles.heroTitle, wide ? { fontSize: 40, lineHeight: 46 } : { fontSize: 32, lineHeight: 37 }]}>Karteikarten.</AppText>
          <Button title="+ Neuer Stapel" onPress={onNewDeck} disabled={stats.full} />
        </View>
        <View style={styles.stats}>
          <StatTile value={stats.decks} label="Stapel" />
          <StatTile value={String(stats.cards)} label="Karten" />
          <StatTile value={String(stats.due)} label="zu lernen" />
        </View>
        <SaveNote signedIn={signedIn} status={saveStatus} onLogin={onLogin} />
        <View style={[styles.banner, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
          <View style={[styles.bannerDot, { backgroundColor: colors.ink }]}>
            <AppText variant="caption" style={[styles.bannerDotText, { color: colors.onPrimary }]}>{stats.due ? String(stats.due) : "✓"}</AppText>
          </View>
          <AppText variant="bodySm" style={styles.bannerText}>{stats.banner}</AppText>
        </View>
      </Panel>

      {data.decks.length ? (
        <View style={styles.decks} accessibilityLabel="Deine Stapel">
          {data.decks.map((deck) => <DeckRow key={deck.id} deck={deck} onOpen={onOpen} onQuickStart={onQuickStart} />)}
          {stats.full ? <AppText variant="bodySm" tone="muted" style={styles.center}>Du hast die maximal {MAX_DECKS} Stapel angelegt. Lösche einen, um einen neuen zu erstellen.</AppText> : null}
        </View>
      ) : (
        <EmptyCard
          title="Noch keine Vokabelstapel."
          message="Lege bis zu 5 Stapel an, füge Karten mit Vorder- und Rückseite hinzu und lerne sie mit Leveln oder der Reihe nach."
          actionLabel="Ersten Stapel erstellen"
          onAction={onNewDeck}
        />
      )}
    </View>
  );
}

function DeckRow({ deck, onOpen, onQuickStart }: { deck: Deck; onOpen: (id: string) => void; onQuickStart: (deck: Deck) => void }) {
  const { colors } = usePensumTheme();
  const label = goLabel(deck);
  const empty = !deck.cards.length;
  return (
    <Card style={styles.deck}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${deck.name}, ${deckMeta(deck)}`} onPress={() => onOpen(deck.id)} style={styles.deckOpen}>
        <View style={[styles.squircle, { backgroundColor: colors.ink }]}>
          <AppText variant="h3" style={[styles.initial, { color: colors.onPrimary }]}>{(deck.name[0] ?? "?").toUpperCase()}</AppText>
        </View>
        <View style={styles.grow}>
          <AppText variant="h4" numberOfLines={2} style={styles.deckName}>{deck.name}</AppText>
          <AppText variant="bodySm" tone="muted" style={styles.deckMeta}>{deckMeta(deck)}</AppText>
          {isLevelMode(deck) ? <LevelBar deck={deck} /> : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${deck.name} lernen, ${dueCount(deck)} Karten`}
        disabled={empty}
        onPress={() => onQuickStart(deck)}
        style={({ pressed }) => [styles.go, { borderColor: colors.ink, backgroundColor: pressed ? colors.ink : "transparent", opacity: empty ? 0.35 : 1 }]}
      >
        {({ pressed }) => (
          <AppText variant="h4" style={[styles.goText, { color: pressed ? colors.onPrimary : colors.ink }]}>{label ?? "→"}</AppText>
        )}
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  grow: { flex: 1, minWidth: 0 },
  center: { textAlign: "center" },
  hero: { gap: spacing.xl },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.lg },
  heroTitle: { flexShrink: 1 },
  stats: { flexDirection: "row", gap: spacing.md },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1 },
  bannerDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bannerDotText: { fontSize: 13, lineHeight: 16, fontWeight: "600" },
  bannerText: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "600" },
  decks: { gap: spacing.md },
  deck: { flexDirection: "row", alignItems: "center", gap: spacing.lg, padding: spacing.lg },
  deckOpen: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.lg, minWidth: 0 },
  squircle: { width: 64, height: 64, borderRadius: squircleRadius(64), borderCurve: "continuous", alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 24, lineHeight: 28 },
  deckName: { fontSize: 18, lineHeight: 23 },
  deckMeta: { marginTop: 2 },
  go: { width: 56, height: 56, borderRadius: radius.pill, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  goText: { fontSize: 18, lineHeight: 22, fontVariant: ["tabular-nums"] },
});
