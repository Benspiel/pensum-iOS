/**
 * Haptik der ganzen App – eine Quelle, dieselben Begriffe wie die Website (`js/haptics.js`):
 *
 *   tap      Knopf, Zeile, Kachel, Menü öffnen   → leichter Impuls
 *   select   Auswahl wechseln (Chip, Segment)    → Auswahl-Tick
 *   open     Blatt, Liste, Bereich auf           → leichter Impuls
 *   close    Blatt, Liste, Bereich zu            → weicher Impuls
 *   send     Abschicken, Exportieren, Speichern  → mittlerer Impuls
 *   success  fertig, gespeichert, gewusst        → Erfolgsmeldung
 *   warn     Löschen, Verwerfen, nicht gewusst   → Warnmeldung
 *   error    Fehler                              → Fehlermeldung
 *
 * `expo-haptics` wirkt nur auf dem Gerät: im Web und auf Geräten ohne Taptic Engine passiert still nichts,
 * Fehler (Stromsparmodus, Simulator) werden verschluckt. Die Systemeinstellung für Vibration beachtet iOS selbst,
 * deshalb wird hier nichts zusätzlich abgeschaltet – anders als im Web, wo `navigator.vibrate` kein Systemschalter kennt.
 *
 * Verwendung: `haptic("tap")`. In den Bausteinen aus `src/ui` steckt sie schon drin (Button, Chip, Segmented,
 * Disclosure, BottomSheet, PressableScale mit `haptic="…"`), eigene Pressables geben sie über `PressableScale` mit.
 */
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export type HapticKind = "tap" | "select" | "open" | "close" | "send" | "success" | "warn" | "error";

const available = Platform.OS === "ios" || Platform.OS === "android";

function run(start: () => Promise<void>): void {
  if (!available) return;
  try {
    void start().catch(() => undefined);
  } catch {
    // Haptik ist nur Zugabe und darf nie eine Aktion verhindern.
  }
}

const impact = (style: Haptics.ImpactFeedbackStyle) => run(() => Haptics.impactAsync(style));
const notify = (type: Haptics.NotificationFeedbackType) => run(() => Haptics.notificationAsync(type));

export function haptic(kind: HapticKind = "tap"): void {
  switch (kind) {
    case "select": run(() => Haptics.selectionAsync()); break;
    case "open": impact(Haptics.ImpactFeedbackStyle.Light); break;
    case "close": impact(Haptics.ImpactFeedbackStyle.Soft); break;
    case "send": impact(Haptics.ImpactFeedbackStyle.Medium); break;
    case "success": notify(Haptics.NotificationFeedbackType.Success); break;
    case "warn": notify(Haptics.NotificationFeedbackType.Warning); break;
    case "error": notify(Haptics.NotificationFeedbackType.Error); break;
    default: impact(Haptics.ImpactFeedbackStyle.Light); break;
  }
}
