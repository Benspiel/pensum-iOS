import * as Clipboard from 'expo-clipboard';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, usePensumTheme } from '../../theme';
import { AppText } from '../../ui';


/* Lösungsfenster (Web `.kc-solution`): Die KI legt die fertige Lösung in einen ```lösung-Block.
 * Daraus wird ein Mini-Fenster mit Titelleiste, „Kopieren“ und „In Goodnotes“. */

function ActionButton({ icon, label, onPress, disabled, primary }: {
  icon: 'doc.on.doc' | 'checkmark' | 'pencil.tip';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const { colors } = usePensumTheme();
  const foreground = primary ? colors.onPrimary : colors.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.action, {
        backgroundColor: primary ? colors.ink : colors.canvas,
        borderColor: primary ? colors.ink : colors.border,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      }]}>
      <SymbolView name={icon} size={15} tintColor={foreground} />
      <AppText variant="bodySm" style={{ color: foreground }}>{label}</AppText>
    </Pressable>
  );
}

export function SolutionWindow({ text, disabled, onCopy, onGoodnotes }: {
  text: string;
  disabled?: boolean;
  onCopy?: (text: string) => Promise<void> | void;
  onGoodnotes: (text: string) => void;
}) {
  const { colors } = usePensumTheme();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    await Clipboard.setStringAsync(text);
    await onCopy?.(text);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <View accessibilityLabel="Lösung" style={[styles.window, { borderColor: colors.border, backgroundColor: colors.canvas }]}>
      <View style={[styles.head, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.title}>
          <SymbolView name="checkmark" size={15} tintColor={colors.ink} />
          <AppText variant="fieldLabel" accessibilityRole="header">Lösung</AppText>
        </View>
        <View style={styles.actions}>
          <ActionButton icon={copied ? 'checkmark' : 'doc.on.doc'} label={copied ? 'Kopiert' : 'Kopieren'} disabled={disabled} onPress={() => void copy()} />
          <ActionButton primary icon="pencil.tip" label="In Goodnotes einfügen" disabled={disabled} onPress={() => onGoodnotes(text)} />
        </View>
      </View>
      <AppText selectable style={styles.body}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  window: { alignSelf: 'stretch', borderWidth: 1, borderRadius: radius.field, borderCurve: 'continuous', overflow: 'hidden' },
  head: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    paddingVertical: spacing.sm, paddingLeft: spacing.md, paddingRight: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 36, paddingHorizontal: spacing.md,
    borderWidth: 1, borderRadius: radius.pill,
  },
  body: { padding: spacing.md },
});
