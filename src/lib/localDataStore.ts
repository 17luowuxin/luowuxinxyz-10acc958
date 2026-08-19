export const LOCAL_DB_NAME = 'dream-phone-local-data';
const LOCAL_DB_VERSION = 2;

interface StoredRecord {
  key: string;
  userId: string;
  table: string;
  recordId: string;
  data: Record<string, unknown>;
}

interface StoredMeta {
  key: string;
  value: unknown;
}

interface StoredAsset {
  key: string;
  userId: string;
  sourceUrl: string;
  blob: Blob;
}

export interface LocalBackupPackage {
  format: 'dream-phone-local-backup';
  version: 2;
  exportedAt: string;
  userId: string;
  tables: Record<string, Record<string, unknown>[]>;
  assets: Array<{ sourceUrl: string; dataUrl: string }>;
}

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('本地数据库操作失败'));
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('本地数据库事务失败'));
    transaction.onabort = () => reject(transaction.error ?? new Error('本地数据库事务已中止'));
  });

const openLocalDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('records')) {
        const records = database.createObjectStore('records', { keyPath: 'key' });
        records.createIndex('by-user', 'userId', { unique: false });
        records.createIndex('by-user-table', ['userId', 'table'], { unique: false });
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('assets')) {
        const assets = database.createObjectStore('assets', { keyPath: 'key' });
        assets.createIndex('by-user', 'userId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本地数据库'));
  });

const getRecordId = (row: Record<string, unknown>, index: number): string => {
  if (typeof row.id === 'string' || typeof row.id === 'number') return String(row.id);
  const stableParts = ['character_id', 'group_id', 'provider', 'created_at']
    .map((field) => row[field])
    .filter((value) => value !== undefined && value !== null)
    .map(String);
  return stableParts.length > 0 ? stableParts.join(':') : `row-${index}`;
};

export async function replaceLocalTable(
  userId: string,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction('records', 'readwrite');
    const store = transaction.objectStore('records');
    const index = store.index('by-user-table');
    const range = IDBKeyRange.only([userId, table]);
    const cursorRequest = index.openKeyCursor(range);

    await new Promise<void>((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          rows.forEach((row, indexValue) => {
            const recordId = getRecordId(row, indexValue);
            const record: StoredRecord = {
              key: `${userId}:${table}:${recordId}`,
              userId,
              table,
              recordId,
              data: row,
            };
            store.put(record);
          });
          resolve();
          return;
        }
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error('清理本地旧数据失败'));
    });

    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function getLocalTable(userId: string, table: string): Promise<Record<string, unknown>[]> {
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction('records', 'readonly');
    const index = transaction.objectStore('records').index('by-user-table');
    const records = await requestResult(index.getAll(IDBKeyRange.only([userId, table])) as IDBRequest<StoredRecord[]>);
    await transactionDone(transaction);
    return records.map((record) => record.data);
  } finally {
    database.close();
  }
}

export async function countLocalTable(userId: string, table: string): Promise<number> {
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction('records', 'readonly');
    const index = transaction.objectStore('records').index('by-user-table');
    const count = await requestResult(index.count(IDBKeyRange.only([userId, table])));
    await transactionDone(transaction);
    return count;
  } finally {
    database.close();
  }
}

export async function insertLocalRow(
  userId: string,
  table: string,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  const nextRow = {
    id: crypto.randomUUID(),
    created_at: now,
    ...row,
  };
  const recordId = getRecordId(nextRow, 0);
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction('records', 'readwrite');
    transaction.objectStore('records').put({
      key: `${userId}:${table}:${recordId}`,
      userId,
      table,
      recordId,
      data: nextRow,
    } satisfies StoredRecord);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  return nextRow;
}

export async function updateLocalRows(
  userId: string,
  table: string,
  matches: (row: Record<string, unknown>) => boolean,
  changes: Record<string, unknown>,
): Promise<number> {
  const rows = await getLocalTable(userId, table);
  let changed = 0;
  const nextRows = rows.map((row) => {
    if (!matches(row)) return row;
    changed += 1;
    return { ...row, ...changes, updated_at: new Date().toISOString() };
  });
  if (changed > 0) await replaceLocalTable(userId, table, nextRows);
  return changed;
}

export async function deleteLocalRows(
  userId: string,
  table: string,
  matches: (row: Record<string, unknown>) => boolean,
): Promise<number> {
  const rows = await getLocalTable(userId, table);
  const nextRows = rows.filter((row) => !matches(row));
  const deleted = rows.length - nextRows.length;
  if (deleted > 0) await replaceLocalTable(userId, table, nextRows);
  return deleted;
}

export async function upsertLocalRow(
  userId: string,
  table: string,
  matches: (row: Record<string, unknown>) => boolean,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const rows = await getLocalTable(userId, table);
  const index = rows.findIndex(matches);
  if (index === -1) return insertLocalRow(userId, table, row);

  const nextRow = { ...rows[index], ...row, updated_at: new Date().toISOString() };
  const nextRows = [...rows];
  nextRows[index] = nextRow;
  await replaceLocalTable(userId, table, nextRows);
  return nextRow;
}

export async function setLocalMeta(key: string, value: unknown): Promise<void> {
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction('meta', 'readwrite');
    transaction.objectStore('meta').put({ key, value } satisfies StoredMeta);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export const isLocalModeEnabled = async (userId: string): Promise<boolean> =>
  (await getLocalMeta<boolean>(`local-mode:${userId}`)) === true;

export const setLocalModeEnabled = async (userId: string, enabled: boolean): Promise<void> =>
  setLocalMeta(`local-mode:${userId}`, enabled);

export async function requestPersistentLocalStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function saveLocalAsset(userId: string, sourceUrl: string, blob: Blob): Promise<void> {
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction('assets', 'readwrite');
    transaction.objectStore('assets').put({
      key: `${userId}:${sourceUrl}`,
      userId,
      sourceUrl,
      blob,
    } satisfies StoredAsset);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function getLocalAsset(userId: string, sourceUrl: string): Promise<Blob | null> {
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction('assets', 'readonly');
    const stored = await requestResult(
      transaction.objectStore('assets').get(`${userId}:${sourceUrl}`) as IDBRequest<StoredAsset | undefined>,
    );
    await transactionDone(transaction);
    return stored?.blob ?? null;
  } finally {
    database.close();
  }
}

const localAssetUrls = new Map<string, string>();

export async function getLocalAssetUrl(userId: string, sourceUrl: string): Promise<string> {
  const cacheKey = `${userId}:${sourceUrl}`;
  const cached = localAssetUrls.get(cacheKey);
  if (cached) return cached;
  const blob = await getLocalAsset(userId, sourceUrl);
  if (!blob) return sourceUrl;
  const objectUrl = URL.createObjectURL(blob);
  localAssetUrls.set(cacheKey, objectUrl);
  return objectUrl;
}

export async function countLocalAssets(userId: string): Promise<number> {
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction('assets', 'readonly');
    const count = await requestResult(transaction.objectStore('assets').index('by-user').count(userId));
    await transactionDone(transaction);
    return count;
  } finally {
    database.close();
  }
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('读取本机文件失败'));
    reader.readAsDataURL(blob);
  });

export async function getLocalMeta<T>(key: string): Promise<T | null> {
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction('meta', 'readonly');
    const result = await requestResult(transaction.objectStore('meta').get(key) as IDBRequest<StoredMeta | undefined>);
    await transactionDone(transaction);
    return (result?.value as T | undefined) ?? null;
  } finally {
    database.close();
  }
}

export async function createLocalBackup(userId: string): Promise<LocalBackupPackage> {
    const database = await openLocalDatabase();
  try {
    const transaction = database.transaction(['records', 'assets'], 'readonly');
    const recordsRequest = transaction.objectStore('records').index('by-user').getAll(IDBKeyRange.only(userId));
    const assetsRequest = transaction.objectStore('assets').index('by-user').getAll(IDBKeyRange.only(userId));
    const [records, storedAssets] = await Promise.all([
      requestResult(recordsRequest as IDBRequest<StoredRecord[]>),
      requestResult(assetsRequest as IDBRequest<StoredAsset[]>),
    ]);
    await transactionDone(transaction);

    const tables: Record<string, Record<string, unknown>[]> = {};
    for (const record of records) {
      (tables[record.table] ??= []).push(record.data);
    }

    const assets = [];
    for (const asset of storedAssets) {
      assets.push({ sourceUrl: asset.sourceUrl, dataUrl: await blobToDataUrl(asset.blob) });
    }

    return {
      format: 'dream-phone-local-backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      userId,
      tables,
      assets,
    };
  } finally {
    database.close();
  }
}

export async function importLocalBackup(
  currentUserId: string,
  backup: LocalBackupPackage,
): Promise<{ tables: number; records: number; assets: number }> {
  if (backup.format !== 'dream-phone-local-backup' || backup.version !== 2 || !backup.tables) {
    throw new Error('这不是有效的梦境小手机本地备份');
  }

  const entries = Object.entries(backup.tables);
  if (entries.some(([, rows]) => !Array.isArray(rows))) {
    throw new Error('备份中的数据表格式不正确');
  }
  const decodedAssets = await Promise.all((backup.assets ?? []).map(async (asset) => ({
    sourceUrl: asset.sourceUrl,
    blob: await fetch(asset.dataUrl).then((response) => response.blob()),
  })));

  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction(['records', 'assets'], 'readwrite');
    const deleteByUser = async (storeName: 'records' | 'assets') => {
      const request = transaction.objectStore(storeName).index('by-user').openKeyCursor(IDBKeyRange.only(currentUserId));
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          transaction.objectStore(storeName).delete(cursor.primaryKey);
          cursor.continue();
        };
        request.onerror = () => reject(request.error ?? new Error('清理本机旧数据失败'));
      });
    };
    await Promise.all([deleteByUser('records'), deleteByUser('assets')]);
    await transactionDone(transaction);
  } finally {
    database.close();
  }

  let records = 0;
  for (const [table, rows] of entries) {
    const reboundRows = rows.map((row) => {
      const nextRow = { ...row };
      if (nextRow.user_id === backup.userId) nextRow.user_id = currentUserId;
      if (table === 'profiles' && nextRow.id === backup.userId) nextRow.id = currentUserId;
      return nextRow;
    });
    await replaceLocalTable(currentUserId, table, reboundRows);
    records += reboundRows.length;
  }

  for (const asset of decodedAssets) {
    await saveLocalAsset(currentUserId, asset.sourceUrl, asset.blob);
  }

  await setLocalMeta(`backup-import:${currentUserId}`, {
    importedAt: new Date().toISOString(),
    sourceUserId: backup.userId,
    records,
    assets: backup.assets?.length ?? 0,
  });

  return { tables: entries.length, records, assets: backup.assets?.length ?? 0 };
}

export function downloadLocalBackup(backup: LocalBackupPackage): void {
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dream-phone-local-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
