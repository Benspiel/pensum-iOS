import { Stack } from 'expo-router';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, usePensumTheme, type ThemeChoice } from '../theme';

type AppTextProps = TextProps & {
  variant?: 'display' | 'title' | 'section' | 'body' | 'caption' | 'label';
  tone?: 'default' | 'muted' | 'accent' | 'danger';
};

export function AppText({ variant = 'body', tone = 'default', style, ...props }: AppTextProps) {
  const { colors } = usePensumTheme();
  const color = tone === 'default' ? colors.ink : colors[tone];
  return <Text {...props} style={[typography[variant], { color }, style]} />;
}

export interface ScreenProps {
  children: ReactNode;
  title?: string;
  description?: string;
  navigationTitle?: string;
  scroll?: boolean;
  includeTopInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, title, description, navigationTitle, scroll = true, includeTopInset = false, contentStyle }: ScreenProps) {
  const { colors } = usePensumTheme();
  const headerTitle = navigationTitle ?? title;
  const contents = (
    <View style={[styles.contents, !scroll && styles.page, contentStyle]}>
      {title || description ? (
        <View style={styles.intro}>
          {title ? <AppText variant="title" accessibilityRole="header">{title}</AppText> : null}
          {description ? <AppText tone="muted">{description}</AppText> : null}
        </View>
      ) : null}
      {children}
    </View>
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
    </SafeAreaView>
  );
}

type ActionProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'plain' | 'danger';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title, variant = 'primary', loading = false, disabled = false, style, accessibilityState, ...props
}: ActionProps) {
  const { colors } = usePensumTheme();
  const background = { primary: colors.ink, secondary: colors.surface, plain: 'transparent', danger: colors.dangerSurface }[variant];
  const foreground = { primary: colors.onPrimary, secondary: colors.ink, plain: colors.accent, danger: colors.danger }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      {...props}
      accessibilityState={{ ...accessibilityState, disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.55 : pressed ? 0.72 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={foreground} accessible={false} /> : null}
      <AppText style={[styles.buttonText, { color: foreground }]}>{title}</AppText>
    </Pressable>
  );
}

type FieldProps = ComponentPropsWithRef<typeof TextInput> & { label: string; error?: string };

export function Field({ label, error, ref, style, multiline, ...props }: FieldProps) {
  const { colors, scheme } = usePensumTheme();
  return (
    <View style={styles.fieldGroup}>
      <AppText variant="label" accessible={false}>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        keyboardAppearance={scheme}
        {...props}
        ref={ref}
        multiline={multiline}
        style={[
          styles.field,
          multiline && styles.multiLine,
          { color: colors.ink, backgroundColor: colors.field, borderColor: error ? colors.danger : colors.border },
          style,
        ]}
      />
      {error ? <AppText tone="danger" variant="caption" accessibilityRole="alert">{error}</AppText> : null}
    </View>
  );
}

export function Card({ style, ...props }: ViewProps) {
  const { colors } = usePensumTheme();
  return <View {...props} style={[styles.card, { borderColor: colors.border }, style]} />;
}

export function LoadingState({ title = 'Wird geladen …' }: { title?: string }) {
  const { colors } = usePensumTheme();
  return (
    <Card accessible accessibilityLabel={title} accessibilityRole="progressbar" accessibilityState={{ busy: true }}>
      <View style={styles.row}>
        <ActivityIndicator color={colors.ink} accessible={false} />
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

const themeOptions = [
  { id: 'system', title: 'System' },
  { id: 'light', title: 'Hell' },
  { id: 'dark', title: 'Dunkel' },
] as const satisfies readonly { id: ThemeChoice; title: string }[];

export function ThemeSelector() {
  const { choice, setChoice, persistenceError } = usePensumTheme();
  return (
    <View style={styles.fieldGroup}>
      <AppText variant="section" accessibilityRole="header">Darstellung</AppText>
      <View style={styles.row}>
        {themeOptions.map(({ id, title }) => (
          <Button
            key={id}
            title={title}
            accessibilityRole="radio"
            accessibilityState={{ checked: id === choice }}
            onPress={() => setChoice(id)}
            variant={id === choice ? 'primary' : 'secondary'}
          />
        ))}
      </View>
      {persistenceError ? (
        <AppText tone="danger" variant="caption" accessibilityRole="alert">
          Die Darstellung konnte für den nächsten Start nicht gespeichert werden.
        </AppText>
      ) : null}
    </View>
  );
}

const typography = StyleSheet.create({
  display: { fontSize: 42, fontWeight: '700', letterSpacing: -1.6 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.6 },
  section: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 14, fontWeight: '400' },
});

const styles = StyleSheet.create({
  page: { flex: 1 },
  contents: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg },
  intro: { gap: spacing.sm, paddingVertical: spacing.md },
  button: {
    minHeight: 48,
    minWidth: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  fieldGroup: { gap: spacing.sm },
  field: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: 'continuous',
    borderRadius: radius.field,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  multiLine: { minHeight: 104, textAlignVertical: 'top' },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    borderCurve: 'continuous',
  },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
});
