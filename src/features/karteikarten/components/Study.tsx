/* Karteikarten – Ladeschritt, Lernrunde (Üben/Test) und Ergebnis.
 * Web-Quelle: karteikarten.js renderLoading, renderStudy, studyControls, renderResult und karteikarten.css (.kk-stage, .kk-face, .kk-summary) (Web-Commit 770dbe4). Texte wörtlich.
 * Karte dreht sich beim Umdrehen (rotateY, Rückseite = Ink-Fläche) und fliegt nach dem Bewerten weg (richtig nach rechts, falsch nach links),
 * wie .is-flipped und .out-ok/.out-bad im Web; bei „reduzierte Bewegung“ entfallen die Effekte und der Ladeschritt ist kürzer (hooks.ts). */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { isLevelMode } from "../core";
import type { Deck } from "../core";
import { STUDY_MAX_WIDTH, studyCardMinHeight, studyFaceFontSize } from "../layout";
import { currentCard, loadingSubtitle, loadingTitle, progressPercent, resultTexts, roundBadge } from "../session-model";
import type { Round } from "../session-model";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { AppText, Badge, Button, Field, Panel } from "../../../ui";
import { IconButton, LevelBoxes, LoadingPanel, SYMBOLS, TitleBar } from "./common";

export function LoadingRound({ deck, round, count, reduceMotion = false }: { deck: Deck | undefined; round: Round; count: number; reduceMotion?: boolean }) {
  return (
    <View style={styles.centered}>
      <LoadingPanel title={loadingTitle(round.type)} subtitle={loadingSubtitle(deck ? deck.name : "", count)} reduceMotion={reduceMotion} />
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
  reduceMotion?: boolean;
}

/** Lässt die Karte wegfliegen, sobald `leaving` gesetzt ist, und meldet danach `onGone`. Neue Karte = neuer Schlüssel = frischer Zustand. */
function FlyAway({ leaving, reduceMotion, onGone, children }: { leaving: boolean | null; reduceMotion: boolean; onGone: () => void; children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const gone = useRef(onGone);
  gone.current = onGone;
  useEffect(() => {
    if (leaving === null) return undefined;
    if (reduceMotion) { gone.current(); return undefined; }
    const anim = Animated.timing(progress, { toValue: 1, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true });
    anim.start(({ finished }) => { if (finished) gone.current(); });
    return () => anim.stop();
  }, [leaving, reduceMotion, progress]);
  const dir = leaving === false ? -1 : 1;
  return (
    <Animated.View
      style={{
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, dir * width] }) },
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${dir * 14}deg`] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Eine Seite der Lernkarte: Beschriftung in Versalien, großer Text, optional Hinweis (Web: .kk-face). */
function FaceContent({ tag, text, hint, color }: { tag: string; text: string; hint?: string; color?: string }) {
  const { width } = useWindowDimensions();
  const size = studyFaceFontSize(width);
  return (
    <>
      <AppText variant="label" style={[styles.tag, color ? { color } : null]}>{tag}</AppText>
      <AppText variant="h3" style={[styles.faceText, { fontSize: size, lineHeight: Math.round(size * 1.2) }, color ? { color } : null]}>{text}</AppText>
      {hint ? <AppText variant="caption" style={[styles.hint, color ? { color } : null]}>{hint}</AppText> : null}
    </>
  );
}

/** Die Karte: Vorderseite = getönte Fläche, Rückseite = Ink-Fläche; sie dreht sich um die senkrechte Achse (Web: .kk-flip, perspective 1400). */
function FlipCard({ front, back, flipped, reduceMotion, minHeight, hint }: { front: string; back: string | null; flipped: boolean; reduceMotion: boolean; minHeight: number; hint: boolean }) {
  const { colors } = usePensumTheme();
  const flip = useRef(new Animated.Value(flipped ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) { flip.setValue(flipped ? 1 : 0); return undefined; }
    const anim = Animated.timing(flip, { toValue: flipped ? 1 : 0, duration: 500, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [flipped, reduceMotion, flip]);
  const frontRotation = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotation = flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  const longest = back !== null && back.length > front.length ? back : front;
  return (
    <View style={{ minHeight }}>
      {/* Unsichtbarer Platzhalter in Höhe der längeren Seite, damit die Karte mit dem Text wächst */}
      <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[styles.face, { minHeight, opacity: 0 }]}>
        <FaceContent tag="Vorderseite" text={longest} hint={hint ? "Tippen zum Umdrehen" : undefined} />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.face, styles.hidden, { backgroundColor: colors.surface, transform: [{ perspective: 1400 }, { rotateY: frontRotation }] }]}
      >
        <FaceContent tag="Vorderseite" text={front} hint={hint ? "Tippen zum Umdrehen" : undefined} />
      </Animated.View>
      {back !== null ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.face, styles.hidden, { backgroundColor: colors.ink, transform: [{ perspective: 1400 }, { rotateY: backRotation }] }]}
        >
          <FaceContent tag="Rückseite" text={back} color={colors.onPrimary} />
        </Animated.View>
      ) : null}
    </View>
  );
}

export function StudyView({ deck, round, onQuit, onFlip, onCheck, onOverride, onGrade, onNext, reduceMotion = false }: StudyProps) {
  const { colors } = usePensumTheme();
  const { width, height } = useWindowDimensions();
  const [leaving, setLeaving] = useState<boolean | null>(null); // Bewertung der wegfliegenden Karte
  const card = currentCard(deck, round);
  if (!card) return null;
  const pct = progressPercent(round);
  const fb = round.feedback;
  const test = round.type === "test";
  const showBack = !test && round.flipped;
  const busy = leaving !== null;
  const answered = round.right + round.wrong;
  // Karte füllt wie im Web den Platz bis zu den Knöpfen (Web: flex: 1, min-height 280)
  const minHeight = studyCardMinHeight(width, height);
  /** Bewerten mit Wegfliegen: erst fliegt die Karte, dann zählt die Bewertung (im Test: „Weiter“). */
  const leave = (ok: boolean) => { if (!busy) setLeaving(ok); };
  const onGone = () => {
    const ok = leaving;
    setLeaving(null);
    if (ok === null) return;
    if (test) onNext(); else onGrade(ok);
  };

  return (
    <View style={[styles.page, styles.centered]}>
      <View style={styles.bar}>
        <IconButton symbol={SYMBOLS.close} label="Lernrunde beenden" onPress={onQuit} />
        <View
          style={[styles.track, { backgroundColor: colors.border }]}
          accessibilityRole="progressbar"
          accessibilityLabel="Fortschritt"
          accessibilityValue={{ min: 0, max: 100, now: pct }}
        >
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.ink }]} />
        </View>
        <Badge label={roundBadge(deck, round, card)} style={styles.badge} />
      </View>

      <FlyAway key={`${card.id}-${answered}`} leaving={leaving} reduceMotion={reduceMotion} onGone={onGone}>
        <Pressable
          disabled={test || round.flipped || busy}
          onPress={onFlip}
          accessibilityRole={test ? undefined : "button"}
          accessibilityLabel={test ? `Vorderseite: ${card.front}` : showBack ? `Rückseite: ${card.back}` : `Vorderseite: ${card.front}. Karte umdrehen`}
        >
          <FlipCard front={card.front} back={test ? null : card.back} flipped={showBack} reduceMotion={reduceMotion} minHeight={minHeight} hint={!test} />
        </Pressable>
      </FlyAway>

      {test ? (
        fb ? (
          <View style={styles.controls} accessibilityLiveRegion="polite">
            <View style={[styles.result, { backgroundColor: colors.surface }]}>
              <AppText style={styles.resultTitle}>{fb.ok ? "✓ Richtig" : "✗ Nicht ganz"}</AppText>
              {fb.ok ? null : <AppText style={styles.solution}>{`Richtig wäre: ${card.back}`}</AppText>}
            </View>
            <View style={styles.actions}>
              {fb.ok ? null : <Button title="Trotzdem richtig" variant="secondary" disabled={busy} onPress={onOverride} style={styles.half} />}
              <Button title="Weiter" disabled={busy} onPress={() => leave(fb.ok)} style={styles.half} />
            </View>
          </View>
        ) : <AnswerForm key={card.id + round.queue.length} onCheck={onCheck} />
      ) : round.flipped ? (
        <View style={styles.actions}>
          <Button title="Nicht gewusst" variant="secondary" disabled={busy} onPress={() => leave(false)} style={styles.half} />
          <Button title="Gewusst" disabled={busy} onPress={() => leave(true)} style={styles.half} />
        </View>
      ) : <Button title="Umdrehen" onPress={onFlip} />}
    </View>
  );
}

function AnswerForm({ onCheck }: { onCheck: (given: string) => void }) {
  const [answer, setAnswer] = useState("");
  return (
    <View style={styles.controls}>
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
    <View style={[styles.page, styles.centered]}>
      <TitleBar title={deck.name} onBack={onToDeck} backLabel="Zurück zum Stapel" />
      <Panel style={styles.summary}>
        <View style={styles.summaryTop}>
          <AppText variant="display" style={styles.big}>{t.big}</AppText>
          <AppText variant="h3" style={styles.center}>{t.title}</AppText>
          <AppText variant="bodySm" tone="muted" style={styles.center}>{t.text}</AppText>
        </View>
        {t.boxes && isLevelMode(deck) ? <View style={styles.fullWidth}><LevelBoxes deck={deck} /></View> : null}
        <View style={styles.summaryActions}>
          {t.retry ? (
            <View style={styles.actions}>
              <Button title="Falsche nochmal" variant="secondary" onPress={onRetryWrong} style={styles.half} />
              <Button title="Nochmal lernen" variant="secondary" onPress={onAgain} style={styles.half} />
            </View>
          ) : <Button title="Nochmal lernen" variant="secondary" onPress={onAgain} />}
          <Button title="Zum Stapel" onPress={onToDeck} />
        </View>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  /** iPad: Lernkarte, Ladeschritt und Ergebnis zentriert mit begrenzter Breite (auf dem Telefon ohne Wirkung) */
  centered: { width: "100%", maxWidth: STUDY_MAX_WIDTH, alignSelf: "center" },
  center: { textAlign: "center" },
  fullWidth: { alignSelf: "stretch" },
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  track: { flex: 1, height: 8, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
  badge: { alignSelf: "center" },
  face: { alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, borderRadius: radius.card, borderCurve: "continuous" },
  hidden: { backfaceVisibility: "hidden" },
  tag: { textTransform: "uppercase", letterSpacing: 0.72, opacity: 0.6, textAlign: "center" },
  faceText: { textAlign: "center" },
  hint: { fontSize: 13, opacity: 0.6, textAlign: "center" },
  controls: { gap: spacing.md },
  result: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.field, borderCurve: "continuous", gap: spacing.xs },
  resultTitle: { fontWeight: "600" },
  solution: { fontWeight: "400" },
  actions: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
  summary: { alignItems: "center", gap: spacing.xl, paddingVertical: spacing.xxl },
  summaryTop: { alignItems: "center", gap: spacing.md },
  big: { fontSize: 64, lineHeight: 64, textAlign: "center", fontVariant: ["tabular-nums"] },
  summaryActions: { alignSelf: "stretch", gap: spacing.md },
});
