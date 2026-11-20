/**
 * Bewegung: überall dieselbe Sprache, wie `css/pensum.css` der Website („Bewegung: überall dieselbe Sprache“).
 *
 *   EASE / DURATION   Web `--ease` (cubic-bezier 0.2 0.7 0.2 1) und die Zeiten der Website (Press 120 ms, Wechsel 150–220 ms, Einblenden 450 ms)
 *   useReduceMotion   „Bewegung reduzieren“ des Systems; alle Bausteine hier springen dann ohne Animation
 *   PressableScale    Pressable mit weichem Skalieren beim Drücken (Web `.btn:active` 0.97, `.gn-option:active` 0.98)
 *   Reveal            Einblenden mit leichtem Aufsteigen (Web `rise`), optional gestaffelt über `delay`
 *   useToggleValue    0/1-Wert, der bei Wechsel weich überblendet (Auswahlring, Pfeil, Markierung)
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export const NATIVE_DRIVER = Platform.OS !== 'web';
export const EASE = Easing.bezier(0.2, 0.7, 0.2, 1);
export const DURATION = { press: 110, release: 180, fade: 150, change: 220, enter: 450, sheet: 300 } as const;

/* ---------- Bewegung reduzieren ---------- */

let reduced: boolean | null = null;
const listeners = new Set<(value: boolean | null) => void>();
function setReduced(value: boolean) {
  reduced = value;
  listeners.forEach((listener) => listener(value));
}
try {
  void AccessibilityInfo.isReduceMotionEnabled()
    .then((value) => { if (reduced === null) setReduced(value); })
    .catch(() => undefined);
  AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
} catch {
  // ohne Systemauskunft bleibt die Bewegung an
}

export function useMotionPreference(): boolean | null {
  const [value, setValue] = useState(reduced);
  useEffect(() => {
    listeners.add(setValue);
    setValue(reduced);
    return () => { listeners.delete(setValue); };
  }, []);
  return value;
}

export function useReduceMotion(): boolean {
  return useMotionPreference() ?? false;
}

/* ---------- Drücken ---------- */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressStyle = StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);

export function usePressScale(to: number) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduce = useReduceMotion();
  const run = (value: number, duration: number) => {
    Animated.timing(scale, { toValue: value, duration: reduce ? 0 : duration, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE_DRIVER }).start();
  };
  return {
    style: { transform: [{ scale }] },
    pressIn: () => run(to, DURATION.press),
    pressOut: () => run(1, DURATION.release),
  };
}

/** Drop-in für `Pressable` (auch die Funktionsform von `style`). Skaliert beim Drücken weich und kehrt beim Loslassen zurück. */
export function PressableScale({ style, scaleTo = 0.97, onPressIn, onPressOut, ...props }: Omit<PressableProps, 'style'> & {
  style?: PressStyle;
  scaleTo?: number;
}) {
  const press = usePressScale(scaleTo);
  const [pressed, setPressed] = useState(false);
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => { setPressed(true); press.pressIn(); onPressIn?.(event); }}
      onPressOut={(event) => { setPressed(false); press.pressOut(); onPressOut?.(event); }}
      style={[typeof style === 'function' ? style({ pressed }) : style, press.style]}
    />
  );
}

/* ---------- Einblenden ---------- */

/** Blendet beim ersten Zeigen ein und steigt dabei leicht auf (Web `rise`: 14 px, 550 ms; hier 450 ms). */
export function Reveal({ children, delay = 0, distance = 14, duration = DURATION.enter, style }: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { progress.setValue(1); return undefined; }
    const animation = Animated.timing(progress, { toValue: 1, duration, delay, easing: EASE, useNativeDriver: NATIVE_DRIVER });
    animation.start();
    return () => animation.stop();
  }, [progress, reduce, duration, delay]);
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Gestaffelte Verzögerung wie Web `main > *:nth-child(n)`: 0, 50, 100 … höchstens 200 ms (bei `step` 50). */
export const stagger = (index: number, step = 50, max = 200) => Math.min(max, index * step);

/* ---------- Wechsel ---------- */

/** 0/1-Wert, der bei jedem Wechsel von `on` weich zum Ziel läuft. */
export function useToggleValue(on: boolean, duration: number = DURATION.fade) {
  const reduce = useReduceMotion();
  const value = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.timing(value, { toValue: on ? 1 : 0, duration: reduce ? 0 : duration, easing: EASE, useNativeDriver: NATIVE_DRIVER });
    animation.start();
    return () => animation.stop();
  }, [value, on, reduce, duration]);
  return value;
}
