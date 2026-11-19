/* Haptisches Feedback (Web: navigator.vibrate, buzz() in karteikarten.js, Web-Commit 770dbe4). Kurze Impulse über expo-haptics;
 * Fehler (z. B. Gerät ohne Taptic Engine, Simulator) werden verschluckt. */
import * as Haptics from "expo-haptics";

export type HapticKind = "start" | "flip" | "right" | "wrong" | "done";

export function haptic(kind: HapticKind): void {
  try {
    const run = (p: Promise<void>) => { p.catch(() => undefined); };
    switch (kind) {
      case "start": run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); break;
      case "flip": run(Haptics.selectionAsync()); break;
      case "right": run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); break;
      case "wrong": run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)); break;
      case "done": run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); break;
    }
  } catch {
    // egal
  }
}
