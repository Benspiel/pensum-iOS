import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';

import { fontFamilies } from './tokens';

/**
 * Inter (statische TTFs aus `assets/fonts`, SIL OFL 1.1, siehe docs/THIRD-PARTY.md).
 * Die Schlüssel sind die Familiennamen aus `fontFamilies`; sie sind zugleich die `fontFamily`-Werte der App.
 */
export const interFontSources = {
  [fontFamilies.light]: require('../../assets/fonts/Inter_300Light.ttf'),
  [fontFamilies.regular]: require('../../assets/fonts/Inter_400Regular.ttf'),
  [fontFamilies.medium]: require('../../assets/fonts/Inter_500Medium.ttf'),
  [fontFamilies.semibold]: require('../../assets/fonts/Inter_600SemiBold.ttf'),
  [fontFamilies.bold]: require('../../assets/fonts/Inter_700Bold.ttf'),
};

/** Nach dieser Zeit wird auch ohne geladene Schrift gerendert (Systemschrift), damit der Start nie hängen bleibt. */
export const FONT_TIMEOUT_MS = 4000;

/**
 * Lädt Inter.
 * - `ready`: Die App darf rendern (Schrift geladen, Ladefehler oder Timeout).
 * - `loaded`: Inter steht tatsächlich zur Verfügung; nur dann dürfen die Inter-Familiennamen verwendet werden.
 * Kommt die Schrift nach einem Timeout doch noch an, schaltet `loaded` nachträglich auf true.
 */
export function useAppFonts(timeoutMs = FONT_TIMEOUT_MS): { ready: boolean; loaded: boolean } {
  const [loaded, error] = useFonts(interFontSources);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs]);

  return { ready: loaded || error !== null || timedOut, loaded };
}
