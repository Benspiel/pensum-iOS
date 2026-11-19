import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useSession } from '../src/account/session';
import { getToolAvailability, tools, type Tool, type ToolAvailability } from '../src/navigation/tools';
import { radius, spacing, usePensumTheme } from '../src/theme';
import { AppText, Button, Screen } from '../src/ui';

export default function HomeScreen() {
  const router = useRouter();
  const { access } = useSession();
  const { width, fontScale } = useWindowDimensions();
  const grid = width >= 690 && fontScale <= 1.25;
  const visibleTools = tools.map((tool) => ({ tool, availability: getToolAvailability(tool, access) }))
    .filter(({ availability }) => availability !== 'hidden');

  return (
    <Screen includeTopInset contentStyle={styles.screen}>
      <View style={styles.bar}>
        <AppText variant="section" style={styles.brand}>Pensum</AppText>
        <Button title="Konto" variant="secondary" onPress={() => router.push('/konto')} />
      </View>

      <Hero />

      <View style={styles.toolSection}>
        <AppText variant="section" accessibilityRole="header">Werkzeuge</AppText>
        <View style={[styles.list, grid && styles.grid]}>
          {visibleTools.map(({ tool, availability }) => (
            <ToolTile
              key={tool.id}
              tool={tool}
              availability={availability}
              grid={grid}
              open={() => router.push(`/tools/${tool.id}`)}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function Hero() {
  return (
    <View style={styles.hero}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        <View style={[styles.orbit, styles.outerOrbit]} />
        <View style={[styles.orbit, styles.innerOrbit]} />
        <SymbolView
          name={{ ios: 'sparkle', android: 'auto_awesome', web: 'auto_awesome' }}
          tintColor="#9dbbfc"
          size={26}
          style={styles.sparkle}
        />
      </View>
      <View style={styles.heroText}>
        <AppText variant="display" accessibilityRole="header" style={styles.heroTitle}>
          Alles fürs Pensum.
        </AppText>
        <AppText style={styles.heroDescription}>Schul-Tools an einem Ort. Mit oder ohne Konto.</AppText>
      </View>
    </View>
  );
}

function ToolTile({ tool, availability, grid, open }: {
  tool: Tool;
  availability: ToolAvailability;
  grid: boolean;
  open: () => void;
}) {
  const { colors } = usePensumTheme();
  const locked = availability !== 'available';
  const unavailable = tool.implementation === 'unavailable';
  const disabled = locked || unavailable;
  const note = locked ? 'Für Tester' : unavailable ? 'In dieser Version nicht verfügbar'
    : tool.implementation === 'web' ? 'Website-Version' : undefined;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[tool.title, tool.description, note].filter(Boolean).join('. ')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={open}
      style={({ pressed }) => [
        styles.tile,
        grid && styles.gridTile,
        {
          backgroundColor: locked || pressed ? colors.surface : colors.canvas,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.toolIcon, { backgroundColor: colors.surface }]} accessible={false}>
        <SymbolView name={tool.symbol} tintColor={colors.ink} size={21} />
      </View>
      <View style={styles.toolCopy}>
        <AppText style={styles.toolTitle}>{tool.title}</AppText>
        <AppText variant="caption" tone="muted">{tool.description}</AppText>
        {note ? <AppText variant="caption" tone={disabled ? 'muted' : 'accent'}>{note}</AppText> : null}
      </View>
      {!disabled ? (
        <View accessible={false} style={styles.toolArrow}>
          <SymbolView
            name={tool.implementation === 'web'
              ? { ios: 'arrow.up.right', android: 'north_east', web: 'north_east' }
              : { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            tintColor={colors.muted}
            size={15}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  brand: { fontSize: 23, flexShrink: 1, fontWeight: '700', letterSpacing: -0.8 },
  hero: {
    backgroundColor: '#181a20',
    borderRadius: radius.card,
    borderCurve: 'continuous',
    minHeight: 216,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: spacing.xl,
  },
  heroText: { gap: spacing.md, alignItems: 'flex-start', maxWidth: 430 },
  heroTitle: { color: '#ffffff', maxWidth: 325 },
  heroDescription: { color: '#d0d6e2', fontSize: 17 },
  orbit: { position: 'absolute', borderWidth: 1, borderColor: '#404c64' },
  outerOrbit: { width: 322, height: 322, borderRadius: 161, top: -221, right: -63 },
  innerOrbit: { width: 264, height: 264, borderRadius: 132, top: -182, right: -36 },
  sparkle: { position: 'absolute', top: 20, right: 26 },
  toolSection: { gap: spacing.md },
  list: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: {
    minHeight: 72,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  gridTile: { width: '49%' },
  toolIcon: { width: 42, height: 42, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  toolCopy: { flex: 1, gap: spacing.xs },
  toolTitle: { fontWeight: '600', fontSize: 17 },
  toolArrow: { alignSelf: 'center' },
});
