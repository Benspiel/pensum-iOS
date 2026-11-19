/* Hintergrund der Startseite: dezente blaue Farbflächen, Ring und Punktraster, die beim Scrollen mit eigener
 * Geschwindigkeit mitlaufen. Vorlage: index.html (.px) und css/pensum.css der Website (Web-Commit 770dbe4).
 *
 * Einbau: als erstes Kind im Inhalt einer ScrollView (die Ebenen scrollen mit und bekommen zusätzlich den Parallax-Versatz):
 *   <Animated.ScrollView onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })} scrollEventThrottle={16}>
 *     <ParallaxBackground scrollY={scrollY} />
 *     …Inhalt…
 * Reiner Schmuck: für VoiceOver unsichtbar, nimmt keine Berührungen an. Bei „Bewegung reduzieren“ stehen die Ebenen still. */
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { usePensumTheme } from '../theme';
import {
  BLOBS, DOTS, DOT_GAP, RING, blobSize, dotsSize, motionFactor, ringSize, type BlobSpec,
} from './parallax';

/** Scrollwege über dieser Höhe bewegen die Ebenen nicht weiter (Begrenzung, damit sie nie davonlaufen). */
const MAX_SCROLL = 6000;

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (active) setReduce(v); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { active = false; sub.remove(); };
  }, []);
  return reduce;
}

/** Verschiebt ein Kind um scroll * speed * factor (nativ gerechnet, ohne JS-Takt). */
function Layer({ scrollY, speed, factor, still, style, children }: {
  scrollY: Animated.Value;
  speed: number;
  factor: number;
  still: boolean;
  style: object;
  children: React.ReactNode;
}) {
  const translateY = useMemo(
    () => scrollY.interpolate({ inputRange: [0, MAX_SCROLL], outputRange: [0, MAX_SCROLL * speed * factor], extrapolate: 'clamp' }),
    [scrollY, speed, factor],
  );
  return (
    <Animated.View pointerEvents="none" style={[styles.layer, style, !still && { transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function Blob({ spec, width, rgb, dark, scrollY, factor, still }: {
  spec: BlobSpec; width: number; rgb: string; dark: boolean; scrollY: Animated.Value; factor: number; still: boolean;
}) {
  const size = blobSize(width);
  const alpha = dark ? spec.alpha.dark : spec.alpha.light;
  const place = spec.side === 'left' ? { left: spec.inset * width } : { right: spec.inset * width };
  const gradient = `blob-${spec.id}`;
  return (
    <Layer scrollY={scrollY} speed={spec.speed} factor={factor} still={still}
      style={[{ top: `${spec.top * 100}%`, width: size, height: size }, place]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={gradient} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={rgb} stopOpacity={alpha} />
            <Stop offset="1" stopColor={rgb} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${gradient})`} />
      </Svg>
    </Layer>
  );
}

export function ParallaxBackground({ scrollY }: { scrollY: Animated.Value }) {
  const { colors, scheme } = usePensumTheme();
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const factor = motionFactor(width);
  const dark = scheme === 'dark';
  const ring = ringSize(width);
  const dots = dotsSize(width);
  const count = Math.ceil(dots / DOT_GAP);

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.fill}>
      {BLOBS.map((spec) => (
        <Blob key={spec.id} spec={spec} width={width} rgb={colors.accentFill} dark={dark} scrollY={scrollY} factor={factor} still={reduce} />
      ))}
      <Layer scrollY={scrollY} speed={RING.speed} factor={factor} still={reduce}
        style={{ top: `${RING.top * 100}%`, right: RING.right * width, width: ring, height: ring }}>
        <View style={{ width: ring, height: ring, borderRadius: ring / 2, borderWidth: 2, borderColor: colors.border }} />
      </Layer>
      <Layer scrollY={scrollY} speed={DOTS.speed} factor={factor} still={reduce}
        style={{ top: `${DOTS.top * 100}%`, right: DOTS.right * width, width: dots, height: dots, opacity: DOTS.opacity }}>
        <Svg width={dots} height={dots}>
          {Array.from({ length: count * count }, (_, i) => (
            <Circle key={i} cx={(i % count) * DOT_GAP + 1.5} cy={Math.floor(i / count) * DOT_GAP + 1.5} r={1.5} fill={colors.faint} />
          ))}
        </Svg>
      </Layer>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  layer: { position: 'absolute' },
});
