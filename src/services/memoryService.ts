import { supabase } from '@/lib/supabase';

export interface CharacterMemory {
  id: string;
  user_id: string;
  character_id: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface CharacterSummary {
  id: string;
  user_id: string;
  character_id: string;
  summary: string;
  message_count: number;
  created_at: string;
}

/** 获取角色的所有提取记忆条目 */
export async function getCharacterMemories(characterId: string, userId: string): Promise<CharacterMemory[]> {
  const { data, error } = await supabase
    .from('character_extracted_memories')
    .select('*')
    .eq('character_id', characterId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('Get memories error:', error); return []; }
  return (data || []) as unknown as CharacterMemory[];
}

/** 获取角色的最新摘要 */
export async function getCharacterSummaries(characterId: string, userId: string, limit = 3): Promise<CharacterSummary[]> {
  const { data, error } = await supabase
    .from('character_summaries')
    .select('*')
    .eq('character_id', characterId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('Get summaries error:', error); return []; }
  return (data || []) as unknown as CharacterSummary[];
}

/** 删除记忆条目 */
export async function deleteMemory(memoryId: string) {
  return supabase.from('character_extracted_memories').delete().eq('id', memoryId);
}

/** 更新记忆条目 */
export async function updateMemory(memoryId: string, content: string) {
  return supabase.from('character_extracted_memories').update({ content, updated_at: new Date().toISOString() }).eq('id', memoryId);
}

/** 删除摘要 */
export async function deleteSummary(summaryId: string) {
  return supabase.from('character_summaries').delete().eq('id', summaryId);
}

/** 构建记忆上下文注入系统提示词 */
export function buildMemoryContext(memories: CharacterMemory[], summaries: CharacterSummary[]): string {
  if (memories.length === 0 && summaries.length === 0) return '';

  let context = '\n\n【长期记忆】\n';

  if (summaries.length > 0) {
    context += '历史对话摘要：\n';
    summaries.forEach((s, i) => { context += `${i + 1}. ${s.summary}\n`; });
  }

  if (memories.length > 0) {
    const grouped: Record<string, string[]> = {};
    memories.forEach(m => {
      const cat = m.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(m.content);
    });
    const categoryNames: Record<string, string> = {
      personal: '用户个人信息', preference: '用户喜好',
      event: '重要事件', relationship: '关系记忆', other: '其他记忆',
    };
    context += '\n关键记忆：\n';
    for (const [cat, items] of Object.entries(grouped)) {
      context += `[${categoryNames[cat] || cat}]\n`;
      items.forEach(item => { context += `- ${item}\n`; });
    }
  }

  context += '\n请在对话中自然地运用这些记忆，但不要直接说"根据我的记忆"，要表现得像自然想起来的一样。\n';
  return context;
}

/** 触发记忆提取（后台调用，不阻塞UI） */
export async function triggerMemoryExtraction(
  characterId: string, userId: string,
  messages: { role: string; content: string }[],
  authSource?: string
) {
  try {
    await supabase.functions.invoke('character-memory', {
      body: { action: 'extract_memories', characterId, userId, messages, authSource },
    });
  } catch (e) { console.error('Trigger memory extraction error:', e); }
}

/** 触发对话摘要生成（后台调用，不阻塞UI） */
export async function triggerSummarize(
  characterId: string, userId: string,
  messages: { role: string; content: string }[],
  authSource?: string
) {
  try {
    await supabase.functions.invoke('character-memory', {
      body: { action: 'summarize', characterId, userId, messages, authSource },
    });
  } catch (e) { console.error('Trigger summarize error:', e); }
}
