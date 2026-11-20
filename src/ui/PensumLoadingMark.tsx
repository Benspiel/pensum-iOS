import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image } from 'react-native';

import { squircleRadius } from '../theme/tokens';
import { NATIVE_DRIVER, useMotionPreference } from './motion';

const logo = require('../../assets/app-icon.png');

export function PensumLoadingMark({ size = 20 }: { size?: number }) {
  const reduceMotion = useMotionPreference();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion !== false) return;
    const options = {
      duration: 560,
      easing: Easing.inOut(Easing.sin),
      isInteraction: false,
      useNativeDriver: NATIVE_DRIVER,
    };
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(progress, { ...options, toValue: 1 }),
      Animated.timing(progress, { ...options, toValue: 0 }),
    ]));
    animation.start();
    return () => {
      animation.stop();
      progress.setValue(0);
    };
  }, [progress, reduceMotion]);

  const transform = useMemo(() => [
    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.08] }) },
    { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-8deg'] }) },
    { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
  ], [progress, size]);

  return (
    <Animated.View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ transform }}>
      <Image
        source={logo}
        accessible={false}
        fadeDuration={0}
        style={{ width: size, height: size, borderRadius: squircleRadius(size), borderCurve: 'continuous' }}
      />
    </Animated.View>
  );
}
