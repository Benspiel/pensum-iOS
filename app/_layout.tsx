import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  return <Stack screenOptions={{ headerBackTitle: 'Übersicht' }}>
    <Stack.Screen name="index" options={{ title: 'Pensum' }} />
  </Stack>;
}
