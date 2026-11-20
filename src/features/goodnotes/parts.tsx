/* Goodnotes-Tool – Bausteine der Oberfläche (Optionskacheln, Papier-Muster, Tintenpunkte, Regler-Zeile, Export-Zeilen, Meldungen).
 * Web-Quelle: tools/goodnotes/goodnotes.css (.gn-option, .gn-paper, .gn-ink, .gn-toggle, .gn-drop), css/export-menu.css + css/stack-panel.css
 * (Export-Menü als Stack-Panel-Zeilen) und css/pensum.css (.form-message, .toast), Web-Commit 770dbe4.
 * Abstände Web → App: s-xxs 4 = xs, s-xs 8 = sm, s-sm 12 = md, s-md 16 = lg, s-lg 24 = xl. Tinten- und Papierfarben sind wie im Web fest. */
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Image, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { radius, spacing, usePensumTheme } from "../../theme";
import { AppText, Button, PensumLoadingMark, TintContext } from "../../ui";
import { DURATION, EASE, NATIVE_DRIVER, PressableScale, Reveal, useReduceMotion, useToggleValue } from "../../ui/motion";

/* ---------- Meldungen ---------- */

/** Web `.form-message`: kein Rot, „!“ in Ink, halbfett. Mit `onDismiss` lässt sie sich antippen und schließen. */
export function FormMessage({ text, onDismiss }: { text: string; onDismiss?: () => void }) {
  const { colors } = usePensumTheme();
  const onTint = useContext(TintContext);
  const body = (
    <>
      <View accessible={false} style={[styles.messageMark, { backgroundColor: colors.ink }]}>
        <AppText variant="label" style={{ color: colors.onPrimary }}>!</AppText>
      </View>
      <AppText variant="bodySm" accessible={false} style={styles.messageText}>{text}</AppText>
    </>
  );
  const style = [styles.message, { backgroundColor: onTint ? colors.canvas : colors.surface }];
  if (onDismiss) {
    return (
      <Reveal distance={8} duration={DURATION.change + 60}>
        <PressableScale scaleTo={0.99} haptic="tap" accessibilityRole="alert" accessibilityLabel={text} accessibilityHint="Zum Schließen tippen" onPress={onDismiss} style={style}>{body}</PressableScale>
      </Reveal>
    );
  }
  return <Reveal distance={8} duration={DURATION.change + 60}><View accessible accessibilityRole="alert" accessibilityLabel={text} style={style}>{body}</View></Reveal>;
}

/** Web `.toast`: invertierte Fläche (Ink), 14 pt, Radius 16. */
export function Notice({ text }: { text: string }) {
  const { colors } = usePensumTheme();
  return (
    <Reveal distance={8} duration={DURATION.change + 60}>
      <View accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={[styles.notice, { backgroundColor: colors.ink }]}>
        <AppText variant="bodySm" accessible={false} style={{ color: colors.onPrimary }}>{text}</AppText>
      </View>
    </Reveal>
  );
}

/* ---------- Raster mit gleich breiten Spalten ---------- */

export function Grid({ columns, children }: { columns: number; children: ReactNode[] }) {
  const [width, setWidth] = useState(0);
  const gap = spacing.sm;
  const item = width ? Math.floor((width - gap * (columns - 1)) / columns) : undefined;
  return (
    <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {item === undefined ? null : children.map((child, i) => <View key={i} style={{ width: item }}>{child}</View>)}
    </View>
  );
}

/* ---------- Optionskachel (Web `.gn-option`) ---------- */

export function OptionTile({ title, hint, selected, onPress, center = false, label, titleStyle, children }: {
  title: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  center?: boolean;
  label?: string;
  titleStyle?: StyleProp<TextStyle>;
  children?: ReactNode;
}) {
  const { colors } = usePensumTheme();
  // Der Auswahlring blendet weich ein/aus (Web: `.gn-option` mit 150 ms Übergang), kein hartes Umspringen
  const ring = useToggleValue(selected);
  return (
    <PressableScale
      scaleTo={0.98}
      haptic="select"
      accessibilityRole="radio"
      accessibilityLabel={label ?? title}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        center && styles.optionCenter,
        { borderColor: colors.border, backgroundColor: pressed ? colors.hairlineSoft : colors.canvas },
      ]}
    >
      {children}
      <AppText variant="fieldLabel" accessible={false} style={[center && styles.center, titleStyle]}>{title}</AppText>
      {hint ? <AppText variant="caption" tone="muted" accessible={false} style={center ? styles.center : undefined}>{hint}</AppText> : null}
      <Animated.View pointerEvents="none" style={[styles.optionRing, { borderColor: colors.ink, opacity: ring }]} />
    </PressableScale>
  );
}

/** Papier-Vorschau: Linien in Hairline auf Canvas (Web `.gn-paper`). */
export function PaperSwatch({ kind }: { kind: "lined" | "lined-small" | "grid" | "blank" }) {
  const { colors } = usePensumTheme();
  const step = kind === "lined-small" ? 6 : kind === "lined" ? 9 : 7;
  const rows = kind === "blank" ? 0 : Math.floor(34 / step);
  const cols = kind === "grid" ? 24 : 0;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.paper, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
      {Array.from({ length: rows }, (_, i) => <View key={`r${i}`} style={[styles.paperRow, { top: (i + 1) * step - 1, backgroundColor: colors.border }]} />)}
      {Array.from({ length: cols }, (_, i) => <View key={`c${i}`} style={[styles.paperCol, { left: (i + 1) * step - 1, backgroundColor: colors.border }]} />)}
    </View>
  );
}

/** Tintenfarbe als Punkt, 48 pt Tippfläche, gewählt = Ring in Ink (Web `.gn-ink`). */
export function InkDot({ color, label, selected, onPress }: { color: string; label: string; selected: boolean; onPress: () => void }) {
  const { colors } = usePensumTheme();
  const ring = useToggleValue(selected, DURATION.change);
  return (
    <PressableScale scaleTo={0.9} haptic="select" accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected, checked: selected }} onPress={onPress} style={styles.ink}>
      <View style={[styles.inkDot, { backgroundColor: color }]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.inkRing, { borderColor: colors.ink, opacity: ring, transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}
      />
    </PressableScale>
  );
}

/* ---------- Regler-Zeile (Web `.gn-slider`: Beschriftung mit Wert, hier mit −/+ statt Schieber) ---------- */

export function StepperRow({ label, valueLabel, onStep }: { label: string; valueLabel: string; onStep: (dir: 1 | -1) => void }) {
  return (
    <View style={styles.stepper}>
      <View style={styles.stepperText} accessible accessibilityLabel={`${label}, ${valueLabel}`} accessibilityLiveRegion="polite">
        <AppText variant="fieldLabel" accessible={false}>
          {label}
          <AppText variant="caption" tone="muted" accessible={false}>{`  ${valueLabel}`}</AppText>
        </AppText>
      </View>
      <Button title="−" variant="secondary" size="sm" haptic="select" accessibilityLabel={`${label} verringern`} accessibilityValue={{ text: valueLabel }} onPress={() => onStep(-1)} style={styles.stepButton} />
      <Button title="+" variant="secondary" size="sm" haptic="select" accessibilityLabel={`${label} erhöhen`} accessibilityValue={{ text: valueLabel }} onPress={() => onStep(1)} style={styles.stepButton} />
    </View>
  );
}

/* ---------- Export-Zeilen im Stack-Panel-Stil (Web: export-menu.css / stack-panel.css) ---------- */

export interface ExportRow {
  id: string;
  title: string;
  hint: string;
  symbol: SymbolViewProps["name"];
  accessibilityLabel: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}

export function ExportList({ rows }: { rows: ExportRow[] }) {
  const { colors } = usePensumTheme();
  return (
    <View style={[styles.spList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {rows.map((row, i) => (
        <PressableScale
          key={row.id}
          scaleTo={0.985}
          haptic="send"
          accessibilityRole="button"
          accessibilityLabel={row.accessibilityLabel}
          accessibilityHint={row.hint}
          accessibilityState={{ disabled: row.disabled, busy: row.busy }}
          disabled={row.disabled}
          onPress={row.onPress}
          style={({ pressed }) => [
            styles.spRow,
            i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
            { backgroundColor: pressed ? colors.hairlineSoft : "transparent", opacity: row.disabled && !row.busy ? 0.45 : 1 },
          ]}
        >
          <View accessible={false} style={[styles.spIcon, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
            {row.busy ? <PensumLoadingMark /> : <SymbolView name={row.symbol} tintColor={colors.ink} size={20} />}
          </View>
          <View style={styles.spText} accessible={false}>
            <AppText variant="link" accessible={false} style={styles.spLabel}>{row.title}</AppText>
            <AppText variant="caption" tone="muted" accessible={false} numberOfLines={2} style={styles.spHint}>{row.hint}</AppText>
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

/* ---------- Seitenvorschau ---------- */

/** Eine Seite der Vorschau: blendet beim Laden weich ein, statt hart aufzutauchen. */
export function PreviewPage({ uri, label, style }: { uri: string; label: string; style: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const shown = useRef(false);
  const show = () => {
    if (shown.current) return;
    shown.current = true;
    Animated.timing(opacity, { toValue: 1, duration: reduce ? 0 : DURATION.change + 80, easing: EASE, useNativeDriver: NATIVE_DRIVER }).start();
  };
  return (
    <Animated.View style={[style, { opacity, overflow: "hidden" }]}>
      <Image source={{ uri }} resizeMode="contain" accessibilityLabel={label} onLoad={show} onError={show} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/** Platzhalter, solange die Vorschau noch erstellt wird: leere Seite, die sanft atmet. */
export function PagePlaceholder({ style }: { style: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { pulse.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: EASE, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: EASE, useNativeDriver: NATIVE_DRIVER }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);
  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[style, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.75] }) }]}
    />
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  message: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.field, borderCurve: "continuous" },
  messageMark: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  messageText: { flex: 1, fontWeight: "600" },
  notice: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.field, borderCurve: "continuous" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: { flex: 1, minHeight: 56, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.xs, justifyContent: "center", alignItems: "flex-start", borderWidth: 1, borderRadius: radius.field, borderCurve: "continuous" },
  optionCenter: { alignItems: "center" },
  optionRing: { position: "absolute", top: -1, left: -1, right: -1, bottom: -1, borderWidth: 2, borderRadius: radius.field, borderCurve: "continuous" },
  paper: { alignSelf: "stretch", height: 34, borderWidth: 1, borderRadius: spacing.sm, overflow: "hidden" },
  paperRow: { position: "absolute", left: 0, right: 0, height: 1 },
  paperCol: { position: "absolute", top: 0, bottom: 0, width: 1 },
  ink: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  inkDot: { width: 32, height: 32, borderRadius: radius.pill },
  inkRing: { position: "absolute", top: 4, left: 4, right: 4, bottom: 4, borderWidth: 2, borderRadius: radius.pill },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepperText: { flex: 1, minHeight: 44, justifyContent: "center" },
  stepButton: { width: 44, minWidth: 44, paddingHorizontal: 0 },
  spList: { borderWidth: 1, borderRadius: radius.field, borderCurve: "continuous", overflow: "hidden" },
  spRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, minHeight: 64, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  spIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  spText: { flex: 1, minWidth: 0 },
  spLabel: { fontSize: 15, lineHeight: 20 },
  spHint: { fontSize: 13, lineHeight: 18 },
});
