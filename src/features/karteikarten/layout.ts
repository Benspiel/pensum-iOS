/* Karteikarten – Layout-Entscheidungen für breite Fenster (iPad). Reine Funktionen ohne React Native, deshalb testbar.
 * Telefon und schmale Fenster bleiben bei einer Spalte; auf breiten Fenstern stehen Stapelliste (Master) und gewählter Stapel (Detail) nebeneinander.
 * Lernrunde, Ladeschritt und Ergebnis nehmen den ganzen Inhaltsbereich ein (große, zentrierte Lernkarte). */
import type { View } from "./session-model";

/** Höchstbreite der Lernkarte, des Ladeschritts und des Ergebnisses (zentriert). */
export const STUDY_MAX_WIDTH = 720;
/** Höchstbreite der Dialoge (Neuer Stapel, Karte bearbeiten, Lernart) als zentriertes Blatt. */
export const DIALOG_MAX_WIDTH = 560;
/** Kürzeste Fensterseite (pt), ab der ein Tablet-Fenster gilt (iPad ab Hochformat-Fenster von 600 pt; Telefone auch quer darunter). */
export const TABLET_SHORT_SIDE = 600;

/** Tablet-Fenster: kurze Seite ≥ 600 pt und Schrift höchstens 1,25 (sonst bleibt das Telefon-Layout, das mit großer Schrift besser zurechtkommt). */
export function isTabletWindow(width: number, height: number, fontScale: number): boolean {
  return Math.min(width, height) >= TABLET_SHORT_SIDE && fontScale <= 1.25;
}

export type KkLayout =
  /** eine Spalte wie auf dem Telefon: Ansicht = Liste, Stapel, Ladeschritt, Runde oder Ergebnis */
  | { mode: "single" }
  /** Master (Stapelliste) links, rechts der gewählte Stapel oder ein Leerzustand */
  | { mode: "split"; detail: "deck" | "empty" };

/**
 * Liste und Stapel stehen auf breiten Fenstern nebeneinander. Ladeschritt, Runde und Ergebnis (und der Startzustand „boot“)
 * brauchen die ganze Breite: sie lösen die Zweispaltigkeit auf und kehren danach (Stapel/Liste) zurück.
 */
export function kkLayout(viewName: View["name"], split: boolean): KkLayout {
  if (!split) return { mode: "single" };
  if (viewName === "deck") return { mode: "split", detail: "deck" };
  if (viewName === "list") return { mode: "split", detail: "empty" };
  return { mode: "single" };
}

/** Der in der Stapelliste markierte Stapel: nur in der Stapelansicht. */
export const selectedDeckId = (view: View): string | null => (view.name === "deck" ? view.id : null);

/** Leerzustand der rechten Spalte, solange kein Stapel gewählt ist. */
export function detailPlaceholder(deckCount: number): { title: string; message: string } {
  return deckCount
    ? { title: "Wähle einen Stapel.", message: "Tippe links auf einen Stapel, um zu lernen, Karten anzusehen oder neue hinzuzufügen." }
    : { title: "Hier erscheint dein Stapel.", message: "Lege links deinen ersten Stapel an." };
}

/** Mindesthöhe der Lernkarte: füllt den Platz bis zu den Knöpfen; auf Tablets darf sie größer werden (Telefon: höchstens 560). */
export function studyCardMinHeight(windowWidth: number, windowHeight: number): number {
  const max = windowWidth >= 720 ? 640 : 560;
  return Math.max(280, Math.min(max, windowHeight - 380));
}

/** Schriftgröße auf der Lernkarte: 26 (Telefon), 34 (ab 640 pt), 42 (ab 900 pt). */
export function studyFaceFontSize(windowWidth: number): number {
  return windowWidth >= 900 ? 42 : windowWidth >= 640 ? 34 : 26;
}
