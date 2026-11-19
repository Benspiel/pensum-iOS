/* Vier gewinnt – Haptik. Web: navigator.vibrate(10) beim Zug, [20, 40, 20] beim Spielende durch den eigenen Zug (common.js, haptic).
 * Hier über expo-haptics; Fehler (kein Taptic Engine, Simulator) werden verschluckt. */
import * as Haptics from "expo-haptics";

export type HapticKind = "light" | "success" | "warning";

export function haptic(kind: HapticKind = "light"): void {
  try {
    const run = kind === "light"
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.notificationAsync(kind === "success" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    void Promise.resolve(run).catch(() => { /* egal */ });
  } catch { /* egal */ }
}
