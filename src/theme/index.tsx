import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeChoice = 'system' | 'light' | 'dark';
type ResolvedTheme = Exclude<ThemeChoice, 'system'>;

const palette = {
  light: {
    canvas: '#ffffff',
    surface: '#f3f3f3',
    field: '#f0f0f0',
    border: '#e0e0e0',
    ink: '#141414',
    muted: '#636363',
    onPrimary: '#ffffff',
    accent: '#004dbf',
    accentSurface: '#e8f0ff',
    danger: '#9f2019',
    dangerSurface: '#fcebea',
  },
  dark: {
    canvas: '#121212',
    surface: '#1d1d1d',
    field: '#262626',
    border: '#383838',
    ink: '#f2f2f2',
    muted: '#a8a8a8',
    onPrimary: '#141414',
    accent: '#94bfff',
    accentSurface: '#1a2d4d',
    danger: '#ffaaa5',
    dangerSurface: '#46201d',
  },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { field: 16, card: 24, pill: 999 } as const;

type ThemeContextValue = {
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
  scheme: ResolvedTheme;
  colors: (typeof palette)[ResolvedTheme];
  persistenceError: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = 'pensum.theme';

export function PensumThemeProvider({ children }: { children: ReactNode }) {
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
    <ThemeContext.Provider value={{ choice, setChoice, scheme, colors: palette[scheme], persistenceError }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function usePensumTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('PensumThemeProvider fehlt.');
  return value;
}
