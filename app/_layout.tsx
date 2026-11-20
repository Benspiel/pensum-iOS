import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { SessionProvider } from '../src/account/session';
import { PensumThemeProvider, fontFamilies, usePensumTheme } from '../src/theme';
import { useAppFonts } from '../src/theme/fonts';
import { StartupScreen } from '../src/ui/StartupScreen';

export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  const fonts = useAppFonts();

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PensumThemeProvider customFonts={fonts.loaded}>
        <AppContent ready={fonts.ready} />
      </PensumThemeProvider>
    </SafeAreaProvider>
  );
}

function AppContent({ ready }: { ready: boolean }) {
  const { scheme, colors } = usePensumTheme();
  const [showStartup, setShowStartup] = useState(true);
  const finishStartup = useCallback(() => setShowStartup(false), []);

  return (
    <View style={[styles.fill, { backgroundColor: colors.canvas }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {ready ? (
        <View
          aria-hidden={showStartup}
          accessibilityElementsHidden={showStartup}
          importantForAccessibility={showStartup ? 'no-hide-descendants' : 'auto'}
          style={styles.fill}
        >
          <SessionProvider>
            <Navigation />
          </SessionProvider>
        </View>
      ) : null}
      {showStartup ? <StartupScreen ready={ready} onFinish={finishStartup} /> : null}
    </View>
  );
}

function Navigation() {
  const { scheme, colors, customFonts } = usePensumTheme();
  const baseTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const font = (face: keyof typeof fontFamilies, weight: '400' | '500' | '600' | '700') =>
    customFonts ? { fontFamily: fontFamilies[face], fontWeight: weight } : { ...baseTheme.fonts.regular, fontWeight: weight };

  return (
    <ThemeProvider value={{
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: colors.canvas,
        card: colors.canvas,
        text: colors.ink,
        border: colors.border,
        primary: colors.ink,
      },
      fonts: {
        regular: font('regular', '400'),
        medium: font('medium', '500'),
        bold: font('semibold', '600'),
        heavy: font('bold', '700'),
      },
    }}>
      <Stack screenOptions={{
        headerBackTitle: 'Übersicht',
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        headerTitleStyle: customFonts
          ? { fontFamily: fontFamilies.semibold, fontSize: 17 }
          : { fontWeight: '600', fontSize: 17 },
        contentStyle: { backgroundColor: colors.canvas },
      }}>
        <Stack.Screen name="index" options={{ title: 'Pensum', headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
