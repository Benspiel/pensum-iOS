import 'react-native-url-polyfill/auto';

import {
  Account,
  Client,
  ExecutionMethod,
  Functions,
  ID,
  Messaging,
  type Models,
  Permission,
  Query,
  Role,
  TablesDB,
  Teams,
} from 'react-native-appwrite';
import { PensumError } from '../contracts';
import { asPensumError, httpError } from './errors';
import { bundleIdentifier, databaseId, endpoint, functionIds, projectId, tableIds } from './config';

export { databaseId, functionIds, tableIds, ID, Query };
export { asPensumError, statusCode } from './errors';

export const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setPlatform(bundleIdentifier)
  .setLocale('de');

export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const teams = new Teams(client);
export const messaging = new Messaging(client);
const functions = new Functions(client);

export function ownerPermissions(userId: string): string[] {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export async function listAllRows<T extends Models.Row = Models.Row>(
  tableId: string,
  queries: string[] = [],
  guard?: () => void,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    guard?.();
    const page = await tablesDB.listRows<T>({
      databaseId,
      tableId,
      queries: [...queries, Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
      total: false,
    });
    guard?.();
    rows.push(...page.rows);
    const last = page.rows.at(-1);
    if (page.rows.length < 100 || !last) return rows;
    cursor = last.$id;
  }
}

export async function executeFunction<T = unknown>(
  functionId: string,
  payload: object,
  options: { path?: string } = {},
): Promise<T> {
  let execution: Models.Execution;
  try {
    execution = await functions.createExecution({
      functionId,
      body: JSON.stringify(payload),
      async: false,
      method: ExecutionMethod.POST,
      xpath: options.path,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    throw asPensumError(error);
  }

  const status = execution.responseStatusCode;
  let body: unknown;
  try {
    body = JSON.parse(execution.responseBody);
  } catch {
    if (status >= 200 && status < 300) {
      throw new PensumError('server', 'Pensum hat eine ungültige Antwort erhalten.', status);
    }
  }
  if (status >= 200 && status < 300) return body as T;

  const message = body && typeof body === 'object' && 'error' in body &&
    typeof body.error === 'string' ? body.error : undefined;
  throw httpError(status || 502, message);
}
