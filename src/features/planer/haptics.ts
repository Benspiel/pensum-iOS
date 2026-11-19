/* Planer – Haptik. Web: navigator.vibrate (planer.js, buzz). Hier vorerst ohne Wirkung: `expo-haptics` ist nicht installiert.
 * Sobald das Paket da ist, genügt es, diese eine Funktion mit Haptics.impactAsync(...) zu füllen. */
export type HapticKind = "light" | "medium";

export function haptic(_kind: HapticKind = "light"): void {
  /* bewusst leer */
}
