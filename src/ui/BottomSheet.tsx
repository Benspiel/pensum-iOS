import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, usePensumTheme } from '../theme';
import { AppText, Button } from './index';

export function BottomSheet({ visible, title, children, onClose, busy = false }: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const { colors } = usePensumTheme();
  const insets = useSafeAreaInsets();
  const requestClose = () => { if (!busy) onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={requestClose} supportedOrientations={['portrait', 'portrait-upside-down', 'landscape']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.frame, { paddingTop: insets.top + spacing.sm, paddingLeft: insets.left, paddingRight: insets.right }]}
      >
        <Pressable accessible={false} style={styles.backdrop} onPress={requestClose} />
        <View style={[styles.sheet, { backgroundColor: colors.canvas, paddingBottom: Math.max(spacing.lg, insets.bottom) }]} accessibilityViewIsModal>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} accessible={false} />
          <View style={styles.header}>
            <AppText variant="section" accessibilityRole="header" style={styles.title}>{title}</AppText>
            <Button title="Schließen" variant="plain" size="sm" disabled={busy} onPress={requestClose} />
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.36)' },
  sheet: { flexShrink: 1, width: '100%', maxWidth: 560, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, borderCurve: 'continuous' },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingLeft: spacing.xl, paddingRight: spacing.sm, paddingVertical: spacing.xs },
  title: { flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
});
