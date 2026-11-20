/**
 * Bausteine der Konto-Ansicht: Profilkarte (Avatar, Name, E-Mail, Status) und der „Einstellungen“-Block
 * mit gruppierten Zeilen (Bezeichnung links, Wert in Muted, Chevron rechts).
 */
import { SymbolView } from 'expo-symbols';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, usePensumTheme } from '../theme';
import { AppText, Badge, Panel } from '../ui';

export function initials(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]!, words[words.length - 1]!] : words.slice(0, 1);
  const text = letters.map((word) => Array.from(word)[0] ?? '').join('');
  return (text || Array.from(email.trim())[0] || '?').toLocaleUpperCase('de-DE');
}

export function ProfileCard({ name, email, verified, children }: {
  name: string;
  email: string;
  verified: boolean;
  children?: ReactNode;
}) {
  const { colors } = usePensumTheme();
  return (
    <Panel style={styles.profile}>
      <View style={styles.profileHead}>
        <View accessible={false} importantForAccessibility="no-hide-descendants"
          style={[styles.avatar, { backgroundColor: colors.ink }]}>
          <AppText variant="h3" style={{ color: colors.onPrimary }}>{initials(name, email)}</AppText>
        </View>
        <View style={styles.profileText}>
          <AppText variant="h3" numberOfLines={2}>{name || 'Mein Konto'}</AppText>
          <AppText tone="muted" numberOfLines={1}>{email}</AppText>
        </View>
      </View>
      <Badge label={verified ? 'E-Mail bestätigt' : 'E-Mail noch nicht bestätigt'} />
      {children}
    </Panel>
  );
}

/** Umrandeter Einstellungsblock mit zentrierter Überschrift. */
export function SettingsPanel({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = usePensumTheme();
  return (
    <View style={[styles.panel, { borderColor: colors.border }]}>
      <AppText variant="section" accessibilityRole="header" style={styles.panelTitle}>{title}</AppText>
      {children}
    </View>
  );
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = usePensumTheme();
  const rows = Children.toArray(children);
  return (
    <View style={styles.section}>
      <AppText variant="bodyLg" tone="muted" accessibilityRole="header" style={styles.sectionTitle}>{title}</AppText>
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View accessible={false} style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

export function SettingsRow({ label, value, danger = false, disabled = false, onPress }: {
  label: string;
  value?: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = usePensumTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.border : 'transparent', opacity: disabled ? 0.5 : 1 }]}
    >
      <AppText variant="bodyLg" numberOfLines={1} accessible={false}
        style={[styles.rowLabel, { fontWeight: '500' }, danger && { color: colors.danger }]}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="bodyLg" tone="muted" numberOfLines={1} accessible={false} style={styles.rowValue}>{value}</AppText>
      ) : <View style={styles.rowValue} />}
      <SymbolView accessible={false} size={14} weight="semibold" tintColor={colors.muted}
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { padding: spacing.xl, gap: spacing.lg },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  profileText: { flex: 1, gap: 2 },
  panel: {
    borderWidth: 1,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  panelTitle: { textAlign: 'center' },
  section: { gap: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.sm },
  group: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  divider: { height: 1 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowLabel: { flex: 1 },
  rowValue: { flex: 1 },
});
