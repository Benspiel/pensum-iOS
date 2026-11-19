import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '../src/account/session';
import { getToolAvailability, tools, type Tool, type ToolAvailability } from '../src/navigation/tools';
import { gutter, radius, spacing, squircleRadius, usePensumTheme } from '../src/theme';
import { AppText, Badge, Button, Card, Screen, SquircleIcon, TintContext } from '../src/ui';
import { ParallaxBackground } from '../src/ui/ParallaxBackground';
import { motionFactor } from '../src/ui/parallax';
import { contentMaxWidth, innerWidth, toolGrid } from '../src/ui/wide';

const NAV_MAX = 760;
const logo = require('../assets/app-icon.png');

export default function HomeScreen() {
  const router = useRouter();
  const { state, access } = useSession();
  const { width, height, fontScale } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance>(null);
  // Scrollstand für den Parallax-Hintergrund und den Hero-Text (Vorlage: js/parallax.js der Website)
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY],
  );
  const heroShift = useMemo(
    () => scrollY.interpolate({ inputRange: [0, 4000], outputRange: [0, 4000 * 0.12 * motionFactor(width)], extrapolate: 'clamp' }),
    [scrollY, width],
  );
  const heroFade = useMemo(
    () => scrollY.interpolate({ inputRange: [0, Math.max(1, height * 0.85)], outputRange: [1, 0], extrapolate: 'clamp' }),
    [scrollY, height],
  );
  const toolsTop = useRef(0);
  // iPad: Der Hintergrund läuft über die ganze Breite, der Inhalt steht in einer mittigen Spalte (bis 1120 pt)
  const { left, right } = useSafeAreaInsets();
  const edge = gutter(width);
  const gap = edge >= 24 ? spacing.xl : spacing.lg;
  const layout = toolGrid(innerWidth(width, left + right, edge, true), fontScale, gap);
  const grid = layout.columns > 1;
  const cardWidth = layout.tileWidth;
  const column = { maxWidth: contentMaxWidth(width, true), paddingHorizontal: edge };
  const visibleTools = tools
    .map((tool) => ({ tool, availability: getToolAvailability(tool, access) }))
    .filter(({ availability }) => availability !== 'hidden');
  const signedIn = state.status === 'account';

  return (
    <Screen includeTopInset scroll={false} wide contentStyle={styles.screen}>
      <View style={[styles.column, column]}>
        <NavPill label={signedIn || state.status === 'loading' ? 'Konto' : 'Anmelden'} open={() => router.push('/konto')} />
      </View>

      <Animated.ScrollView
        ref={scroller}
        style={styles.scroller}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <ParallaxBackground scrollY={scrollY} />
        <View style={[styles.column, column]}>
          <Animated.View style={{ opacity: heroFade, transform: [{ translateY: heroShift }] }}>
            <Hero
              accountLabel={state.status === 'guest' ? 'Konto erstellen' : 'Konto'}
              showTools={() => scroller.current?.scrollTo({ y: Math.max(0, toolsTop.current - spacing.lg), animated: true })}
              openAccount={() => router.push('/konto')}
            />
          </Animated.View>

          <View style={styles.toolSection} onLayout={(event) => { toolsTop.current = event.nativeEvent.layout.y; }}>
            <AppText variant="h3" accessibilityRole="header">Werkzeuge</AppText>
            <View style={[styles.list, { gap }, grid && styles.grid]}>
              {visibleTools.map(({ tool, availability }) => (
                <ToolTile
                  key={tool.id}
                  tool={tool}
                  availability={availability}
                  width={grid ? cardWidth : undefined}
                  open={() => router.push(`/tools/${tool.id}`)}
                />
              ))}
              <Card variant="soft" style={[styles.tile, grid && { width: cardWidth }]}>
                <SquircleIcon tone="soft" symbol={{ ios: 'plus', android: 'add', web: 'add' }} />
                <AppText variant="h4" accessibilityRole="header">Bald mehr.</AppText>
                <AppText variant="bodySm" tone="muted">
                  Jedes Tool ist ein eigenes Modul. Neue kommen dazu, deine Anmeldung gilt automatisch auch dort.
                </AppText>
              </Card>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

/** Schwebende Pill-Leiste wie `pensum-nav` der Website: canvas-soft, 4-px-Rand in canvas, Logo, Schriftzug, Konto. */
function NavPill({ label, open }: { label: string; open: () => void }) {
  const { colors } = usePensumTheme();
  return (
    <View
      accessibilityRole="header"
      style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.canvas }]}
    >
      <View style={styles.brand}>
        <Image
          source={logo}
          accessibilityLabel="Pensum"
          style={styles.logo}
        />
        <AppText variant="h4" numberOfLines={1} style={styles.brandText}>Pensum</AppText>
      </View>
      <Button title={label} size="sm" onPress={open} accessibilityHint="Öffnet Anmeldung und Konto" />
    </View>
  );
}

function Hero({ accountLabel, showTools, openAccount }: { accountLabel: string; showTools: () => void; openAccount: () => void }) {
  return (
    <View style={styles.hero}>
      <AppText variant="display" accessibilityRole="header" style={styles.center}>Alles fürs Pensum.</AppText>
      <AppText variant="bodyLg" tone="muted" style={[styles.center, styles.heroSub]}>
        Schul-Tools an einem Ort. Einmal anmelden, überall angemeldet. Oder einfach ohne Konto loslegen.
      </AppText>
      <View style={styles.heroActions}>
        <Button title="Tools ansehen" size="lg" onPress={showTools} />
        <Button title={accountLabel} size="lg" variant="secondary" onPress={openAccount} />
      </View>
    </View>
  );
}

/** Kurzmarke oben rechts in der Kachel, wie die Badges der Website-Kacheln. */
function badgeFor(tool: Tool, locked: boolean): { label: string; accent: boolean } | undefined {
  if (locked) return { label: 'Für Tester', accent: false };
  switch (tool.id) {
    case 'abschreiben': return { label: 'Neu', accent: true };
    case 'kichat': return { label: 'Ki-Tester', accent: true };
    case 'admin': return { label: 'Admin', accent: true };
    case 'aufgaben': case 'videos': return { label: 'Tester', accent: true };
    default: return undefined;
  }
}

function ToolTile({ tool, availability, width, open }: {
  tool: Tool;
  availability: ToolAvailability;
  width: number | undefined;
  open: () => void;
}) {
  const { colors } = usePensumTheme();
  const locked = availability !== 'available';
  const unavailable = tool.implementation === 'unavailable';
  const disabled = locked || unavailable;
  const note = locked ? 'Für Tester' : unavailable ? 'In dieser Version nicht verfügbar'
    : tool.implementation === 'web' ? 'Website-Version' : undefined;
  const badge = badgeFor(tool, locked);
  const dim = disabled ? styles.dim : undefined;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[tool.title, tool.description, badge && !locked ? badge.label : undefined, note].filter(Boolean).join('. ')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={open}
      style={({ pressed }) => [
        styles.tile,
        width !== undefined && { width },
        {
          backgroundColor: disabled || pressed ? colors.surface : colors.canvas,
          borderColor: disabled || pressed ? colors.surface : colors.hairlineSoft,
        },
        pressed && { transform: [{ scale: 0.985 }] },
      ]}
    >
      <TintContext.Provider value={disabled}>
      <View style={styles.tileHead}>
        <SquircleIcon symbol={tool.symbol} dimmed={disabled} />
        {badge ? <Badge label={badge.label} variant={badge.accent ? 'accent' : 'soft'} /> : null}
      </View>
      <AppText variant="h4" style={dim}>{tool.title}</AppText>
      <AppText variant="bodySm" tone="muted" style={dim}>{tool.description}</AppText>
      <View style={styles.tileFoot}>
        {disabled ? (
          <AppText variant="link" tone="muted">{note}</AppText>
        ) : (
          <>
            <AppText variant="link">Öffnen</AppText>
            <View accessible={false}>
              <SymbolView
                name={{ ios: 'arrow.up.right', android: 'north_east', web: 'north_east' }}
                tintColor={colors.ink}
                size={14}
                weight="semibold"
              />
            </View>
          </>
        )}
      </View>
      </TintContext.Provider>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // volle Breite: Hintergrund und Scrollfläche gehen bis an den Rand, der Inhalt steht in `column`
  screen: { paddingTop: spacing.sm, paddingBottom: 0, gap: 0, maxWidth: 4096, paddingHorizontal: 0 },
  column: { width: '100%', alignSelf: 'center' },
  scroller: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },
  pill: {
    width: '100%',
    maxWidth: NAV_MAX,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 60,
    padding: spacing.xs,
    borderWidth: 4,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    marginBottom: spacing.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1, minHeight: 44 },
  logo: { width: 44, height: 44, borderRadius: squircleRadius(44), borderCurve: 'continuous' },
  brandText: { fontSize: 18, flexShrink: 1 },
  hero: { alignItems: 'center', paddingTop: spacing.xxxl, paddingBottom: spacing.xxl, gap: spacing.xl },
  center: { textAlign: 'center' },
  heroSub: { maxWidth: 460 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  toolSection: { gap: spacing.lg },
  list: {},
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: {
    minHeight: 260,
    gap: spacing.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderRadius: radius.card,
    borderCurve: 'continuous',
  },
  tileHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  tileFoot: { marginTop: 'auto', paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dim: { opacity: 0.45 },
});
