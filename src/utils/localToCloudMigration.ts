import { supabase } from '@/lib/supabase';
import { createLocalBackup } from '@/lib/localDataStore';

const TABLE_ORDER = [
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
  'group_members',
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
  profiles: '个人资料', customization: '外观设置', characters: '角色', chat_messages: '聊天记录',
  group_chats: '群聊', group_members: '群成员', group_messages: '群消息', moments: '动态', comments: '评论',
  albums: '相册', photos: '图片', diaries: '日记', music: '音乐', api_keys: 'API 设置',
};

type DynamicResponse = PromiseLike<{ error: unknown }>;
const dynamicSupabase = supabase as unknown as {
  from: (table: string) => {
    upsert: (rows: Record<string, unknown>[], options?: { ignoreDuplicates?: boolean }) => DynamicResponse;
  };
};

const isLocalReference = (value: string) => value.startsWith('local-asset:') || value.startsWith('local-music:');

const collectEmbeddedFiles = (value: unknown, files: Set<string>): void => {
  if (typeof value === 'string') {
    if (value.startsWith('data:') || isLocalReference(value)) files.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectEmbeddedFiles(item, files));
    return;
  }
  if (value && typeof value === 'object') Object.values(value).forEach((item) => collectEmbeddedFiles(item, files));
};

const replaceEmbeddedFiles = (value: unknown, replacements: Map<string, string>): unknown => {
  if (typeof value === 'string') {
    if ((value.startsWith('data:') || isLocalReference(value)) && !replacements.has(value)) {
      throw new Error('有本机图片或文件无法读取');
    }
    return replacements.get(value) ?? value;
  }
  if (Array.isArray(value)) return value.map((item) => replaceEmbeddedFiles(item, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceEmbeddedFiles(item, replacements)]));
  }
  return value;
};

const stableHash = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  return (hash >>> 0).toString(36);
};

const extensionFor = (type: string) => ({
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'font/ttf': 'ttf',
  'font/otf': 'otf', 'font/woff': 'woff', 'font/woff2': 'woff2',
}[type] ?? 'bin');

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return '未知错误';
};

export interface LocalToCloudResult {
  records: number;
  files: number;
}

/**
 * Safely merges the current local snapshot into the signed-in user's cloud data.
 * Local mode is switched off by the caller only after this function finishes without error.
 */
export async function syncLocalDataToCloud(
  userId: string,
  onProgress?: (label: string, current: number, total: number) => void,
): Promise<LocalToCloudResult> {
  const backup = await createLocalBackup(userId);
  const embeddedFiles = new Set<string>();
  Object.values(backup.tables).forEach((rows) => rows.forEach((row) => collectEmbeddedFiles(row, embeddedFiles)));

  const assetData = new Map(backup.assets.map((asset) => [asset.sourceUrl, asset.dataUrl]));
  const filesToUpload = [...embeddedFiles];
  const activeTables = TABLE_ORDER.filter((table) => (backup.tables[table]?.length ?? 0) > 0);
  const total = Math.max(1, filesToUpload.length + activeTables.length);
  const replacements = new Map<string, string>();
  let completed = 0;

  for (const source of filesToUpload) {
    onProgress?.('图片和文件', completed, total);
    const readableSource = source.startsWith('data:') ? source : assetData.get(source);
    if (!readableSource) throw new Error('本机备份中缺少图片或文件，请先导出备份后重试');
    const response = await fetch(readableSource);
    if (!response.ok) throw new Error('本机图片或文件读取失败');
    const blob = await response.blob();
    const filePath = `${userId}/local-to-cloud/${stableHash(source)}.${extensionFor(blob.type)}`;
    const { error } = await supabase.storage.from('avatars').upload(filePath, blob, {
      contentType: blob.type || 'application/octet-stream',
      upsert: true,
    });
    if (error) throw new Error(`文件上传失败：${error.message}`);
    replacements.set(source, supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl);
    completed += 1;
  }

  let records = 0;
  for (const table of activeTables) {
    onProgress?.(TABLE_LABELS[table] ?? table, completed, total);
    const rows = backup.tables[table].map((row) => replaceEmbeddedFiles(row, replacements) as Record<string, unknown>);
    for (let offset = 0; offset < rows.length; offset += 200) {
      const { error } = await dynamicSupabase
        .from(table)
        .upsert(rows.slice(offset, offset + 200), table === 'bottles' ? { ignoreDuplicates: true } : undefined);
      if (error) throw new Error(`${TABLE_LABELS[table] ?? table}同步失败：${errorMessage(error)}`);
    }
    records += rows.length;
    completed += 1;
  }

  onProgress?.('同步完成', total, total);
  return { records, files: filesToUpload.length };
}
