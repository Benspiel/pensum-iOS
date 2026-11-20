/* Push-Benachrichtigungen über Appwrite Messaging.
 * Das Gerät holt seinen Apple-Push-Token (APNs), meldet ihn in Appwrite als Push-Ziel an (Anbieter „Pensum Apple“) und abonniert das Thema „alle“.
 * Nachrichten an alle schreibst du in der Appwrite Console (Messaging → Messages); die täglichen Erinnerungen sendet die Function `push-daily`.
 * Die Wünsche (Karteikarten/Mindmap, Uhrzeit) liegen je Gerät in `push_devices`. Alles hier ist Zugabe: Fehler werden als Text gemeldet, nie geworfen. */
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Models } from 'react-native-appwrite';
import { account, databaseId, ownerPermissions, tableIds, tablesDB, messaging } from '../backend';
import { pushProviderId, pushTopicId } from '../backend/config';
import { deviceRowId, prefsFromRow, type PushPrefs } from './model';

export { DEFAULT_PUSH_PREFS, hourLabel, stepHour, summary, type PushPrefs } from './model';

// Im Vordergrund trotzdem als Banner zeigen
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

const supported = Platform.OS === 'ios' || Platform.OS === 'android';
type DeviceRow = Models.Row & { userId: string; token: string; cards: boolean; cardsHour: number; mindmap: boolean; mindmapHour: number };
export type PushStatus = 'unsupported' | 'denied' | 'undetermined' | 'granted';

const codeOf = (reason: unknown) => (reason as { code?: number } | null)?.code;

export async function pushStatus(): Promise<PushStatus> {
  if (!supported) return 'unsupported';
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    return status === 'undetermined' || canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** Fragt die Berechtigung an (falls nötig) und liefert den Apple-Push-Token dieses Geräts. */
export async function requestToken(): Promise<{ token: string } | { error: string }> {
  if (!supported) return { error: 'Benachrichtigungen gibt es nur auf iPhone, iPad und Android.' };
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return { error: 'Benachrichtigungen sind für Pensum ausgeschaltet. Du kannst sie in den iOS-Einstellungen unter „Mitteilungen“ erlauben.' };
    const { data } = await Notifications.getDevicePushTokenAsync();
    return { token: String(data) };
  } catch (reason) {
    return { error: reason instanceof Error ? reason.message : 'Der Benachrichtigungs-Dienst ist gerade nicht erreichbar.' };
  }
}

async function rowIdFor(token: string): Promise<string> {
  return deviceRowId(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token));
}

/** Gespeicherte Wünsche dieses Geräts (null = für Benachrichtigungen nicht angemeldet). Fragt die Berechtigung nie von selbst an. */
export async function loadDevice(): Promise<PushPrefs | null> {
  if (await pushStatus() !== 'granted') return null;
  const found = await requestToken();
  if ('error' in found) return null;
  try {
    const row = await tablesDB.getRow<DeviceRow>({ databaseId, tableId: tableIds.pushDevices, rowId: await rowIdFor(found.token) });
    return prefsFromRow(row);
  } catch {
    return null;
  }
}

/** Legt Push-Ziel, Themen-Abo und Zeile dieses Geräts an oder aktualisiert sie (fragt bei Bedarf die Berechtigung an). */
export async function saveDevice(userId: string, prefs: PushPrefs): Promise<{ ok: true } | { error: string }> {
  const found = await requestToken();
  if ('error' in found) return found;
  const id = await rowIdFor(found.token); // gleiche ID für Ziel, Abo und Zeile
  try {
    try {
      await account.createPushTarget({ targetId: id, identifier: found.token, providerId: pushProviderId });
    } catch (reason) {
      if (codeOf(reason) !== 409) throw reason;
      await account.updatePushTarget({ targetId: id, identifier: found.token });
    }
    try {
      await messaging.createSubscriber({ topicId: pushTopicId, subscriberId: id, targetId: id });
    } catch (reason) {
      if (codeOf(reason) !== 409) throw reason; // Abo besteht schon
    }
    const data = { userId, token: found.token, targetId: id, platform: Platform.OS, ...prefs };
    try {
      await tablesDB.updateRow({ databaseId, tableId: tableIds.pushDevices, rowId: id, data });
    } catch (reason) {
      if (codeOf(reason) !== 404) throw reason;
      await tablesDB.createRow({ databaseId, tableId: tableIds.pushDevices, rowId: id, data, permissions: ownerPermissions(userId) });
    }
    return { ok: true };
  } catch (reason) {
    return { error: reason instanceof Error ? reason.message : 'Die Einstellung konnte nicht gespeichert werden.' };
  }
}

/** Entfernt dieses Gerät (Ausschalten oder Abmelden), damit keine Nachrichten mehr ankommen. Fehler sind unwichtig. */
export async function removeDevice(): Promise<void> {
  try {
    if (await pushStatus() !== 'granted') return;
    const found = await requestToken();
    if ('error' in found) return;
    const id = await rowIdFor(found.token);
    await messaging.deleteSubscriber({ topicId: pushTopicId, subscriberId: id }).catch(() => undefined);
    await account.deletePushTarget({ targetId: id }).catch(() => undefined);
    await tablesDB.deleteRow({ databaseId, tableId: tableIds.pushDevices, rowId: id }).catch(() => undefined);
  } catch {
    // war nicht angemeldet oder offline
  }
}
