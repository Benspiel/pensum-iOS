/* Karteikarten – Ladeschritt, Lernrunde (Üben/Test) und Ergebnis.
 * Web-Quelle: karteikarten.js renderLoading, renderStudy, studyControls, renderResult (Web-Commit 770dbe4). Texte wörtlich.
 * Ohne Wegfliegen-Animation und Haptik (Auftrag Phase 2); „reduzierte Bewegung“ verkürzt nur den Ladeschritt (hooks.ts). */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { isLevelMode } from "../core";
import type { Deck } from "../core";
import { currentCard, loadingSubtitle, loadingTitle, progressPercent, resultTexts, roundBadge } from "../session-model";
import type { Round } from "../session-model";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { AppText, Button, Card, Field, LoadingState } from "../../../ui";
import { LevelBoxes } from "./common";

export function LoadingRound({ deck, round, count }: { deck: Deck | undefined; round: Round; count: number }) {
  return (
    <View style={styles.page}>
      <LoadingState title={loadingTitle(round.type)} />
      <AppText tone="muted" style={styles.center}>{loadingSubtitle(deck ? deck.name : "", count)}</AppText>
    </View>
  );
}

interface StudyProps {
  deck: Deck;
  round: Round;
  onQuit: () => void;
  onFlip: () => void;
  onCheck: (given: string) => void;
  onOverride: () => void;
  onGrade: (ok: boolean) => void;
  onNext: () => void;
}

export function StudyView({ deck, round, onQuit, onFlip, onCheck, onOverride, onGrade, onNext }: StudyProps) {
  const { colors } = usePensumTheme();
  const card = currentCard(deck, round);
  if (!card) return null;
  const pct = progressPercent(round);
  const fb = round.feedback;
  const test = round.type === "test";
  const showBack = !test && round.flipped;
  const faceColor = fb ? (fb.ok ? colors.accentSurface : colors.dangerSurface) : colors.surface;

  return (
    <View style={styles.page}>
      <View style={styles.bar}>
        <Button title="✕" accessibilityLabel="Lernrunde beenden" variant="plain" onPress={onQuit} />
        <View
          style={[styles.track, { backgroundColor: colors.border }]}
          accessibilityRole="progressbar"
          accessibilityLabel="Fortschritt"
          accessibilityValue={{ min: 0, max: 100, now: pct }}
        >
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.ink }]} />
        </View>
        <View style={[styles.badge, { backgroundColor: colors.surface }]}>
          <AppText variant="caption">{roundBadge(deck, round, card)}</AppText>
        </View>
      </View>

      <Pressable
        disabled={test || round.flipped}
        onPress={onFlip}
        accessibilityRole={test ? undefined : "button"}
        accessibilityLabel={test ? `Vorderseite: ${card.front}` : showBack ? `Rückseite: ${card.back}` : `Vorderseite: ${card.front}. Karte umdrehen`}
      >
        <Card style={[styles.face, { backgroundColor: faceColor }]}>
          <AppText variant="caption" tone="muted">{showBack ? "Rückseite" : "Vorderseite"}</AppText>
          <AppText variant="display" style={styles.faceText} adjustsFontSizeToFit minimumFontScale={0.5}>{showBack ? card.back : card.front}</AppText>
          {!test && !round.flipped ? <AppText variant="caption" tone="muted">Tippen zum Umdrehen</AppText> : null}
        </Card>
      </Pressable>

      {test ? (
        fb ? (
          <View style={styles.page} accessibilityLiveRegion="polite">
            {fb.ok ? null : <AppText tone="danger" variant="label">{`Richtig wäre: ${card.back}`}</AppText>}
            <View style={styles.actions}>
              {fb.ok ? null : <Button title="Trotzdem richtig" variant="secondary" onPress={onOverride} />}
              <Button title="Weiter" onPress={onNext} />
            </View>
          </View>
        ) : <AnswerForm key={card.id + round.queue.length} onCheck={onCheck} />
      ) : round.flipped ? (
        <View style={styles.actions}>
          <Button title="Nicht gewusst" variant="secondary" onPress={() => onGrade(false)} />
          <Button title="Gewusst" onPress={() => onGrade(true)} />
        </View>
      ) : <Button title="Umdrehen" onPress={onFlip} />}
    </View>
  );
}

function AnswerForm({ onCheck }: { onCheck: (given: string) => void }) {
  const [answer, setAnswer] = useState("");
  return (
    <View style={styles.page}>
      <Field
        label="Deine Antwort"
        value={answer}
        onChangeText={setAnswer}
        placeholder="Antwort eintippen"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="done"
        onSubmitEditing={() => onCheck(answer)}
      />
      <Button title="Prüfen" onPress={() => onCheck(answer)} />
    </View>
  );
}

export function ResultView({ deck, round, onToDeck, onAgain, onRetryWrong }: {
  deck: Deck;
  round: Round;
  onToDeck: () => void;
  onAgain: () => void;
  onRetryWrong: () => void;
}) {
  const t = resultTexts(deck, round);
  return (
    <View style={styles.page}>
      <View style={styles.bar}>
        <Button title="‹ Zurück" accessibilityLabel="Zurück zum Stapel" variant="plain" onPress={onToDeck} />
      </View>
      <AppText variant="title" accessibilityRole="header">{deck.name}</AppText>
      <Card>
        <AppText variant="display" style={styles.center}>{t.big}</AppText>
        <AppText variant="section" style={styles.center}>{t.title}</AppText>
        <AppText tone="muted" style={styles.center}>{t.text}</AppText>
        {t.boxes && isLevelMode(deck) ? <LevelBoxes deck={deck} /> : null}
      </Card>
      <View style={styles.actions}>
        {t.retry ? <Button title="Falsche nochmal" variant="secondary" onPress={onRetryWrong} /> : null}
        <Button title="Nochmal lernen" variant="secondary" onPress={onAgain} />
        <Button title="Zum Stapel" onPress={onToDeck} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  center: { textAlign: "center" },
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  track: { flex: 1, height: 8, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
  badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  face: { minHeight: 240, alignItems: "center", justifyContent: "center", gap: spacing.md },
  faceText: { textAlign: "center", fontSize: 32, letterSpacing: 0 },
  actions: { gap: spacing.sm },
});
