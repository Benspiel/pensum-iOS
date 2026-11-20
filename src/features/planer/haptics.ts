/* Planer – Haptik. Leitet auf die gemeinsame Haptik der App weiter (src/ui/haptics.ts, Begriffe wie Web js/haptics.js). */
import { haptic as feedback } from "../../ui/haptics";

export type HapticKind = "light" | "medium" | "success" | "warning";

const KIND = { light: "tap", medium: "send", success: "success", warning: "warn" } as const;

export function haptic(kind: HapticKind = "light"): void {
  feedback(KIND[kind]);
}
