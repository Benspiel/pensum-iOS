/* Karteikarten – Haptik der Lernrunde (Web: buzz() in karteikarten.js). Leitet auf die gemeinsame Haptik der App weiter
 * (src/ui/haptics.ts): Umdrehen ist ein Auswahl-Tick, „nicht gewusst“ eine Warnung, die fertige Runde eine Erfolgsmeldung. */
import { haptic as feedback } from "../../../ui/haptics";

export type HapticKind = "start" | "flip" | "right" | "wrong" | "done";

const KIND = { start: "tap", flip: "select", right: "tap", wrong: "warn", done: "success" } as const;

export function haptic(kind: HapticKind): void {
  feedback(KIND[kind]);
}
