/* Karteikarten – Ladeschritt, Lernrunde (Üben/Test) und Ergebnis.
 * Web-Quelle: karteikarten.js renderLoading, renderStudy, studyControls, renderResult und karteikarten.css (.kk-stage, .kk-face, .kk-summary) (Web-Commit 770dbe4). Texte wörtlich.
 * Karte dreht sich beim Umdrehen (rotateY, Rückseite = Ink-Fläche) und fliegt nach dem Bewerten weg (richtig nach rechts, falsch nach links),
 * wie .is-flipped und .out-ok/.out-bad im Web; bei „reduzierte Bewegung“ entfallen die Effekte und der Ladeschritt ist kürzer (hooks.ts).
 * Zusätzlich: Die umgedrehte Karte lässt sich nach rechts (gewusst) oder links (nicht gewusst) wischen, mit Farbe und Haptik; im Test färben
 * sich Karte und Rückmeldung grün oder rot. Die Karte füllt den freien Platz, damit sie mit der Tastatur schrumpft statt verdeckt zu werden. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, PanResponder, StyleSheet, View, useWindowDimensions } from "react-native";
import { isLevelMode } from "../core";
import type { Deck } from "../core";
import { STUDY_MAX_WIDTH, studyFaceFontSize } from "../layout";
import { currentCard, loadingSubtitle, loadingTitle, progressPercent, resultTexts, roundBadge } from "../session-model";
import type { Round } from "../session-model";
import { radius, spacing, usePensumTheme } from "../../../theme";
import { AppText, Badge, Button, Field, Panel } from "../../../ui";
import { haptic as feedback } from "../../../ui/haptics";
import { PressableScale } from "../../../ui/motion";
import { IconButton, LevelBoxes, LoadingPanel, SYMBOLS, TitleBar } from "./common";

const CARD_MIN_HEIGHT = 140;

/** Farben für richtig/falsch: Fläche und Schrift, je für hell und dunkel. */
function useVerdictColors() {
  const { colors, scheme } = usePensumTheme();
  const dark = scheme === "dark";
  return {
    okSurface: dark ? "#173a26" : "#e3f5ea",
    okInk: dark ? "#7ee2a3" : "#17803d",
    okSolid: "#1f9d55",
    badSurface: colors.dangerSurface,
    badInk: colors.danger,
    badSolid: "#d93025",
  };
}

export function LoadingRound({ deck, round, count }: { deck: Deck | undefined; round: Round; count: number }) {
  return (
    <View style={styles.centered}>
      <LoadingPanel title={loadingTitle(round.type)} subtitle={loadingSubtitle(deck ? deck.name : "", count)} />
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

/**
 * Trägt die Karte: Wischen nach rechts/links (nur wenn `swipeable`), Wegfliegen sobald `leaving` gesetzt ist, danach `onGone`.
 * Neue Karte = neuer Schlüssel = frischer Zustand.
 */
function CardMotion({ leaving, reduceMotion, onGone, swipeable, onSwipe, children }: {
  leaving: boolean | null;
  reduceMotion: boolean;
  onGone: () => void;
  swipeable: boolean;
  onSwipe: (ok: boolean) => void;
  children: ReactNode;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const verdict = useVerdictColors();
  const threshold = Math.min(120, width * 0.25);
  const gone = useRef(onGone);
  gone.current = onGone;
  const live = useRef({ swipeable, onSwipe, threshold });
  live.current = { swipeable, onSwipe, threshold };
  const past = useRef(false);

  useEffect(() => {
    if (leaving === null) return undefined;
    if (reduceMotion) { gone.current(); return undefined; }
    const anim = Animated.timing(progress, { toValue: 1, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true });
    anim.start(({ finished }) => { if (finished) gone.current(); });
    return () => anim.stop();
  }, [leaving, reduceMotion, progress]);

  useEffect(() => {
    const id = drag.addListener(({ value }) => {
      const over = Math.abs(value) >= live.current.threshold;
      if (over !== past.current) {
        past.current = over;
        if (over) feedback("select"); // kurzer Tick, sobald die Karte „einrastet“
      }
    });
    return () => drag.removeListener(id);
  }, [drag]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => live.current.swipeable && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderGrant: () => { past.current = false; },
    onPanResponderMove: (_, g) => drag.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      const far = Math.abs(g.dx) >= live.current.threshold || (Math.abs(g.vx) > 0.9 && Math.abs(g.dx) > 40);
      if (far) live.current.onSwipe(g.dx > 0);
      else Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 8 }).start();
    },
    onPanResponderTerminate: () => { Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 8 }).start(); },
  }), [drag]);

  const dir = leaving === false ? -1 : 1;
  const rightTint = drag.interpolate({ inputRange: [0, threshold], outputRange: [0, 0.55], extrapolate: "clamp" });
  const leftTint = drag.interpolate({ inputRange: [-threshold, 0], outputRange: [0.55, 0], extrapolate: "clamp" });
  return (
    <Animated.View
      {...pan.panHandlers}
      style={[
        styles.motion,
        {
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            { translateX: Animated.add(drag, progress.interpolate({ inputRange: [0, 1], outputRange: [0, dir * width] })) },
            { rotate: drag.interpolate({ inputRange: [-width, 0, width], outputRange: ["-12deg", "0deg", "12deg"] }) },
            { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${dir * 14}deg`] }) },
          ],
        },
      ]}
    >
      {children}
      {swipeable || leaving !== null ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.tint, { backgroundColor: verdict.okSolid, opacity: rightTint }]}>
            <AppText variant="h3" style={styles.tintText}>✓ Gewusst</AppText>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.tint, { backgroundColor: verdict.badSolid, opacity: leftTint }]}>
            <AppText variant="h3" style={styles.tintText}>✗ Nicht gewusst</AppText>
          </Animated.View>
        </>
      ) : null}
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
      <AppText
        variant="h3"
        numberOfLines={10}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={[styles.faceText, { fontSize: size, lineHeight: Math.round(size * 1.2) }, color ? { color } : null]}
      >{text}</AppText>
      {hint ? <AppText variant="caption" style={[styles.hint, color ? { color } : null]}>{hint}</AppText> : null}
    </>
  );
}

/** Die Karte: Vorderseite = getönte Fläche, Rückseite = Ink-Fläche; sie dreht sich um die senkrechte Achse (Web: .kk-flip, perspective 1400). */
function FlipCard({ front, back, flipped, reduceMotion, hint, verdict }: { front: string; back: string | null; flipped: boolean; reduceMotion: boolean; hint: boolean; verdict: boolean | null }) {
  const { colors } = usePensumTheme();
  const tint = useVerdictColors();
  const flip = useRef(new Animated.Value(flipped ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) { flip.setValue(flipped ? 1 : 0); return undefined; }
    const anim = Animated.timing(flip, { toValue: flipped ? 1 : 0, duration: 500, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [flipped, reduceMotion, flip]);
  // Kleiner Impuls (richtig: aufploppen, falsch: wackeln), sobald die Antwort geprüft ist
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (verdict === null || reduceMotion) return undefined;
    const anim = verdict
      ? Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 120, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }),
      ])
      : Animated.sequence([-10, 10, -7, 7, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 60, useNativeDriver: true })));
    anim.start();
    return () => anim.stop();
  }, [verdict, reduceMotion, pulse, shake]);
  const frontRotation = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotation = flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  const frontBg = verdict === true ? tint.okSurface : verdict === false ? tint.badSurface : colors.surface;
  const frontInk = verdict === true ? tint.okInk : verdict === false ? tint.badInk : undefined;
  return (
    <Animated.View style={[styles.flip, { transform: [{ scale: pulse }, { translateX: shake }] }]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.face, styles.hidden, { backgroundColor: frontBg, transform: [{ perspective: 1400 }, { rotateY: frontRotation }] }]}
      >
        <FaceContent tag="Vorderseite" text={front} hint={hint ? "Tippen zum Umdrehen" : undefined} {...(frontInk ? { color: frontInk } : {})} />
      </Animated.View>
      {back !== null ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.face, styles.hidden, { backgroundColor: colors.ink, transform: [{ perspective: 1400 }, { rotateY: backRotation }] }]}
        >
          <FaceContent tag="Rückseite" text={back} color={colors.onPrimary} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** Rückmeldung im Test: grün „Richtig“ oder rot „Nicht ganz“, poppt weich auf. */
function Verdict({ ok, solution }: { ok: boolean; solution: string }) {
  const tint = useVerdictColors();
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 9 });
    anim.start();
    return () => anim.stop();
  }, [enter]);
  return (
    <Animated.View
      style={[
        styles.result,
        {
          backgroundColor: ok ? tint.okSurface : tint.badSurface,
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
        },
      ]}
    >
      <AppText style={[styles.resultTitle, { color: ok ? tint.okInk : tint.badInk }]}>{ok ? "✓ Richtig" : "✗ Nicht ganz"}</AppText>
      {ok ? null : <AppText style={[styles.solution, { color: tint.badInk }]}>{solution}</AppText>}
    </Animated.View>
  );
}

export function StudyView({ deck, round, onQuit, onFlip, onCheck, onOverride, onGrade, onNext, reduceMotion = false }: StudyProps) {
  const { colors } = usePensumTheme();
  const [leaving, setLeaving] = useState<boolean | null>(null); // Bewertung der wegfliegenden Karte
  const card = currentCard(deck, round);
  if (!card) return null;
  const pct = progressPercent(round);
  const fb = round.feedback;
  const test = round.type === "test";
  const showBack = !test && round.flipped;
  const busy = leaving !== null;
  const answered = round.right + round.wrong;
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
        <IconButton symbol={SYMBOLS.close} label="Lernrunde beenden" haptic="close" onPress={onQuit} />
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

      <CardMotion key={`${card.id}-${answered}`} leaving={leaving} reduceMotion={reduceMotion} onGone={onGone} swipeable={showBack && !busy} onSwipe={leave}>
        {/* Die Rückmeldung beim Umdrehen kommt aus hooks.ts (`haptic("flip")`), hier nur das weiche Drücken. */}
        <PressableScale
          scaleTo={0.99}
          disabled={test || round.flipped || busy}
          onPress={onFlip}
          style={styles.cardPress}
          accessibilityRole={test ? undefined : "button"}
          accessibilityLabel={test ? `Vorderseite: ${card.front}` : showBack ? `Rückseite: ${card.back}. Nach rechts wischen für gewusst, nach links für nicht gewusst` : `Vorderseite: ${card.front}. Karte umdrehen`}
        >
          <FlipCard front={card.front} back={test ? null : card.back} flipped={showBack} reduceMotion={reduceMotion} hint={!test} verdict={test && fb ? fb.ok : null} />
        </PressableScale>
      </CardMotion>

      {test ? (
        fb ? (
          <View style={styles.controls} accessibilityLiveRegion="polite">
            <Verdict key={`${card.id}-${fb.ok}`} ok={fb.ok} solution={`Richtig wäre: ${card.back}`} />
            <View style={styles.actions}>
              {fb.ok ? null : <Button title="Trotzdem richtig" variant="secondary" disabled={busy} onPress={onOverride} style={styles.half} />}
              <Button title="Weiter" disabled={busy} onPress={() => leave(fb.ok)} style={styles.half} />
            </View>
          </View>
        ) : <AnswerForm key={card.id + round.queue.length} onCheck={onCheck} />
      ) : round.flipped ? (
        <View style={styles.controls}>
          <AppText variant="caption" tone="muted" style={styles.center}>← Nicht gewusst · Gewusst →  (Karte wischen oder Knopf tippen)</AppText>
          <View style={styles.actions}>
            <Button title="Nicht gewusst" variant="secondary" haptic={false} disabled={busy} onPress={() => leave(false)} style={styles.half} />
            <Button title="Gewusst" haptic={false} disabled={busy} onPress={() => leave(true)} style={styles.half} />
          </View>
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
  page: { gap: spacing.lg, flex: 1 },
  /** iPad: Lernkarte, Ladeschritt und Ergebnis zentriert mit begrenzter Breite (auf dem Telefon ohne Wirkung) */
  centered: { width: "100%", maxWidth: STUDY_MAX_WIDTH, alignSelf: "center" },
  center: { textAlign: "center" },
  fullWidth: { alignSelf: "stretch" },
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  track: { flex: 1, height: 8, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
  badge: { alignSelf: "center" },
  motion: { flex: 1, minHeight: CARD_MIN_HEIGHT },
  cardPress: { flex: 1 },
  flip: { flex: 1, minHeight: CARD_MIN_HEIGHT },
  tint: { ...StyleSheet.absoluteFill, borderRadius: radius.card, borderCurve: "continuous", alignItems: "center", justifyContent: "center" },
  tintText: { color: "#ffffff" },
  face: { alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.xl, borderRadius: radius.card, borderCurve: "continuous", overflow: "hidden" },
  hidden: { backfaceVisibility: "hidden" },
  tag: { textTransform: "uppercase", letterSpacing: 0.72, opacity: 0.6, textAlign: "center" },
  faceText: { textAlign: "center", flexShrink: 1 },
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
