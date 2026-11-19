import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { SessionProvider } from '../src/account/session';
import { PensumThemeProvider, usePensumTheme } from '../src/theme';

export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PensumThemeProvider>
        <SessionProvider>
          <Navigation />
        </SessionProvider>
      </PensumThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigation() {
  const { scheme, colors } = usePensumTheme();
  const baseTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

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
    }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{
        headerBackTitle: 'Übersicht',
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.canvas },
      }}>
        <Stack.Screen name="index" options={{ title: 'Pensum', headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
