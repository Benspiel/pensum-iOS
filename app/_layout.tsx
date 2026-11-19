import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, useColorScheme } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { SessionProvider } from '../src/account/session';
import { PensumThemeProvider, fontFamilies, palette, usePensumTheme } from '../src/theme';
import { useAppFonts } from '../src/theme/fonts';

export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  const fonts = useAppFonts();
  const system = useColorScheme();

  // Erst rendern, wenn Inter geladen ist (oder fehlgeschlagen/Zeitüberschreitung: dann Systemschrift).
  // Bis dahin eine leere Fläche in der Hintergrundfarbe des Systems statt eines weißen Aufblitzens.
  if (!fonts.ready) {
    return <View style={{ flex: 1, backgroundColor: system === 'dark' ? palette.dark.canvas : palette.light.canvas }} />;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PensumThemeProvider customFonts={fonts.loaded}>
        <SessionProvider>
          <Navigation />
        </SessionProvider>
      </PensumThemeProvider>
    </SafeAreaProvider>
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
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
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
