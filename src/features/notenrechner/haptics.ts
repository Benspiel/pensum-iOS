/* Notenrechner – Haptik (Web: navigator.vibrate). Fehler (z. B. Gerät ohne Taptic Engine, Stromsparmodus) werden gefangen. */
import * as Haptics from "expo-haptics";

export type HapticKind = "light" | "medium" | "success" | "warning";

const run = (fn: () => Promise<void>) => { try { void fn().catch(() => {}); } catch (_) { /* keine Haptik verfügbar */ } };

export function haptic(kind: HapticKind = "light"): void {
  if (kind === "success") run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  else if (kind === "warning") run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  else run(() => Haptics.impactAsync(kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light));
}
