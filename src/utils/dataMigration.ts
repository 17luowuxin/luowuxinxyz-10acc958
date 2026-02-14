/**
 * 数据迁移工具 - 导出/导入角色和聊天记录
 * 支持单个角色或批量导出，用于账号间数据迁移
 */
import { supabase } from '@/lib/supabase';

export interface ExportedCharacter {
  name: string;
  persona: string | null;
  opening_line: string | null;
  avatar_url: string | null;
  history_limit: number | null;
  reply_mode: string | null;
  voice_mode: string | null;
  voice_id: string | null;
  use_novel_format: boolean | null;
  transfer_enabled: boolean | null;
  sticker_enabled: boolean | null;
  online_message_count: string | null;
  auto_reply_enabled: boolean | null;
}

export interface ExportedMessage {
  role: string;
  content: string;
  created_at: string;
  image_url: string | null;
  audio_url: string | null;
}

export interface ExportedCharacterData {
  character: ExportedCharacter;
  messages: ExportedMessage[];
  memories: { summary: string; message_count: number }[];
  world_books: { name: string; content: string; is_global: boolean }[];
}

export interface ExportPackage {
  version: '1.0';
  exported_at: string;
  app: 'luowuxin';
  characters: ExportedCharacterData[];
}

/**
 * 导出单个角色的数据
 */
export async function exportSingleCharacter(
  userId: string,
  characterId: string
): Promise<ExportedCharacterData | null> {
  // 并行获取角色信息、聊天记录、记忆、世界书
  const [charRes, msgRes, memRes, wbRes] = await Promise.all([
    supabase.from('characters').select('*').eq('id', characterId).eq('user_id', userId).single(),
    supabase.from('chat_messages').select('role, content, created_at, image_url, audio_url')
      .eq('character_id', characterId).eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase.from('character_memories').select('summary, message_count')
      .eq('character_id', characterId).eq('user_id', userId),
    supabase.from('world_books').select('name, content, is_global')
      .eq('character_id', characterId).eq('user_id', userId),
  ]);

  if (charRes.error || !charRes.data) return null;

  const c = charRes.data;
  return {
    character: {
      name: c.name,
      persona: c.persona,
      opening_line: c.opening_line,
      avatar_url: c.avatar_url,
      history_limit: c.history_limit,
      reply_mode: c.reply_mode,
      voice_mode: c.voice_mode,
      voice_id: c.voice_id,
      use_novel_format: c.use_novel_format,
      transfer_enabled: c.transfer_enabled,
      sticker_enabled: c.sticker_enabled,
      online_message_count: c.online_message_count,
      auto_reply_enabled: c.auto_reply_enabled,
    },
    messages: (msgRes.data || []).map(m => ({
      role: m.role,
      content: m.content,
      created_at: m.created_at,
      image_url: m.image_url,
      audio_url: m.audio_url,
    })),
    memories: memRes.data || [],
    world_books: wbRes.data || [],
  };
}

/**
 * 导出所有角色的数据
 */
export async function exportAllCharacters(userId: string): Promise<ExportPackage | null> {
  const { data: characters, error } = await supabase
    .from('characters').select('id').eq('user_id', userId);

  if (error || !characters?.length) return null;

  const results = await Promise.all(
    characters.map(c => exportSingleCharacter(userId, c.id))
  );

  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    app: 'luowuxin',
    characters: results.filter((r): r is ExportedCharacterData => r !== null),
  };
}

/**
 * 下载导出数据为JSON文件
 */
export function downloadExportFile(data: ExportPackage, filename?: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `luowuxin-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 导入数据到当前账号
 */
export async function importData(
  userId: string,
  data: ExportPackage,
  onProgress?: (current: number, total: number, name: string) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let success = 0;

  for (let i = 0; i < data.characters.length; i++) {
    const item = data.characters[i];
    const charName = item.character.name;
    onProgress?.(i + 1, data.characters.length, charName);

    try {
      // 创建角色
      const { data: newChar, error: charErr } = await supabase
        .from('characters')
        .insert({
          user_id: userId,
          ...item.character,
        })
        .select('id')
        .single();

      if (charErr || !newChar) {
        errors.push(`角色"${charName}": ${charErr?.message || '创建失败'}`);
        continue;
      }

      const newCharId = newChar.id;

      // 并行导入消息、记忆、世界书
      const tasks: PromiseLike<any>[] = [];

      // 批量插入聊天记录（每批500条）
      if (item.messages.length > 0) {
        const batches = [];
        for (let j = 0; j < item.messages.length; j += 500) {
          batches.push(item.messages.slice(j, j + 500));
        }
        for (const batch of batches) {
          tasks.push(
            supabase.from('chat_messages').insert(
              batch.map(m => ({
                user_id: userId,
                character_id: newCharId,
                role: m.role,
                content: m.content,
                created_at: m.created_at,
                image_url: m.image_url,
                audio_url: m.audio_url,
              }))
            ).select().then(r => r)
          );
        }
      }

      // 导入记忆
      if (item.memories.length > 0) {
        tasks.push(
          supabase.from('character_memories').insert(
            item.memories.map(m => ({
              user_id: userId,
              character_id: newCharId,
              summary: m.summary,
              message_count: m.message_count,
            }))
          ).select().then(r => r)
        );
      }

      // 导入世界书
      if (item.world_books.length > 0) {
        tasks.push(
          supabase.from('world_books').insert(
            item.world_books.map(w => ({
              user_id: userId,
              character_id: newCharId,
              name: w.name,
              content: w.content,
              is_global: w.is_global,
            }))
          ).select().then(r => r)
        );
      }

      // 标记所有导入的消息为已读
      tasks.push(
        supabase.from('chat_read_status').upsert({
          user_id: userId,
          character_id: newCharId,
          last_read_at: new Date().toISOString(),
        }, { onConflict: 'user_id,character_id' }).select().then(r => r)
      );

      const results = await Promise.all(tasks);
      const hasError = results.some(r => r.error);
      if (hasError) {
        const errMsgs = results.filter(r => r.error).map(r => r.error.message);
        errors.push(`角色"${charName}"部分数据导入失败: ${errMsgs.join('; ')}`);
      }

      success++;
    } catch (e) {
      errors.push(`角色"${charName}": ${e instanceof Error ? e.message : '未知错误'}`);
    }
  }

  return { success, failed: data.characters.length - success, errors };
}

/**
 * 读取导入文件
 */
export function readImportFile(file: File): Promise<ExportPackage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.app !== 'luowuxin' || !data.characters) {
          reject(new Error('无效的备份文件格式'));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error('文件解析失败，请确认是有效的JSON文件'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}
