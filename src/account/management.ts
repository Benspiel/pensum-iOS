import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { type Models } from 'react-native-appwrite';
import { account, databaseId, listAllRows, Query, tableIds, tablesDB } from '../backend';
import { PensumError, type SessionUser } from '../contracts';
import type { AccountScope } from './session';

const exportTables = {
  faecher: tableIds.subjects,
  noten: tableIds.grades,
  handschrift: tableIds.handwriting,
  mindmaps: tableIds.mindmaps,
  kartenstapel: tableIds.decks,
  karteikarten: tableIds.cards,
  planer: tableIds.planner,
  kiChats: tableIds.chats,
  kiChatNachrichten: tableIds.chatMessages,
};

const contentsTables = [
  tableIds.grades, tableIds.subjects, tableIds.handwriting, tableIds.mindmaps,
  tableIds.cards, tableIds.decks, tableIds.planner,
];

const directoryName = 'pensum-account-export';

function exportDirectory() {
  return new Directory(Paths.cache, directoryName);
}

export function clearAccountExportCache(): void {
  try {
    const directory = exportDirectory();
    if (directory.exists) directory.delete();
  } catch {
    // If iOS keeps a file handle open, the temporary cache can be removed later.
  }
}

export function requireAccountScope(scope: AccountScope, userId = scope.userId): void {
  if (userId !== scope.userId || !scope.isCurrent()) {
    throw new PensumError('unauthenticated', 'Die Sitzung ist abgelaufen. Melde dich erneut an.', 401);
  }
}

function ownRows(scope: AccountScope, tableId: string): Promise<Models.Row[]> {
  return listAllRows(tableId, [Query.equal('userId', scope.userId)], () => requireAccountScope(scope));
}

function stripRow(row: Models.Row): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => key === '$id' || !key.startsWith('$')));
}

export async function shareAccountExport(scope: AccountScope, user: SessionUser): Promise<void> {
  requireAccountScope(scope, user.id);
  if (!await Sharing.isAvailableAsync()) {
    throw new PensumError('storage', 'Die Dateifreigabe ist auf diesem Gerät nicht verfügbar.');
  }
  const entries = [];
  for (const [key, tableId] of Object.entries(exportTables)) {
    entries.push([key, (await ownRows(scope, tableId)).map(stripRow)] as const);
  }
  requireAccountScope(scope, user.id);

  const timestamp = new Date().toISOString();
  const data = {
    exportiertAm: timestamp,
    konto: { email: user.email, name: user.name, registriertAm: user.registeredAt },
    ...Object.fromEntries(entries),
  };

  const directory = exportDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, `pensum-daten-${timestamp.slice(0, 10)}.json`);
  try {
    file.create({ overwrite: true });
    file.write(JSON.stringify(data, null, 2));
    await Sharing.shareAsync(file.uri, {
      dialogTitle: 'Pensum-Daten teilen', mimeType: 'application/json', UTI: 'public.json',
    });
  } finally {
    try { if (file.exists) file.delete(); } catch { /* cache is cleaned on launch and logout */ }
  }
}

export async function clearAccountContents(scope: AccountScope): Promise<void> {
  for (const tableId of contentsTables) {
    const rows = await ownRows(scope, tableId);
    for (const row of rows) {
      requireAccountScope(scope);
      await tablesDB.deleteRow({ databaseId, tableId, rowId: row.$id });
    }
  }
}

export async function getAccountDevices(scope: AccountScope) {
  requireAccountScope(scope);
  const { sessions } = await account.listSessions();
  requireAccountScope(scope);
  return sessions.toSorted((a, b) => Number(b.current) - Number(a.current)
    || Date.parse(b.$createdAt) - Date.parse(a.$createdAt));
}
