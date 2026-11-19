import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { palette, type PensumColors, type ResolvedTheme } from './tokens';

export type ThemeChoice = 'system' | 'light' | 'dark';

export * from './tokens';

type ThemeContextValue = {
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
  scheme: ResolvedTheme;
  colors: PensumColors;
  /** true, sobald Inter geladen ist; sonst rendert die App mit der Systemschrift. */
  customFonts: boolean;
  persistenceError: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = 'pensum.theme';

export function PensumThemeProvider({ children, customFonts = false }: { children: ReactNode; customFonts?: boolean }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>('system');
  const [persistenceError, setPersistenceError] = useState(false);
  const changes = useRef(0);
  const pendingWrite = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (active && changes.current === 0 && (saved === 'light' || saved === 'dark')) {
        setChoiceState(saved);
      }
    }).catch(() => {
      // Systemdarstellung bleibt auch bei nicht verfügbarem Speicher benutzbar.
    });
    return () => { active = false; };
  }, []);

  function setChoice(next: ThemeChoice) {
    const change = ++changes.current;
    setChoiceState(next);
    setPersistenceError(false);
    pendingWrite.current = pendingWrite.current
      .then(() => next === 'system'
        ? AsyncStorage.removeItem(THEME_KEY)
        : AsyncStorage.setItem(THEME_KEY, next))
      .catch(() => {
        if (changes.current === change) setPersistenceError(true);
      });
  }

  const scheme = choice === 'system' ? (system === 'dark' ? 'dark' : 'light') : choice;
  return (
    <ThemeContext.Provider value={{ choice, setChoice, scheme, colors: palette[scheme], customFonts, persistenceError }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function usePensumTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('PensumThemeProvider fehlt.');
  return value;
}
