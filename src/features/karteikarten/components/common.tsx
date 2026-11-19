/* Karteikarten – kleine gemeinsame Bausteine (Dialog-Blatt, Speicherhinweis, Level-Anzeigen, Kopfzeile, Leer- und Ladezustand).
 * Web-Quelle: karteikarten.js (noteHtml, levelBar, boxes, openDialog, kk-bar, kk-loading) und karteikarten.css (Web-Commit 770dbe4).
 * Optik: Bausteine aus src/ui, Farben/Abstände aus dem Theme. Abstände Web → App: s-xs 8 = sm, s-sm 12 = md, s-md 16 = lg, s-lg 24 = xl. */
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useContext, useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LEVELS, levelCounts } from "../core";
import type { Deck } from "../core";
import { saveNote } from "../session-model";
import type { SaveStatus } from "../session-model";
import { WIDE_BREAKPOINT, radius, spacing, usePensumTheme } from "../../../theme";
import { AppText, Button, Panel, TintContext } from "../../../ui";

/** Ab ≥ 640 Breite gelten im Web die größeren Schriften und Zweispalter. */
export function useWide() {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

const TABULAR = ["tabular-nums" as const];

/* ---------- Symbol-Knopf (Web: .icon-btn, 44 px, Muted, Hover = Tönung) ---------- */

export const SYMBOLS = {
  back: { ios: "chevron.left", android: "chevron_left", web: "chevron_left" },
  edit: { ios: "pencil", android: "edit", web: "edit" },
  trash: { ios: "trash", android: "delete", web: "delete" },
  close: { ios: "xmark", android: "close", web: "close" },
} satisfies Record<string, SymbolViewProps["name"]>;

export function IconButton({ symbol, label, onPress, disabled = false }: { symbol: SymbolViewProps["name"]; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = usePensumTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? colors.surface : "transparent", opacity: disabled ? 0.5 : 1 }]}
    >
      <SymbolView name={symbol} tintColor={colors.muted} size={20} />
    </Pressable>
  );
}

/* ---------- Kopfzeile (Web: .kk-bar mit h1) ---------- */

export function TitleBar({ title, onBack, backLabel, onAction, actionLabel }: { title: string; onBack: () => void; backLabel: string; onAction?: () => void; actionLabel?: string }) {
  const wide = useWide();
  return (
    <View style={styles.bar}>
      <IconButton symbol={SYMBOLS.back} label={backLabel} onPress={onBack} />
      <AppText variant="h1" accessibilityRole="header" numberOfLines={2} style={[styles.barTitle, wide ? { fontSize: 36, lineHeight: 42 } : { fontSize: 28, lineHeight: 33 }]}>{title}</AppText>
      {onAction && actionLabel ? <IconButton symbol={SYMBOLS.edit} label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

/* ---------- Meldung (Web: .form-message – kein Rot, „!“ in Ink, halbfett) ---------- */

export function FormMessage({ text }: { text: string }) {
  const { colors } = usePensumTheme();
  const onTint = useContext(TintContext);
  return (
    <View accessibilityRole="alert" accessible accessibilityLabel={text} style={[styles.message, { backgroundColor: onTint ? colors.canvas : colors.surface }]}>
      <View accessible={false} style={[styles.messageMark, { backgroundColor: colors.ink }]}>
        <AppText variant="label" style={{ color: colors.onPrimary }}>!</AppText>
      </View>
      <AppText variant="bodySm" style={styles.messageText} accessible={false}>{text}</AppText>
    </View>
  );
}

/* ---------- Dialog als Blatt über dem Screen (Web: <dialog class="modal">, h3 + Schließen-Symbol) ---------- */

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { colors } = usePensumTheme();
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.sheet, { backgroundColor: colors.canvas }]} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.sheetHead}>
          <AppText variant="h3" accessibilityRole="header" style={styles.flex}>{title}</AppText>
          <View style={styles.sheetClose}><IconButton symbol={SYMBOLS.close} label="Schließen" onPress={onClose} /></View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody} automaticallyAdjustKeyboardInsets>
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ---------- Speicherhinweis (Web: .kk-note) ---------- */

export function SaveNote({ signedIn, status, onLogin }: { signedIn: boolean; status: SaveStatus; onLogin: () => void }) {
  const { colors } = usePensumTheme();
  const note = saveNote(signedIn, status);
  return (
    <View style={styles.note} accessibilityLiveRegion="polite">
      <View style={[styles.dot, { borderColor: colors.ink, backgroundColor: note.hollow ? "transparent" : colors.ink }]} />
      <View style={styles.flex}>
        <AppText variant="bodySm" tone="muted">{note.text}</AppText>
        {note.loginHint ? (
          <Pressable accessibilityRole="link" accessibilityLabel="Anmelden, um sie in deinem Konto zu sichern." onPress={onLogin} style={styles.noteLink}>
            <AppText variant="bodySm" tone="muted" style={styles.underline}>Anmelden, um sie in deinem Konto zu sichern.</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* ---------- Level ---------- */

/** Die fünf Fächer als schmale Leiste (Web: .kk-levels, Deckkraft .3/.45/.6/.8/1). */
export function LevelBar({ deck }: { deck: Deck }) {
  const { colors } = usePensumTheme();
  const opacity = [0.3, 0.45, 0.6, 0.8, 1];
  return (
    <View style={styles.levelBar} accessible={false} importantForAccessibility="no-hide-descendants">
      {levelCounts(deck).map((n, i) => (
        <View key={i} style={[styles.levelSeg, { backgroundColor: n ? colors.ink : colors.border, opacity: n ? (opacity[i] ?? 1) : 1 }]} />
      ))}
    </View>
  );
}

/** Karten pro Level als Kästen (Web: .kk-boxes; „Gelernt“ ist eine Ink-Fläche). Liegt auf getönter Fläche. */
export function LevelBoxes({ deck }: { deck: Deck }) {
  const { colors } = usePensumTheme();
  return (
    <View style={styles.boxes} accessibilityRole="list" accessibilityLabel="Karten pro Level">
      {levelCounts(deck).map((n, i) => {
        const done = i === LEVELS - 1;
        const label = done ? "Gelernt" : `Level ${i + 1}`;
        return (
          <View key={i} style={[styles.box, { backgroundColor: done ? colors.ink : colors.canvas }]} accessible accessibilityLabel={`${label}: ${n}`}>
            <AppText variant="h3" style={[styles.boxNumber, { color: done ? colors.onPrimary : colors.ink }]}>{String(n)}</AppText>
            <AppText variant="caption" tone="muted" style={[styles.center, done && { color: colors.onPrimary, opacity: 0.8 }]}>{label}</AppText>
          </View>
        );
      })}
    </View>
  );
}

/** Zahlenkachel auf getönter Fläche (Web: .kk-stat). */
export function StatTile({ value, label }: { value: string; label: string }) {
  const { colors } = usePensumTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.canvas }]} accessible accessibilityLabel={`${value} ${label}`}>
      <AppText variant="h2" style={styles.statNumber}>{value}</AppText>
      <AppText variant="caption" tone="muted" style={styles.statLabel}>{label}</AppText>
    </View>
  );
}

/* ---------- Leerzustand (Web: .es – gestapelte Karten, Titel, Text, Knopf) ---------- */

export function EmptyCard({ title, message, actionLabel, onAction, compact = false }: { title: string; message?: string; actionLabel?: string; onAction?: () => void; compact?: boolean }) {
  const { colors } = usePensumTheme();
  const body = (
    <>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.art, compact && styles.artCompact]}>
        <View style={[styles.artCard, { backgroundColor: compact ? colors.canvas : colors.surface, borderColor: colors.border, opacity: 0.6, transform: [{ translateX: -22 }, { translateY: 4 }, { rotate: "-12deg" }] }]} />
        <View style={[styles.artCard, { backgroundColor: compact ? colors.canvas : colors.surface, borderColor: colors.border, opacity: 0.8, transform: [{ translateX: 22 }, { translateY: 4 }, { rotate: "10deg" }] }]} />
        <View style={[styles.artCard, { backgroundColor: compact ? colors.surface : colors.canvas, borderColor: colors.border }]}>
          <View style={[styles.artLine, { backgroundColor: colors.border, width: 44 }]} />
          <View style={[styles.artLine, { backgroundColor: colors.border, width: 28 }]} />
        </View>
      </View>
      <AppText accessibilityRole="header" style={styles.emptyTitle}>{title}</AppText>
      {message ? <AppText variant="bodySm" tone="muted" style={styles.emptyText}>{message}</AppText> : null}
      {actionLabel && onAction ? <Button title={actionLabel} size="sm" onPress={onAction} style={styles.emptyAction} /> : null}
    </>
  );
  if (compact) return <View style={styles.empty}>{body}</View>;
  return <View style={[styles.empty, styles.emptyBox, { backgroundColor: colors.canvas, borderColor: colors.border }]}>{body}</View>;
}

/* ---------- Ladezustand (Web: .kk-loading – gemischte Karten, Titel, Zeile) ---------- */

function Shuffle({ reduceMotion }: { reduceMotion: boolean }) {
  const { colors } = usePensumTheme();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t, reduceMotion]);
  const float = (offset: number, rotate: string) => ({
    transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [offset, offset - 18] }) }, { rotate }],
  });
  return (
    <View style={styles.shuffle} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.shuffleCard, { backgroundColor: colors.canvas, borderColor: colors.ink, opacity: 0.5 }, float(0, "-8deg")]} />
      <Animated.View style={[styles.shuffleCard, { backgroundColor: colors.canvas, borderColor: colors.ink, opacity: 0.75 }, float(2, "6deg")]} />
      <Animated.View style={[styles.shuffleCard, { backgroundColor: colors.ink, borderColor: colors.ink }, float(4, "-3deg")]} />
    </View>
  );
}

export function LoadingPanel({ title, subtitle, reduceMotion = false }: { title: string; subtitle?: string; reduceMotion?: boolean }) {
  return (
    <Panel accessible accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title} accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={styles.loading}>
      <Shuffle reduceMotion={reduceMotion} />
      <AppText variant="h3" style={styles.center}>{title}</AppText>
      {subtitle ? <AppText variant="bodySm" tone="muted" style={styles.center}>{subtitle}</AppText> : null}
    </Panel>
  );
}

export const common = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: "center" },
  underline: { textDecorationLine: "underline" },
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barTitle: { flex: 1, minWidth: 0 },
  message: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.field, borderCurve: "continuous" },
  messageMark: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  messageText: { flex: 1, fontWeight: "600" },
  sheet: { flex: 1 },
  sheetHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.lg, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  sheetClose: { marginTop: -spacing.sm, marginRight: -spacing.sm },
  sheetBody: { padding: spacing.xl, gap: spacing.lg },
  note: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, marginTop: 7 },
  noteLink: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  levelBar: { flexDirection: "row", gap: 3, height: 8, marginTop: spacing.sm },
  levelSeg: { flex: 1, borderRadius: radius.pill },
  boxes: { flexDirection: "row", gap: spacing.sm },
  box: { flex: 1, alignItems: "center", gap: 2, paddingVertical: spacing.lg, paddingHorizontal: spacing.sm, borderRadius: radius.field, borderCurve: "continuous" },
  boxNumber: { fontSize: 24, lineHeight: 24, fontVariant: TABULAR },
  stat: { flex: 1, alignItems: "center", padding: spacing.lg, borderRadius: radius.field, borderCurve: "continuous" },
  statNumber: { fontSize: 28, lineHeight: 31, fontVariant: TABULAR },
  statLabel: { fontSize: 13 },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  emptyBox: { borderWidth: 1, borderRadius: radius.card, borderCurve: "continuous", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: "600", textAlign: "center" },
  emptyText: { textAlign: "center", maxWidth: 300 },
  emptyAction: { marginTop: spacing.sm },
  art: { width: 132, height: 96, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  artCompact: { transform: [{ scale: 0.8 }], marginBottom: 0 },
  artCard: { position: "absolute", width: 84, height: 60, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  artLine: { height: 4, borderRadius: 2 },
  loading: { alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xxxl, minHeight: 320 },
  shuffle: { width: 120, height: 150, marginBottom: spacing.lg, alignItems: "center", justifyContent: "center" },
  shuffleCard: { position: "absolute", width: 120, height: 150, borderRadius: 20, borderWidth: 2 },
});
