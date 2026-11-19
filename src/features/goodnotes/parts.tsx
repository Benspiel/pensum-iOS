/* Goodnotes-Tool – Bausteine der Oberfläche (Optionskacheln, Papier-Muster, Tintenpunkte, Regler-Zeile, Export-Zeilen, Meldungen).
 * Web-Quelle: tools/goodnotes/goodnotes.css (.gn-option, .gn-paper, .gn-ink, .gn-toggle, .gn-drop), css/export-menu.css + css/stack-panel.css
 * (Export-Menü als Stack-Panel-Zeilen) und css/pensum.css (.form-message, .toast), Web-Commit 770dbe4.
 * Abstände Web → App: s-xxs 4 = xs, s-xs 8 = sm, s-sm 12 = md, s-md 16 = lg, s-lg 24 = xl. Tinten- und Papierfarben sind wie im Web fest. */
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useContext, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { radius, spacing, usePensumTheme } from "../../theme";
import { AppText, Button, TintContext } from "../../ui";

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
      <Pressable accessibilityRole="alert" accessibilityLabel={text} accessibilityHint="Zum Schließen tippen" onPress={onDismiss} style={style}>{body}</Pressable>
    );
  }
  return <View accessible accessibilityRole="alert" accessibilityLabel={text} style={style}>{body}</View>;
}

/** Web `.toast`: invertierte Fläche (Ink), 14 pt, Radius 16. */
export function Notice({ text }: { text: string }) {
  const { colors } = usePensumTheme();
  return (
    <View accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={[styles.notice, { backgroundColor: colors.ink }]}>
      <AppText variant="bodySm" accessible={false} style={{ color: colors.onPrimary }}>{text}</AppText>
    </View>
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

export function OptionTile({ title, hint, selected, onPress, center = false, label, children }: {
  title: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  center?: boolean;
  label?: string;
  children?: ReactNode;
}) {
  const { colors } = usePensumTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label ?? title}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        center && styles.optionCenter,
        { borderColor: selected ? colors.ink : colors.border, backgroundColor: pressed ? colors.surface : colors.canvas },
      ]}
    >
      {children}
      <AppText variant="fieldLabel" accessible={false} style={center ? styles.center : undefined}>{title}</AppText>
      {hint ? <AppText variant="caption" tone="muted" accessible={false} style={center ? styles.center : undefined}>{hint}</AppText> : null}
      {selected ? <View pointerEvents="none" style={[styles.optionRing, { borderColor: colors.ink }]} /> : null}
    </Pressable>
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
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected, checked: selected }} onPress={onPress} style={styles.ink}>
      <View style={[styles.inkDot, { backgroundColor: color }]} />
      {selected ? <View pointerEvents="none" style={[styles.inkRing, { borderColor: colors.ink }]} /> : null}
    </Pressable>
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
      <Button title="−" variant="secondary" size="sm" accessibilityLabel={`${label} verringern`} accessibilityValue={{ text: valueLabel }} onPress={() => onStep(-1)} style={styles.stepButton} />
      <Button title="+" variant="secondary" size="sm" accessibilityLabel={`${label} erhöhen`} accessibilityValue={{ text: valueLabel }} onPress={() => onStep(1)} style={styles.stepButton} />
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

export function ExportList({ title, rows }: { title: string; rows: ExportRow[] }) {
  const { colors } = usePensumTheme();
  return (
    <View style={[styles.sp, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
      <View style={styles.spHead}>
        <AppText accessibilityRole="header" style={styles.spTitle}>{title}</AppText>
      </View>
      <View style={[styles.spList, { backgroundColor: colors.surface }]}>
        {rows.map((row, i) => (
          <Pressable
            key={row.id}
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
              {row.busy ? <ActivityIndicator color={colors.ink} /> : <SymbolView name={row.symbol} tintColor={colors.ink} size={20} />}
            </View>
            <View style={styles.spText} accessible={false}>
              <AppText variant="link" accessible={false} style={styles.spLabel}>{row.title}</AppText>
              <AppText variant="caption" tone="muted" accessible={false} numberOfLines={2} style={styles.spHint}>{row.hint}</AppText>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
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
  optionRing: { position: "absolute", top: 1, left: 1, right: 1, bottom: 1, borderWidth: 1, borderRadius: radius.field - 1, borderCurve: "continuous" },
  paper: { alignSelf: "stretch", height: 34, borderWidth: 1, borderRadius: spacing.sm, overflow: "hidden" },
  paperRow: { position: "absolute", left: 0, right: 0, height: 1 },
  paperCol: { position: "absolute", top: 0, bottom: 0, width: 1 },
  ink: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  inkDot: { width: 32, height: 32, borderRadius: radius.pill },
  inkRing: { position: "absolute", top: 4, left: 4, right: 4, bottom: 4, borderWidth: 2, borderRadius: radius.pill },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepperText: { flex: 1, minHeight: 44, justifyContent: "center" },
  stepButton: { width: 44, minWidth: 44, paddingHorizontal: 0 },
  sp: { borderWidth: 1, borderRadius: radius.card, borderCurve: "continuous", overflow: "hidden" },
  spHead: { minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  spTitle: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  spList: { marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.xl, borderRadius: radius.field, borderCurve: "continuous", overflow: "hidden" },
  spRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, minHeight: 64, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  spIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  spText: { flex: 1, minWidth: 0 },
  spLabel: { fontSize: 15, lineHeight: 20 },
  spHint: { fontSize: 13, lineHeight: 18 },
});
