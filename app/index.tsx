import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';

import { useSession } from '../src/account/session';
import { getToolAvailability, tools, type Tool, type ToolAvailability } from '../src/navigation/tools';
import { gutter, radius, spacing, squircleRadius, usePensumTheme } from '../src/theme';
import { AppText, Badge, Button, Card, Screen, SquircleIcon, TintContext } from '../src/ui';

const BREAKPOINT_GRID = 690;
const CONTENT_MAX = 760;
const CARD_GAP = spacing.lg;
const logo = require('../assets/app-icon.png');

export default function HomeScreen() {
  const router = useRouter();
  const { state, access } = useSession();
  const { width, fontScale } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance>(null);
  const toolsTop = useRef(0);
  const grid = width >= BREAKPOINT_GRID && fontScale <= 1.25;
  const cardWidth = (Math.min(width, CONTENT_MAX) - 2 * gutter(width) - CARD_GAP) / 2;
  const visibleTools = tools
    .map((tool) => ({ tool, availability: getToolAvailability(tool, access) }))
    .filter(({ availability }) => availability !== 'hidden');
  const signedIn = state.status === 'account';

  return (
    <Screen includeTopInset scroll={false} contentStyle={styles.screen}>
      <NavPill label={signedIn || state.status === 'loading' ? 'Konto' : 'Anmelden'} open={() => router.push('/konto')} />

      <ScrollView
        ref={scroller}
        style={styles.scroller}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <Hero
          accountLabel={state.status === 'guest' ? 'Konto erstellen' : 'Konto'}
          showTools={() => scroller.current?.scrollTo({ y: Math.max(0, toolsTop.current - spacing.lg), animated: true })}
          openAccount={() => router.push('/konto')}
        />

        <View style={styles.toolSection} onLayout={(event) => { toolsTop.current = event.nativeEvent.layout.y; }}>
          <AppText variant="h3" accessibilityRole="header">Werkzeuge</AppText>
          <View style={[styles.list, grid && styles.grid]}>
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
      </ScrollView>
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
  screen: { paddingTop: spacing.sm, paddingBottom: 0, gap: 0 },
  scroller: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },
  pill: {
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
  list: { gap: CARD_GAP },
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
