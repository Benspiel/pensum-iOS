import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gutter, radius, resolveTextStyle, spacing, usePensumTheme } from '../../theme';
import { AppText, Button } from '../../ui';
import { BottomSheet } from '../../ui/BottomSheet';
import { contentMaxWidth } from '../../ui/wide';
import { ExportList, FormMessage, type ExportRow } from './parts';

type ToolbarAction = Pick<ComponentProps<typeof Button>, 'title' | 'symbol' | 'onPress'>;

export function ExportBar({ onPress, disabled, actions, document }: {
  onPress: () => void;
  disabled?: boolean;
  actions?: readonly ToolbarAction[];
  document?: { name: string; onChangeName: (name: string) => void; summary: string };
}) {
  const { colors, customFonts, scheme } = usePensumTheme();
  const { width, fontScale } = useWindowDimensions();
  const { left, right } = useSafeAreaInsets();
  const availableWidth = width - left - right;
  const stacked = actions ? availableWidth < 360 || fontScale > 1.25 : availableWidth < 600;
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduceMotion) => {
      if (active) Animated.timing(entrance, { toValue: 1, duration: reduceMotion ? 0 : 220, useNativeDriver: true }).start();
    });
    return () => { active = false; entrance.stopAnimation(); };
  }, [entrance]);

  const animation = { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] };
  if (document) {
    const showSummary = availableWidth >= 620 * Math.max(1, fontScale);
    const nameStyle = resolveTextStyle('link', { customFonts });
    return (
      <View style={[styles.documentDock, { paddingHorizontal: gutter(width) }]}>
        <Animated.View style={[styles.documentToolbar, { backgroundColor: colors.surface, borderColor: colors.hairlineSoft }, animation]}>
          <TextInput
            accessibilityLabel="Dateiname"
            autoCorrect={false}
            keyboardAppearance={scheme}
            value={document.name}
            onChangeText={document.onChangeName}
            placeholder="Lernzettel"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            returnKeyType="done"
            style={[
              styles.filename,
              showSummary && styles.filenameWide,
              { backgroundColor: colors.canvas, color: colors.ink, fontSize: nameStyle.fontSize, fontFamily: nameStyle.fontFamily, fontWeight: nameStyle.fontWeight },
            ]}
          />
          {showSummary ? <AppText variant="caption" tone="muted" style={styles.summary}>{document.summary}</AppText> : null}
          <Button title="Exportieren" onPress={onPress} disabled={disabled} style={styles.documentExport} />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.dock, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
      <View style={[styles.toolbar, { paddingHorizontal: gutter(width), maxWidth: contentMaxWidth(width, true) }]}>
        {actions?.length ? (
          <View style={[styles.secondaryActions, stacked && styles.full]}>
            {actions.map((action) => (
              <Button key={action.title} {...action} variant="secondary" size="sm"
                style={[styles.secondaryButton, stacked && styles.flexButton]} />
            ))}
          </View>
        ) : null}
        <Animated.View style={[styles.exportAction, stacked && styles.full, animation]}>
          <Button
            title="Exportieren" symbol={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
            variant="accent" onPress={onPress} disabled={disabled}
          />
        </Animated.View>
      </View>
    </View>
  );
}

export function ExportMenu({ visible, onClose, rows, busy, error, children }: {
  visible: boolean;
  onClose: () => void;
  rows: ExportRow[];
  busy?: boolean;
  error?: string;
  children?: ReactNode;
}) {
  return (
    <BottomSheet visible={visible} title="Exportieren" onClose={onClose} busy={busy}>
      {children}
      {error ? <FormMessage text={error} /> : null}
      <ExportList rows={rows} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  documentDock: { paddingTop: spacing.xs, paddingBottom: spacing.sm },
  documentToolbar: {
    width: '100%', maxWidth: 880, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, padding: spacing.sm, borderRadius: radius.pill, borderCurve: 'continuous', borderWidth: 1,
  },
  filename: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill },
  filenameWide: { maxWidth: 240 },
  summary: { flex: 1, marginHorizontal: spacing.sm },
  documentExport: { flexShrink: 1 },
  dock: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm },
  toolbar: { width: '100%', alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  secondaryActions: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: { minHeight: 48, flexDirection: 'column', paddingVertical: spacing.xs, paddingHorizontal: spacing.md, gap: 1 },
  exportAction: { minWidth: 140, marginLeft: 'auto' },
  full: { width: '100%' },
  flexButton: { flex: 1 },
});
