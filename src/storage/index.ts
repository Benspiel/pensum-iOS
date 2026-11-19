import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { type AccountScope, useSession } from '../account/session';
import { databaseId, ID, listAllRows, ownerPermissions, Query, tableIds, tablesDB } from '../backend';
import { PensumError, type KeyValueStore, type RowsApi, type StoreDeps } from '../contracts';

export const guestStorage: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const newId = () => ID.unique();

export function rowsForAccount(scope: AccountScope | null): RowsApi {
  function assertCurrent(userId?: string) {
    if (!scope || !scope.isCurrent() || (userId !== undefined && userId !== scope.userId)) {
      throw new PensumError('unauthenticated', 'Melde dich erneut an, um mit dem Konto zu arbeiten.', 401);
    }
  }

  async function guarded<T>(operation: () => Promise<T>): Promise<T> {
    assertCurrent();
    const result = await operation();
    assertCurrent();
    return result;
  }

  return {
    newId,
    ownerPermissions,
    createRow: ({ data, rowId, tableId }) => guarded(() => {
      if (!scope || data.userId !== scope.userId) {
        throw new PensumError('forbidden', 'Diese Daten gehören zu einem anderen Konto.', 403);
      }
      return tablesDB.createRow({ databaseId, tableId, rowId, data, permissions: ownerPermissions(scope.userId) });
    }),
    updateRow: ({ tableId, rowId, data }) => guarded(() => {
      if ('userId' in data && data.userId !== scope?.userId) {
        throw new PensumError('forbidden', 'Der Besitzer eines Eintrags kann nicht geändert werden.', 403);
      }
      return tablesDB.updateRow({ databaseId, tableId, rowId, data });
    }),
    deleteRow: ({ tableId, rowId }) =>
      guarded(() => tablesDB.deleteRow({ databaseId, tableId, rowId })),
    listAllRows: (tableId, { userId }) => guarded(() => {
      assertCurrent(userId);
      return listAllRows(tableId, [Query.equal('userId', userId), Query.orderAsc('$createdAt')], assertCurrent);
    }),
  };
}

/** Stable by account login, so refresh and preference updates don't recreate feature stores. */
export function useStoreDeps(onStatus?: StoreDeps['onStatus']): StoreDeps | null {
  const { state, scope } = useSession();
  const ready = state.status === 'guest' || state.status === 'account';
  return useMemo(() => ready ? {
    kv: guestStorage,
    rows: rowsForAccount(scope),
    tableIds,
    onStatus,
  } : null, [onStatus, ready, scope]);
}
