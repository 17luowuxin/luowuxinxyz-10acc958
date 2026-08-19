import { supabase } from '@/lib/supabase';
import {
  countLocalAssets,
  countLocalTable,
  getLocalTable,
  replaceLocalTable,
  saveLocalAsset,
  setLocalMeta,
} from '@/lib/localDataStore';

const PAGE_SIZE = 1000;

const REQUIRED_TABLES = new Set(['profiles', 'customization', 'characters', 'chat_messages']);

export const LOCAL_CONTENT_TABLES = [
  'profiles',
  'customization',
  'characters',
  'character_sprites',
  'character_memories',
  'character_blocks',
  'character_summaries',
  'character_extracted_memories',
  'chat_messages',
  'chat_read_status',
  'group_chats',
  'group_messages',
  'moments',
  'comments',
  'albums',
  'photos',
  'diaries',
  'music',
  'bottles',
  'guestbook',
  'presets',
  'world_books',
  'api_keys',
  'user_stickers',
  'gift_favorites',
  'gift_history',
  'gift_custom_images',
  'dream_transactions',
  'space_logs',
  'vn_saves',
] as const;

export interface CloudMigrationResult {
  completed: boolean;
  copiedRecords: number;
  copiedAssets: number;
  tableCounts: Record<string, number>;
  warnings: string[];
}

function collectStorageUrls(value: unknown, urls: Set<string>): void {
  if (typeof value === 'string') {
    if (value.includes('/storage/v1/object/')) {
      try {
        urls.add(new URL(value, window.location.origin).href);
      } catch {
        // Ignore malformed legacy URLs; the table record itself is still preserved.
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStorageUrls(item, urls));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStorageUrls(item, urls));
  }
}

async function fetchAllUserRows(table: string, userId: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const response = await (supabase as any)
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .range(from, from + PAGE_SIZE - 1);

    if (response.error) throw response.error;
    const page = (response.data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchGroupMembers(groupIds: string[]): Promise<Record<string, unknown>[]> {
  if (groupIds.length === 0) return [];
  const rows: Record<string, unknown>[] = [];

  for (let offset = 0; offset < groupIds.length; offset += 100) {
    const ids = groupIds.slice(offset, offset + 100);
    const response = await (supabase as any).from('group_members').select('*').in('group_id', ids);
    if (response.error) throw response.error;
    rows.push(...((response.data ?? []) as Record<string, unknown>[]));
  }

  return rows;
}

/**
 * 只读取云端并复制到 IndexedDB。
 * 此流程没有任何云端 insert/update/delete/upsert 调用。
 */
export async function copyCloudDataToLocal(
  userId: string,
  onProgress?: (table: string, current: number, total: number) => void,
): Promise<CloudMigrationResult> {
  const warnings: string[] = [];
  const tableCounts: Record<string, number> = {};
  const storageUrls = new Set<string>();
  let copiedRecords = 0;
  let copiedAssets = 0;

  for (let index = 0; index < LOCAL_CONTENT_TABLES.length; index += 1) {
    const table = LOCAL_CONTENT_TABLES[index];
    onProgress?.(table, index + 1, LOCAL_CONTENT_TABLES.length + 2);

    try {
      const rows = await fetchAllUserRows(table, userId);
      await replaceLocalTable(userId, table, rows);
      const localCount = await countLocalTable(userId, table);
      if (localCount !== rows.length) {
        throw new Error(`本地校验失败：云端 ${rows.length} 条，本地 ${localCount} 条`);
      }
      tableCounts[table] = rows.length;
      copiedRecords += rows.length;
      rows.forEach((row) => collectStorageUrls(row, storageUrls));
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      if (REQUIRED_TABLES.has(table)) throw new Error(`${table} 迁移失败：${message}`);
      warnings.push(`${table}：${message}`);
    }
  }

  onProgress?.('group_members', LOCAL_CONTENT_TABLES.length + 1, LOCAL_CONTENT_TABLES.length + 2);
  try {
    const groupRows = await getLocalGroupIds(userId);
    const members = await fetchGroupMembers(groupRows);
    await replaceLocalTable(userId, 'group_members', members);
    const localCount = await countLocalTable(userId, 'group_members');
    if (localCount !== members.length) throw new Error('本地群成员数量校验失败');
    tableCounts.group_members = members.length;
    copiedRecords += members.length;
    members.forEach((row) => collectStorageUrls(row, storageUrls));
  } catch (error) {
    warnings.push(`group_members：${error instanceof Error ? error.message : '未知错误'}`);
  }

  onProgress?.('媒体文件', LOCAL_CONTENT_TABLES.length + 2, LOCAL_CONTENT_TABLES.length + 2);
  for (const sourceUrl of storageUrls) {
    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await saveLocalAsset(userId, sourceUrl, await response.blob());
      copiedAssets += 1;
    } catch (error) {
      warnings.push(`文件 ${sourceUrl}：${error instanceof Error ? error.message : '下载失败'}`);
    }
  }

  const localAssetCount = await countLocalAssets(userId);
  if (localAssetCount < copiedAssets) {
    throw new Error(`本地文件校验失败：应有 ${copiedAssets} 个，实际 ${localAssetCount} 个`);
  }

  const completed = warnings.length === 0;
  await setLocalMeta(`cloud-copy:${userId}`, {
    completed,
    copiedAt: new Date().toISOString(),
    copiedRecords,
    copiedAssets,
    tableCounts,
    warnings,
    cloudWasModified: false,
  });

  return { completed, copiedRecords, copiedAssets, tableCounts, warnings };
}

async function getLocalGroupIds(userId: string): Promise<string[]> {
  const groups = await getLocalTable(userId, 'group_chats');
  return groups.map((row) => row.id).filter((id): id is string => typeof id === 'string');
}
