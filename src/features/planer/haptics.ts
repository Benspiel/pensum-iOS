/* Planer – Haptik. Web: navigator.vibrate (planer.js, buzz). Hier über expo-haptics; Fehler (kein Taptic Engine, Simulator) werden verschluckt. */
import * as Haptics from "expo-haptics";

export type HapticKind = "light" | "medium" | "success";

export function haptic(kind: HapticKind = "light"): void {
  try {
    const run = kind === "success"
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    void Promise.resolve(run).catch(() => { /* egal */ });
  } catch (_) { /* egal */ }
}
