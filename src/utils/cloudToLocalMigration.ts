import { supabase } from '@/lib/supabase';
import {
  createLocalBackup,
  importLocalBackup,
  LocalBackupPackage,
  setLocalMeta,
} from '@/lib/localDataStore';

const PAGE_SIZE = 1000;

type DynamicQueryResponse = {
  data: Record<string, unknown>[] | null;
  error: unknown;
};

type DynamicFilterQuery = {
  eq: (column: string, value: string) => { range: (from: number, to: number) => Promise<DynamicQueryResponse> };
  in: (column: string, values: string[]) => { range: (from: number, to: number) => Promise<DynamicQueryResponse> };
};

const dynamicSupabase = supabase as unknown as {
  from: (table: string) => { select: (columns: string) => DynamicFilterQuery };
};

const REQUIRED_TABLES = new Set([
  'profiles',
  'customization',
  'characters',
  'chat_messages',
  'api_keys',
]);

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

const TABLE_LABELS: Record<string, string> = {
  profiles: '个人资料',
  customization: '外观与壁纸',
  characters: '角色',
  character_sprites: '角色立绘',
  character_memories: '角色记忆',
  character_blocks: '拉黑记录',
  character_summaries: '角色总结',
  character_extracted_memories: '提取记忆',
  chat_messages: '聊天记录',
  chat_read_status: '消息已读状态',
  group_chats: '群聊',
  group_members: '群成员',
  group_messages: '群聊消息',
  moments: '动态',
  comments: '评论',
  albums: '相册',
  photos: '照片',
  diaries: '日记',
  music: '音乐',
  bottles: '漂流瓶',
  guestbook: '留言板',
  presets: '预设',
  world_books: '世界书',
  api_keys: 'API 设置',
  user_stickers: '表情包',
  gift_favorites: '礼物收藏',
  gift_history: '礼物记录',
  gift_custom_images: '自定义礼物图片',
  dream_transactions: '转账记录',
  space_logs: '空间记录',
  vn_saves: '视觉小说存档',
};

export interface CloudMigrationResult {
  completed: boolean;
  copiedRecords: number;
  copiedAssets: number;
  tableCounts: Record<string, number>;
  warnings: string[];
  skippedTables: string[];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; code?: unknown };
    const message = typeof value.message === 'string' ? value.message : '未知错误';
    return typeof value.code === 'string' ? `${message}（${value.code}）` : message;
  }
  return typeof error === 'string' ? error : '未知错误';
}

function isMissingOptionalTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { message?: unknown; code?: unknown };
  const code = typeof value.code === 'string' ? value.code : '';
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : '';
  return code === 'PGRST205'
    || code === '42P01'
    || message.includes('could not find the table')
    || message.includes('does not exist');
}

function collectStorageUrls(value: unknown, urls: Set<string>): void {
  if (typeof value === 'string') {
    if (value.includes('/storage/v1/object/')) {
      try {
        urls.add(new URL(value, window.location.origin).href);
      } catch {
        // Legacy malformed URL: keep the table row, but there is no valid file to download.
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

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsDataURL(blob);
  });

async function fetchAllUserRows(table: string, userId: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const response = await dynamicSupabase
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
    let from = 0;
    while (true) {
      const response = await dynamicSupabase
        .from('group_members')
        .select('*')
        .in('group_id', ids)
        .range(from, from + PAGE_SIZE - 1);
      if (response.error) throw response.error;
      const page = (response.data ?? []) as Record<string, unknown>[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  return rows;
}

function getFileLabel(sourceUrl: string): string {
  try {
    const name = decodeURIComponent(new URL(sourceUrl).pathname.split('/').pop() ?? '未知文件');
    return name.length > 55 ? `${name.slice(0, 52)}...` : name;
  } catch {
    return '未知文件';
  }
}

/**
 * Read-only cloud copy. Cloud rows and files are never updated or deleted.
 * Missing optional feature tables are skipped because they cannot contain user data.
 */
export async function copyCloudDataToLocal(
  userId: string,
  onProgress?: (label: string, current: number, total: number) => void,
): Promise<CloudMigrationResult> {
  const warnings: string[] = [];
  const skippedTables: string[] = [];
  const tableCounts: Record<string, number> = {};
  const tables: Record<string, Record<string, unknown>[]> = {};
  const storageUrls = new Set<string>();
  const totalSteps = LOCAL_CONTENT_TABLES.length + 2;

  await setLocalMeta(`cloud-copy:${userId}`, {
    completed: false,
    startedAt: new Date().toISOString(),
    cloudWasModified: false,
  });

  // Custom fonts are intentionally local-only, so preserve them while refreshing cloud data.
  const existingLocalBackup = await createLocalBackup(userId);
  const customFonts = existingLocalBackup.tables.custom_fonts ?? [];
  const customFontUrls = new Set(
    customFonts
      .map((row) => row.source_url)
      .filter((url): url is string => typeof url === 'string'),
  );
  if (customFonts.length > 0) {
    tables.custom_fonts = customFonts;
    tableCounts.custom_fonts = customFonts.length;
  }

  for (let index = 0; index < LOCAL_CONTENT_TABLES.length; index += 1) {
    const table = LOCAL_CONTENT_TABLES[index];
    onProgress?.(TABLE_LABELS[table] ?? table, index + 1, totalSteps);
    try {
      const rows = await fetchAllUserRows(table, userId);
      tables[table] = rows;
      tableCounts[table] = rows.length;
      rows.forEach((row) => collectStorageUrls(row, storageUrls));
    } catch (error) {
      if (!REQUIRED_TABLES.has(table) && isMissingOptionalTable(error)) {
        tables[table] = [];
        skippedTables.push(TABLE_LABELS[table] ?? table);
        continue;
      }
      const message = `${TABLE_LABELS[table] ?? table}：${getErrorMessage(error)}`;
      if (REQUIRED_TABLES.has(table)) {
        throw new Error(`关键数据读取失败：${message}`);
      }
      warnings.push(message);
    }
  }

  onProgress?.('群成员', LOCAL_CONTENT_TABLES.length + 1, totalSteps);
  try {
    const groupIds = (tables.group_chats ?? [])
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string');
    const rows = await fetchGroupMembers(groupIds);
    tables.group_members = rows;
    tableCounts.group_members = rows.length;
    rows.forEach((row) => collectStorageUrls(row, storageUrls));
  } catch (error) {
    warnings.push(`群成员：${getErrorMessage(error)}`);
  }

  const assets: LocalBackupPackage['assets'] = existingLocalBackup.assets.filter((asset) => customFontUrls.has(asset.sourceUrl));
  onProgress?.('图片和文件', totalSteps, totalSteps);
  for (const sourceUrl of storageUrls) {
    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error(`下载失败 HTTP ${response.status}`);
      assets.push({ sourceUrl, dataUrl: await blobToDataUrl(await response.blob()) });
    } catch (error) {
      warnings.push(`文件 ${getFileLabel(sourceUrl)}：${getErrorMessage(error)}`);
    }
  }

  const requiredMissing = [...REQUIRED_TABLES].filter((table) => !tables[table]);
  if (requiredMissing.length > 0) {
    const labels = requiredMissing.map((table) => TABLE_LABELS[table] ?? table).join('、');
    throw new Error(`关键数据未能读取：${labels}`);
  }

  const backup: LocalBackupPackage = {
    format: 'dream-phone-local-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    userId,
    tables,
    assets,
  };
  const imported = await importLocalBackup(userId, backup);
  // A migration is complete only when every available row and file was copied.
  const completed = warnings.length === 0;

  await setLocalMeta(`cloud-copy:${userId}`, {
    completed,
    copiedAt: new Date().toISOString(),
    copiedRecords: imported.records,
    copiedAssets: imported.assets,
    tableCounts,
    warnings,
    skippedTables,
    cloudWasModified: false,
  });

  return {
    completed,
    copiedRecords: imported.records,
    copiedAssets: imported.assets,
    tableCounts,
    warnings,
    skippedTables,
  };
}
