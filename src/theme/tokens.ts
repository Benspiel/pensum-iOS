/**
 * Gestaltungs-Tokens der App (rein, ohne React/Expo-Importe, damit sie unter `npm test` prüfbar sind).
 * Quelle: Pensum-Web `css/pensum.css` (:root und :root[data-theme="dark"]).
 */

export type ResolvedTheme = 'light' | 'dark';

/**
 * Farben. Die Schlüssel `canvas … dangerSurface` sind die ursprünglichen der App und bleiben stabil.
 * - `surface`      = Web `--canvas-soft` (getönte Fläche: Panel, Segmented, Chips)
 * - `border`       = Web `--hairline`
 * - `hairlineSoft` = Web `--hairline-soft` (Rand von `Card`)
 * - `muted`        = Sekundärtext. Bewusst der Wert von Web `--muted-on-tint` (#636363), weil Feature-Screens
 *                    Sekundärtext auch auf `surface`/`field` setzen (#707070 läge dort unter 4,5:1).
 *                    `mutedOnCanvas` ist der Web-Wert `--muted` (nur auf `canvas` mit 4,95:1 zulässig).
 * - `faint`        = nur Deko/Icons (2,2:1 auf Weiß), niemals für Text.
 * - `accent`       = Akzent als TEXT-/Linkfarbe (dunkler als Web `#0066ff`, damit Text auf Weiß ≥ 4,5:1 erreicht).
 * - `accentFill`   = Web `--accent` (#0066ff / #3d8bff) nur für Flächen (Badge, Schalter) mit `onAccent` als Text.
 */
export const palette = {
  light: {
    canvas: '#ffffff',
    surface: '#f3f3f3',
    field: '#f0f0f0',
    border: '#e0e0e0',
    hairlineSoft: '#f0f0f0',
    ink: '#141414',
    inkSoft: '#262626',
    muted: '#636363',
    mutedOnCanvas: '#707070',
    faint: '#adadad',
    onPrimary: '#ffffff',
    accent: '#004dbf',
    accentFill: '#0066ff',
    onAccent: '#ffffff',
    accentSurface: '#e8f0ff',
    danger: '#9f2019',
    dangerSurface: '#fcebea',
  },
  dark: {
    canvas: '#121212',
    surface: '#1d1d1d',
    field: '#262626',
    border: '#333333',
    hairlineSoft: '#242424',
    ink: '#f2f2f2',
    inkSoft: '#d9d9d9',
    muted: '#a8a8a8',
    mutedOnCanvas: '#a3a3a3',
    faint: '#7d7d7d',
    onPrimary: '#141414',
    accent: '#94bfff',
    accentFill: '#3d8bff',
    onAccent: '#141414',
    accentSurface: '#1a2d4d',
    danger: '#ffaaa5',
    dangerSurface: '#46201d',
  },
} as const;

export type PensumColors = (typeof palette)[ResolvedTheme];

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
/** `pill` = Web `--r-full` (9999). Squircle-Icons: 30 % der Kantenlänge (`squircleRadius`). */
export const radius = { field: 16, card: 24, pill: 9999 } as const;
export const squircleRadius = (size: number) => Math.round(size * 0.3);

/** Mindest-Inhaltsbreite ab der Web-Layout „breit“ gilt (Seitenrand 24, größere Überschriften). */
export const WIDE_BREAKPOINT = 640;
export const gutter = (width: number) => (width >= WIDE_BREAKPOINT ? 24 : 16);

/* ---------- Schrift ---------- */

/**
 * Statische Inter-Schnitte (assets/fonts). Das Web nutzt Inter Variable mit 300 / 450 / 650 und 600 für Knöpfe.
 * iOS kann Variable-Fonts in React Native nicht gewichten; daher die nächstliegenden statischen Schnitte:
 *   300 → Light, 450 (Fließtext) → Regular 400, 500 → Medium, 600 → SemiBold,
 *   650 (Überschriften) → SemiBold 600 (siehe HEADING_WEIGHT).
 */
export const fontFamilies = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;
export type FontFace = keyof typeof fontFamilies;

/** Web `--w-head` ist 650, genau zwischen 600 und 700. SemiBold wirkt in Inter bei großen Größen dem Web näher (ohne Kerning-Enge). */
export const HEADING_WEIGHT: FontFace = 'semibold';

const faceOrder: { face: FontFace; weight: number }[] = [
  { face: 'light', weight: 300 },
  { face: 'regular', weight: 400 },
  { face: 'medium', weight: 500 },
  { face: 'semibold', weight: 600 },
  { face: 'bold', weight: 700 },
];

/** Ordnet ein CSS-/React-Native-Gewicht dem nächsten statischen Schnitt zu (450 → Regular, 650 → HEADING_WEIGHT). */
export function faceForWeight(weight: string | number | undefined): FontFace {
  if (weight === undefined || weight === 'normal') return 'regular';
  if (weight === 'bold') return 'bold';
  const n = typeof weight === 'number' ? weight : Number(weight);
  if (!Number.isFinite(n)) return 'regular';
  if (n === 650) return HEADING_WEIGHT;
  let best = faceOrder[1]!;
  for (const candidate of faceOrder) {
    // Bei Gleichstand (z. B. 450) gewinnt der leichtere Schnitt.
    if (Math.abs(candidate.weight - n) < Math.abs(best.weight - n)) best = candidate;
  }
  return best.face;
}

export const familyForWeight = (weight: string | number | undefined) => fontFamilies[faceForWeight(weight)];

/** Zahlenwert je Schnitt für die Systemschrift-Rückfalllösung (Schrift nicht geladen). */
export const fallbackWeight = (face: FontFace): '300' | '400' | '500' | '600' | '700' =>
  ({ light: '300', regular: '400', medium: '500', semibold: '600', bold: '700' } as const)[face];

export type TextVariant =
  | 'display' | 'h1' | 'h2' | 'h3' | 'h4'
  | 'bodyLg' | 'body' | 'bodySm' | 'link' | 'label' | 'fieldLabel' | 'caption'
  // bisherige Namen der App:
  | 'title' | 'section';

interface VariantSpec {
  size: number;
  /** Zeilenhöhe als Faktor der Schriftgröße (Web: display/h1 1.0, h2–h3 1.13, h4 1.25 …). */
  ratio: number;
  face: FontFace;
  /** Größe ab `WIDE_BREAKPOINT` (Web @media min-width: 640px), sonst gleich `size`. */
  wideSize?: number;
}

const heading = HEADING_WEIGHT;

/** Typografie wie Web: Überschriften ~650, Letter-Spacing 0 (nirgends negativ), Zeilenhöhe eng. */
export const typeScale: Record<TextVariant, VariantSpec> = {
  display: { size: 44, wideSize: 56, ratio: 1, face: heading },
  h1: { size: 36, wideSize: 44, ratio: 1, face: heading },
  h2: { size: 30, wideSize: 36, ratio: 1.13, face: heading },
  h3: { size: 24, wideSize: 28, ratio: 1.13, face: heading },
  h4: { size: 20, wideSize: 24, ratio: 1.25, face: heading },
  bodyLg: { size: 18, wideSize: 20, ratio: 1.38, face: 'light' },
  body: { size: 16, ratio: 1.38, face: 'regular' },
  bodySm: { size: 14, ratio: 1.43, face: 'regular' },
  link: { size: 16, ratio: 1.38, face: 'semibold' },
  label: { size: 12, ratio: 1.33, face: 'semibold' },
  fieldLabel: { size: 14, ratio: 1.43, face: 'semibold' },
  caption: { size: 12, ratio: 1.33, face: 'regular' },
  // `title` (bisher Seitenüberschrift, 32/700) ≙ h2; `section` (20/600) ≙ Web `.title`.
  title: { size: 30, wideSize: 36, ratio: 1.13, face: heading },
  section: { size: 20, ratio: 1.3, face: 'semibold' },
};

export interface ResolvedTextStyle {
  fontSize: number;
  lineHeight: number;
  fontFamily?: string;
  fontWeight?: '300' | '400' | '500' | '600' | '700';
  letterSpacing: 0;
}

/**
 * Stil einer Variante. `customFonts=false` (Inter nicht geladen) fällt auf die Systemschrift mit numerischem
 * Gewicht zurück, damit nie Text unsichtbar bleibt.
 */
export function resolveTextStyle(variant: TextVariant, options: { wide?: boolean; customFonts?: boolean } = {}): ResolvedTextStyle {
  const spec = typeScale[variant];
  const fontSize = options.wide && spec.wideSize ? spec.wideSize : spec.size;
  const base = { fontSize, lineHeight: Math.round(fontSize * spec.ratio), letterSpacing: 0 as const };
  return options.customFonts
    ? { ...base, fontFamily: fontFamilies[spec.face] }
    : { ...base, fontWeight: fallbackWeight(spec.face) };
}

/** Zeilenhöhen-Faktor einer Variante (für überschriebene Schriftgrößen). */
export const lineHeightRatio = (variant: TextVariant) => typeScale[variant].ratio;

/* ---------- Kontrast (WCAG 2.x) ---------- */

function channel(value: number) {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Ungültige Farbe: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(foreground: string, background: string) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
