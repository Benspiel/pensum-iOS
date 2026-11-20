/**
 * Gemeinsame UI-Bausteine im Stil der Pensum-Website (css/pensum.css). Alles hier liest Farben aus
 * `usePensumTheme()`; keine Schatten, Hierarchie über Tönung und Haarlinien.
 *
 * Haptik: Button, Chip und Segmented geben von sich aus eine kurze Rückmeldung (`ui/haptics.ts`, Begriffe wie
 * `js/haptics.js` der Website). Über `haptic="send" | "warn" | …` lässt sie sich je Knopf ändern, mit `haptic={false}`
 * abschalten. Eigene Pressables nehmen sie über `PressableScale` aus `ui/motion` mit.
 *
 * Bestehende Exporte (kompatibel, Props unverändert; neue Props sind optional):
 *   AppText      variant: display | h1 | h2 | h3 | h4 | bodyLg | body | bodySm | link | label | fieldLabel | caption
 *                         | title (≙ h2, bisherige Seitenüberschrift) | section (20/600, ≙ Web `.title`)
 *                tone:    default | muted | soft | accent | danger
 *                Ein im `style` übergebenes `fontWeight` wird auf den passenden Inter-Schnitt abgebildet,
 *                `fontSize` ohne `lineHeight` skaliert die Zeilenhöhe der Variante mit.
 *   Screen       title?, description? (Titelblock wie Web `.tool-head`: h1 + bodyLg muted), navigationTitle?,
 *                scroll?, includeTopInset?, contentStyle?  – Seitenrand 16 (≥ 640 Breite: 24), max. 760 breit.
 *   Button       title, symbol?, variant: primary | accent | secondary (Web „outline“) | soft | plain | danger,
 *                size?: sm (44) | md (48) | lg (56), loading?, disabled?, style?, alle Pressable-Props.
 *                `danger` ist wie im Web eine Ink-Fläche; erkennbar bleibt es über den Zugänglichkeits-Hinweis
 *                („Destruktive Aktion“, überschreibbar via accessibilityHint).
 *   Field        label, error?, hint?, onTint? + TextInput-Props. Fläche `field`, kein Rand, Radius 16.
 *                Fehler = gestrichelter 2-px-Ring in ink + Text mit „!“; Fokus = durchgezogener 2-px-Ring.
 *   Card         variant?: default (canvas + 1 px hairlineSoft) | soft (surface, kein sichtbarer Rand), Radius 24, Padding 24.
 *   LoadingState, ErrorState, EmptyState, ThemeSelector – unverändert in der Bedienung.
 *
 * Neue Exporte:
 *   Panel        = Card variant="soft" (Web `.panel`/`.card-soft`). Kinder wie Field, Badge, Button soft, Chip passen
 *                sich an (weiße Fläche auf der Tönung, Web `.on-tint`).
 *   Badge        label, variant?: soft | accent (24 px Pill, 12/600). accent = Fläche `accentFill` mit `onAccent`.
 *   Segmented    options: {id,label,disabled?,accessibilityLabel?}[], value, onChange(id), label? (Gruppenname),
 *                role?: radiogroup (Standard) | tablist, fill? (Standard true = volle Breite).
 *   Chip         label, selected?, onPress? (ohne onPress nur Anzeige), disabled?, accessibilityLabel?, style?.
 *   SquircleIcon symbol (expo-symbols), size? (56), tone?: ink (Standard) | soft, dimmed? (ausgegraut).
 *   TintContext  Context (boolean) „liegt auf getönter Fläche“; Panel setzt ihn, eigene Container können ihn setzen.
 */
import { Stack } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { createContext, useContext, useEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  WIDE_BREAKPOINT,
  familyForWeight,
  gutter,
  lineHeightRatio,
  radius,
  resolveTextStyle,
  spacing,
  squircleRadius,
  usePensumTheme,
  type TextVariant,
  type ThemeChoice,
} from '../theme';
import { PensumLoadingMark } from './PensumLoadingMark';
import { haptic, type HapticKind } from './haptics';
import { DURATION, EASE, PressableScale, Reveal, useReduceMotion } from './motion';
import { contentMaxWidth } from './wide';

export { PensumLoadingMark } from './PensumLoadingMark';
export { haptic, type HapticKind } from './haptics';

/* ---------- Text ---------- */

type AppTextProps = TextProps & {
  variant?: TextVariant;
  tone?: 'default' | 'muted' | 'soft' | 'accent' | 'danger';
};

export function AppText({ variant = 'body', tone = 'default', style, ...props }: AppTextProps) {
  const { colors, customFonts } = usePensumTheme();
  const { width } = useWindowDimensions();
  const base = resolveTextStyle(variant, { wide: width >= WIDE_BREAKPOINT, customFonts });
  const color = tone === 'default' ? colors.ink : tone === 'soft' ? colors.inkSoft : colors[tone];
  const flat: TextStyle = StyleSheet.flatten(style) ?? {};

  const resolved: TextStyle & { lineHeight?: number; fontFamily?: string } = { ...base, color };
  if (flat.fontSize !== undefined && flat.lineHeight === undefined) {
    resolved.lineHeight = Math.round(flat.fontSize * lineHeightRatio(variant));
  }
  if (customFonts && flat.fontWeight !== undefined && flat.fontFamily === undefined) {
    // Statt eines synthetischen Gewichts den passenden statischen Inter-Schnitt wählen.
    resolved.fontFamily = familyForWeight(flat.fontWeight);
  }
  const override: TextStyle | undefined = customFonts && flat.fontWeight !== undefined ? { fontWeight: undefined } : undefined;

  return <Text {...props} style={[resolved, style, override]} />;
}

/* ---------- Getönte Flächen ---------- */

/** true, wenn der Inhalt auf einer getönten Fläche (`surface`) liegt; Felder, Badges und Knöpfe wechseln dann auf `canvas`. */
export const TintContext = createContext(false);

/* ---------- Screen ---------- */

export interface ScreenProps {
  children: ReactNode;
  title?: string;
  description?: string;
  navigationTitle?: string;
  scroll?: boolean;
  includeTopInset?: boolean;
  /** iPad: darf auf breiten Fenstern (ab 900 pt) bis 1120 pt breit werden statt 760 (nur setzen, wenn der Screen die Breite nutzt, z. B. mit zwei Spalten). */
  wide?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}

export function Screen({ children, title, description, navigationTitle, scroll = true, includeTopInset = false, wide = false, contentStyle, footer }: ScreenProps) {
  const { colors } = usePensumTheme();
  const { width } = useWindowDimensions();
  const headerTitle = navigationTitle ?? title;
  const contents = (
    <Reveal distance={10} style={[styles.contents, { paddingHorizontal: gutter(width), maxWidth: contentMaxWidth(width, wide) }, !scroll && styles.page, contentStyle]}>
      {title || description ? (
        <View style={styles.intro}>
          {title ? <AppText variant="h1" accessibilityRole="header">{title}</AppText> : null}
          {description ? <AppText variant="bodyLg" tone="muted">{description}</AppText> : null}
        </View>
      ) : null}
      {children}
    </Reveal>
  );

  return (
    <SafeAreaView edges={includeTopInset ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']} style={[styles.page, { backgroundColor: colors.canvas }]}>
      {headerTitle ? <Stack.Screen options={{ title: headerTitle }} /> : null}
      {scroll ? (
        <ScrollView
          style={styles.page}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets
          contentInsetAdjustmentBehavior="automatic"
        >
          {contents}
        </ScrollView>
      ) : contents}
      {footer}
    </SafeAreaView>
  );
}

/* ---------- Button ---------- */

type ActionProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'accent' | 'secondary' | 'soft' | 'plain' | 'danger';
  symbol?: SymbolViewProps['name'];
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Haptik beim Auslösen. Standard: `tap`, bei `danger` eine Warnung. `false` schaltet sie ab, `"send"` für Abschicken/Exportieren. */
  haptic?: HapticKind | false;
};

const buttonHeight = { sm: 44, md: 48, lg: 56 } as const;

export function Button({
  title, variant = 'primary', symbol, size = 'md', loading = false, disabled = false, style, accessibilityState,
  haptic: kind, ...props
}: ActionProps) {
  const { colors } = usePensumTheme();
  const onTint = useContext(TintContext);
  const palette = {
    primary: { bg: colors.ink, pressed: colors.inkSoft, fg: colors.onPrimary, border: 'transparent' },
    accent: { bg: colors.accentFill, pressed: colors.accentFill, fg: colors.onAccent, border: 'transparent' },
    danger: { bg: colors.ink, pressed: colors.inkSoft, fg: colors.onPrimary, border: 'transparent' },
    secondary: { bg: colors.canvas, pressed: colors.surface, fg: colors.ink, border: colors.border },
    soft: { bg: onTint ? colors.canvas : colors.surface, pressed: colors.border, fg: colors.ink, border: 'transparent' },
    plain: { bg: 'transparent', pressed: 'transparent', fg: colors.ink, border: 'transparent' },
  }[variant];

  return (
    <PressableScale
      scaleTo={variant === 'plain' ? 1 : 0.97}
      haptic={kind ?? (variant === 'danger' ? 'warn' : 'tap')}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={variant === 'danger' ? 'Destruktive Aktion' : undefined}
      {...props}
      accessibilityState={{ ...accessibilityState, disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { minHeight: buttonHeight[size], paddingHorizontal: size === 'lg' ? spacing.xl : spacing.lg },
        {
          backgroundColor: pressed ? palette.pressed : palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.5 : pressed && variant === 'plain' ? 0.6 : pressed && variant === 'accent' ? 0.82 : 1,
        },
        style,
      ]}
    >
      {loading ? <PensumLoadingMark size={size === 'sm' ? 16 : 20} /> : symbol ? (
        <SymbolView name={symbol} size={size === 'sm' ? 16 : 19} tintColor={palette.fg} accessible={false} />
      ) : null}
      <AppText
        variant="link"
        style={[
          styles.buttonText,
          size === 'sm' && { fontSize: 14 },
          variant === 'plain' && styles.underline,
          { color: palette.fg },
        ]}
      >
        {title}
      </AppText>
    </PressableScale>
  );
}

/* ---------- Field ---------- */

type FieldProps = ComponentPropsWithRef<typeof TextInput> & {
  label: string;
  error?: string;
  hint?: string;
  /** Erzwingt die weiße Fläche (sonst automatisch über `TintContext`, z. B. in einem `Panel`). */
  onTint?: boolean;
};

export function Field({ label, error, hint, onTint, ref, style, multiline, onFocus, onBlur, ...props }: FieldProps) {
  const { colors, scheme, customFonts } = usePensumTheme();
  const inTint = useContext(TintContext);
  const [focused, setFocused] = useState(false);
  const body = resolveTextStyle('body', { customFonts });
  const showRing = focused || Boolean(error);

  return (
    <View style={styles.fieldGroup}>
      <AppText variant="fieldLabel" accessible={false}>{label}</AppText>
      <View>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          keyboardAppearance={scheme}
          {...props}
          ref={ref}
          multiline={multiline}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          style={[
            styles.field,
            // Keine feste Zeilenhöhe: auf iOS verschiebt sie den Text in einzeiligen Feldern.
            { fontSize: body.fontSize, fontFamily: body.fontFamily, fontWeight: body.fontWeight },
            multiline && styles.multiLine,
            { color: colors.ink, backgroundColor: onTint ?? inTint ? colors.canvas : colors.field },
            style,
          ]}
        />
        {showRing ? (
          <View
            pointerEvents="none"
            style={[styles.ring, { borderColor: colors.ink, borderStyle: error ? 'dashed' : 'solid' }]}
          />
        ) : null}
      </View>
      {hint && !error ? <AppText variant="caption" tone="muted">{hint}</AppText> : null}
      {error ? (
        <View style={styles.errorRow}>
          <View accessible={false} style={[styles.errorMark, { backgroundColor: colors.ink }]}>
            <AppText variant="label" style={{ color: colors.onPrimary }}>!</AppText>
          </View>
          <AppText tone="danger" variant="bodySm" style={styles.errorText} accessibilityRole="alert">{error}</AppText>
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Karten ---------- */

export type CardProps = ViewProps & { variant?: 'default' | 'soft' };

export function Card({ variant = 'default', style, ...props }: CardProps) {
  const { colors } = usePensumTheme();
  const soft = variant === 'soft';
  const card = (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor: soft ? colors.surface : colors.canvas,
          borderColor: soft ? colors.surface : colors.hairlineSoft,
        },
        style,
      ]}
    />
  );
  return soft ? <TintContext.Provider value>{card}</TintContext.Provider> : card;
}

/** Getönte Fläche (Web `.panel` / `.card-soft`). */
export function Panel(props: Omit<CardProps, 'variant'>) {
  return <Card {...props} variant="soft" />;
}

/* ---------- Badge, Chip ---------- */

export function Badge({ label, variant = 'soft', style, ...props }: ViewProps & { label: string; variant?: 'soft' | 'accent' }) {
  const { colors } = usePensumTheme();
  const onTint = useContext(TintContext);
  const background = variant === 'accent' ? colors.accentFill : onTint ? colors.canvas : colors.surface;
  const foreground = variant === 'accent' ? colors.onAccent : colors.ink;
  return (
    <View {...props} style={[styles.badge, { backgroundColor: background }, style]}>
      <AppText variant="label" style={{ color: foreground }}>{label}</AppText>
    </View>
  );
}

export function Chip({ label, selected = false, onPress, disabled = false, accessibilityLabel, style, haptic: kind = 'select' }: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Standard `select`; `false`, wenn die Rückmeldung schon aus der ausgelösten Aktion kommt. */
  haptic?: HapticKind | false;
}) {
  const { colors } = usePensumTheme();
  const onTint = useContext(TintContext);
  const restingBackground = onTint ? colors.canvas : colors.surface;
  const foreground = selected ? colors.onPrimary : colors.ink;
  const content = <AppText variant="bodySm" style={{ color: foreground }}>{label}</AppText>;

  if (!onPress) {
    return <View style={[styles.chip, { backgroundColor: selected ? colors.ink : restingBackground }, style]}>{content}</View>;
  }
  return (
    <PressableScale
      scaleTo={0.96}
      haptic={kind}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        styles.chipPressable,
        { backgroundColor: selected ? (pressed ? colors.inkSoft : colors.ink) : pressed ? colors.border : restingBackground, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {content}
    </PressableScale>
  );
}

/* ---------- Segmented ---------- */

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function Segmented<T extends string>({ options, value, onChange, label, role = 'radiogroup', fill = true, style }: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
  role?: 'radiogroup' | 'tablist';
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = usePensumTheme();
  const reduce = useReduceMotion();
  const optionRole = role === 'tablist' ? 'tab' : 'radio';
  // Der Griff gleitet zur gewählten Option (wie ein iOS-Segmentschalter); gemessen wird jede Option einzeln.
  const frames = useRef<Record<string, { x: number; width: number }>>({});
  const left = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const [visible, setVisible] = useState(false);

  const moveTo = (id: string, animate: boolean) => {
    const frame = frames.current[id];
    if (!frame) return;
    if (!animate || reduce) {
      left.setValue(frame.x);
      width.setValue(frame.width);
      return;
    }
    Animated.parallel([
      Animated.timing(left, { toValue: frame.x, duration: DURATION.change, easing: EASE, useNativeDriver: false }),
      Animated.timing(width, { toValue: frame.width, duration: DURATION.change, easing: EASE, useNativeDriver: false }),
    ]).start();
  };
  useEffect(() => {
    if (placed.current) moveTo(value, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const measure = (id: string) => (event: LayoutChangeEvent) => {
    const { x, width: w } = event.nativeEvent.layout;
    frames.current[id] = { x, width: w };
    if (id === value) {
      moveTo(id, placed.current);
      placed.current = true;
      setVisible(true);
    }
  };

  return (
    <View
      accessibilityRole={role}
      accessibilityLabel={label}
      style={[styles.segmented, { backgroundColor: colors.surface }, fill ? styles.segmentedFill : styles.segmentedFit, style]}
    >
      <Animated.View pointerEvents="none" style={[styles.segmentThumb, { backgroundColor: colors.canvas, left, width, opacity: visible ? 1 : 0 }]} />
      {options.map((option) => {
        const active = option.id === value;
        return (
          <PressableScale
            key={option.id}
            scaleTo={0.97}
            onLayout={measure(option.id)}
            accessibilityRole={optionRole}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={role === 'tablist' ? { selected: active, disabled: option.disabled } : { checked: active, disabled: option.disabled }}
            disabled={option.disabled}
            // Nur beim echten Wechsel eine Rückmeldung: ein Tipp auf die schon gewählte Option ändert nichts.
            haptic={active ? false : 'select'}
            onPress={() => onChange(option.id)}
            style={[
              styles.segment,
              fill ? styles.segmentFill : styles.segmentFit,
              { opacity: option.disabled ? 0.5 : 1 },
            ]}
          >
            {/* Die Beschriftung bleibt einzeilig, wird aber kleiner statt abgeschnitten (der Nutzer muss sie ganz lesen können). */}
            <AppText
              variant="bodySm"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{ fontWeight: '600', color: active ? colors.ink : colors.muted }}
            >
              {option.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

/* ---------- Squircle-Icon ---------- */

export function SquircleIcon({ symbol, size = 56, tone = 'ink', dimmed = false, style }: {
  symbol: SymbolViewProps['name'];
  size?: number;
  tone?: 'ink' | 'soft';
  dimmed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = usePensumTheme();
  const onTint = useContext(TintContext);
  const background = tone === 'ink' ? colors.ink : onTint ? colors.canvas : colors.surface;
  const tint = tone === 'ink' ? colors.onPrimary : colors.ink;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: size, height: size, borderRadius: squircleRadius(size), borderCurve: 'continuous', backgroundColor: background, opacity: dimmed ? 0.45 : 1 },
        styles.squircle,
        style,
      ]}
    >
      <SymbolView name={symbol} tintColor={tint} size={Math.round(size * 0.46)} />
    </View>
  );
}

/* ---------- Zustände ---------- */

export function LoadingState({ title = 'Wird geladen …' }: { title?: string }) {
  return (
    <Card accessible accessibilityLabel={title} accessibilityRole="progressbar" accessibilityState={{ busy: true }}>
      <View style={styles.row}>
        <PensumLoadingMark size={28} />
        <AppText tone="muted">{title}</AppText>
      </View>
    </Card>
  );
}

export function ErrorState({
  title = 'Etwas ist schiefgelaufen.',
  message,
  onRetry,
  retryLabel = 'Erneut versuchen',
}: { title?: string; message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <Card>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={[title, message].join(' ')}
        accessibilityLiveRegion="polite"
        style={styles.fieldGroup}
      >
        <AppText variant="section" tone="danger">{title}</AppText>
        <AppText>{message}</AppText>
      </View>
      {onRetry ? <Button title={retryLabel} variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <Card>
      <AppText variant="section" accessibilityRole="header">{title}</AppText>
      {message ? <AppText tone="muted">{message}</AppText> : null}
      {action}
    </Card>
  );
}

/* ---------- Darstellung ---------- */

const themeOptions = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Hell' },
  { id: 'dark', label: 'Dunkel' },
] as const satisfies readonly { id: ThemeChoice; label: string }[];

export function ThemeSelector() {
  const { choice, setChoice, persistenceError } = usePensumTheme();
  return (
    <View style={styles.fieldGroup}>
      <AppText variant="section" accessibilityRole="header">Darstellung</AppText>
      <Segmented label="Darstellung" options={themeOptions} value={choice} onChange={setChoice} />
      {persistenceError ? (
        <AppText tone="danger" variant="bodySm" accessibilityRole="alert">
          Die Darstellung konnte für den nächsten Start nicht gespeichert werden.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contents: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingVertical: spacing.lg, gap: spacing.lg },
  intro: { gap: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  button: {
    minWidth: 48,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { textAlign: 'center', flexShrink: 1 },
  underline: { textDecorationLine: 'underline' },
  fieldGroup: { gap: spacing.sm },
  field: {
    minHeight: 48,
    borderCurve: 'continuous',
    borderRadius: radius.field,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  multiLine: { minHeight: 120, textAlignVertical: 'top' },
  ring: { ...StyleSheet.absoluteFill, borderWidth: 2, borderRadius: radius.field, borderCurve: 'continuous' },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  errorMark: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  errorText: { flex: 1, fontWeight: '600' },
  card: {
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.card,
    borderCurve: 'continuous',
  },
  badge: {
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPressable: { minHeight: 40 },
  segmented: { padding: spacing.xs, borderRadius: radius.pill, borderCurve: 'continuous', flexDirection: 'row', gap: 0, maxWidth: '100%' },
  segmentedFill: { width: '100%' },
  segmentedFit: { alignSelf: 'flex-start' },
  segmentThumb: { position: 'absolute', top: spacing.xs, bottom: spacing.xs, borderRadius: radius.pill, borderCurve: 'continuous' },
  segment: { minHeight: 40, borderRadius: radius.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  segmentFill: { flex: 1, paddingHorizontal: spacing.sm },
  segmentFit: { paddingHorizontal: spacing.lg },
  squircle: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
});
