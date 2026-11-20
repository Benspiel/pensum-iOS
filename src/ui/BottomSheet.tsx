import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, usePensumTheme } from '../theme';
import { AppText, Button } from './index';
import { haptic } from './haptics';
import { DURATION, EASE, NATIVE_DRIVER, useReduceMotion } from './motion';

export function BottomSheet({ visible, title, children, onClose, busy = false }: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const { colors } = usePensumTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduce = useReduceMotion();
  const requestClose = () => {
    if (busy) return;
    haptic('close');
    onClose();
  };

  // Eigene Bewegung statt „slide“ des Modals: der Hintergrund blendet ein, das Blatt gleitet von unten hoch (und beim Schließen zurück).
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  // Beim Öffnen meldet sich der Knopf, der das Blatt aufruft (`haptic="open"`), damit die Rückmeldung
  // im Moment der Berührung kommt und nicht doppelt. Hier nur das Schließen (Knopf, Fläche daneben, Zurück-Geste).
  useEffect(() => {
    if (visible) {
      setMounted(true);
      const animation = Animated.timing(progress, { toValue: 1, duration: reduce ? 0 : DURATION.sheet, easing: EASE, useNativeDriver: NATIVE_DRIVER });
      animation.start();
      return () => animation.stop();
    }
    const animation = Animated.timing(progress, { toValue: 0, duration: reduce ? 0 : DURATION.change, easing: EASE, useNativeDriver: NATIVE_DRIVER });
    animation.start(({ finished }) => { if (finished) setMounted(false); });
    return () => animation.stop();
  }, [visible, reduce, progress]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={requestClose} supportedOrientations={['portrait', 'portrait-upside-down', 'landscape']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.frame, { paddingTop: insets.top + spacing.sm, paddingLeft: insets.left, paddingRight: insets.right }]}
      >
        <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: progress }]} />
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={requestClose} />
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.canvas, paddingBottom: Math.max(spacing.lg, insets.bottom), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [Math.round(height * 0.5), 0] }) }], opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }) },
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} accessible={false} />
          <View style={styles.header}>
            <AppText variant="section" accessibilityRole="header" style={styles.title}>{title}</AppText>
            {/* Die Rückmeldung kommt aus `requestClose` („close“), der Knopf selbst gibt keine zweite. */}
            <Button title="Schließen" variant="plain" size="sm" haptic={false} disabled={busy} onPress={requestClose} />
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {children}
          </ScrollView>
        </Animated.View>
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
