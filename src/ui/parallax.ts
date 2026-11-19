/* Parallax der Startseite – reine Rechenregeln, ohne React Native.
 * Vorlage: js/parallax.js und css/pensum.css (.px-*) der Website, Web-Commit 770dbe4.
 *
 * Eine Ebene liegt im Inhalt der Seite und scrollt mit. Zusätzlich verschiebt sie sich um `scroll * speed * factor`:
 * positiver Faktor = langsamer als die Seite, negativer = gegenläufig (wie data-parallax im Web).
 * Auf schmalen Geräten fällt die Bewegung halb so stark aus. Bei „Bewegung reduzieren“ passiert nichts. */

export const NARROW_WIDTH = 768;

/** Bewegungsstärke: auf schmalen Geräten die Hälfte (wie `window.innerWidth < 768` im Web). */
export const motionFactor = (width: number): number => (width < NARROW_WIDTH ? 0.5 : 1);

/** Zusätzliche Verschiebung einer Ebene in Punkten bei Scrollstand `y`. */
export function parallaxOffset(y: number, speed: number, factor: number): number {
  return Math.max(0, y) * speed * factor;
}

/** Deckkraft des Hero-Textes: blendet über 85 % der Fensterhöhe aus (wie data-fade im Web). */
export function heroOpacity(y: number, viewportHeight: number): number {
  if (viewportHeight <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - Math.max(0, y) / (viewportHeight * 0.85)));
}

/** Ebenen des Hintergrunds. Maße in Anteilen von Breite (w) oder Inhaltshöhe (h), damit sie auf jedem Gerät passen. */
export interface BlobSpec { id: string; top: number; side: 'left' | 'right'; inset: number; speed: number; alpha: { light: number; dark: number }; }
export interface RingSpec { id: string; top: number; right: number; speed: number; dashed: boolean; }
export interface DotsSpec { id: string; top: number; right: number; speed: number; opacity: number; }

/** Zwei dezente blaue Farbflächen (Web: .px-blue und eine zweite, schwächere auf der anderen Seite). */
export const BLOBS: readonly BlobSpec[] = [
  { id: 'blue', top: 0.01, side: 'left', inset: -0.14, speed: 0.16, alpha: { light: 0.13, dark: 0.2 } },
  { id: 'blue-low', top: 0.4, side: 'right', inset: -0.16, speed: -0.12, alpha: { light: 0.09, dark: 0.14 } },
];

/** Auf Telefonen sichtbar sind wie im Web nur der erste Ring und das erste Punktraster. */
export const RING: RingSpec = { id: 'ring', top: 0.045, right: -0.12, speed: 0.28, dashed: false };
export const DOTS: DotsSpec = { id: 'dots', top: 0.3, right: 0.04, speed: 0.34, opacity: 0.45 };

/** Größe einer Farbfläche: auf schmalen Geräten 90 % der Breite, sonst höchstens 640 und 56 % (Web: width). */
export function blobSize(width: number): number {
  return width < NARROW_WIDTH ? width * 0.9 : Math.min(width * 0.56, 640);
}

/** Ring: clamp(120, 18vw, 240). */
export const ringSize = (width: number): number => Math.min(240, Math.max(120, width * 0.18));

/** Punktraster: clamp(120, 16vw, 220), Abstand 22. */
export const dotsSize = (width: number): number => Math.min(220, Math.max(120, width * 0.16));
export const DOT_GAP = 22;
