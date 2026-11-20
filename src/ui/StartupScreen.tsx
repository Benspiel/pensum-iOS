import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { spacing, usePensumTheme } from '../theme';
import { AppText } from './index';
import { DURATION, EASE, NATIVE_DRIVER, useMotionPreference } from './motion';
import { PensumLoadingMark } from './PensumLoadingMark';

const INTRO_MS = 480;

export function StartupScreen({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const { colors } = usePensumTheme();
  const reduceMotion = useMotionPreference();
  const [introElapsed, setIntroElapsed] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => setIntroElapsed(true), INTRO_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || (!introElapsed && reduceMotion !== true)) return;
    if (reduceMotion !== false) {
      onFinish();
      return;
    }

    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: DURATION.fade,
      easing: EASE,
      useNativeDriver: NATIVE_DRIVER,
    });
    fade.start(({ finished }) => { if (finished) onFinish(); });
    return () => fade.stop();
  }, [introElapsed, onFinish, opacity, ready, reduceMotion]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: colors.canvas, opacity }]}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel="Pensum wird geladen" accessibilityState={{ busy: true }} style={styles.brand}>
        <PensumLoadingMark size={96} />
        <View style={styles.label}>
          <AppText variant="h2" style={styles.center}>Pensum</AppText>
          <AppText variant="bodySm" tone="muted" style={styles.center}>Wird geladen …</AppText>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, zIndex: 1 },
  brand: { alignItems: 'center', gap: spacing.xl },
  label: { gap: spacing.xs },
  center: { textAlign: 'center' },
});
