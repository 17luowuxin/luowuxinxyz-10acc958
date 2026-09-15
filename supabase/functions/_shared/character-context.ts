// 跨场景记忆同步：聊天 / 朋友圈 / 群聊 共用同一份角色记忆与近期经历
// 任何一个场景发生的事，其他场景都能"记得"。

export interface CrossContextOptions {
  includeMemories?: boolean;
  includeChat?: boolean;
  includeMoments?: boolean;
  includeGroups?: boolean;
  chatLimit?: number;
  momentLimit?: number;
  groupLimit?: number;
}

const CATEGORY_NAMES: Record<string, string> = {
  personal: '用户个人信息',
  preference: '用户喜好',
  event: '重要事件',
  relationship: '关系记忆',
  other: '其他记忆',
};

const safe = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch (e) {
    console.warn('[character-context] query failed:', e);
    return null;
  }
};

export async function buildCharacterContext(
  db: any,
  userId: string,
  characterId: string,
  options: CrossContextOptions = {},
): Promise<string> {
  if (!db || !userId || !characterId) return '';

  const {
    includeMemories = true,
    includeChat = true,
    includeMoments = true,
    includeGroups = true,
    chatLimit = 16,
    momentLimit = 5,
    groupLimit = 12,
  } = options;

  const sections: string[] = [];

  if (includeMemories) {
    const summaries = await safe(async () => {
      const { data } = await db
        .from('character_summaries')
        .select('summary')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .order('created_at', { ascending: false })
        .limit(3);
      return data as any[] | null;
    });

    const memories = await safe(async () => {
      const { data } = await db
        .from('character_extracted_memories')
        .select('content, category')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .order('created_at', { ascending: false })
        .limit(40);
      return data as any[] | null;
    });

    let block = '';
    if (summaries?.length) {
      block += '历史对话摘要：\n' + summaries.map((s, i) => `${i + 1}. ${s.summary}`).join('\n') + '\n';
    }
    if (memories?.length) {
      const grouped: Record<string, string[]> = {};
      for (const m of memories) {
        const cat = m.category || 'other';
        (grouped[cat] ||= []).push(m.content);
      }
      block += '\n关键记忆：\n';
      for (const [cat, items] of Object.entries(grouped)) {
        block += `[${CATEGORY_NAMES[cat] || cat}]\n` + items.map((i) => `- ${i}`).join('\n') + '\n';
      }
    }
    if (block) sections.push('【长期记忆】\n' + block.trim());
  }

  if (includeChat) {
    const chat = await safe(async () => {
      const { data } = await db
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .order('created_at', { ascending: false })
        .limit(chatLimit);
      return data as any[] | null;
    });
    if (chat?.length) {
      const lines = [...chat]
        .reverse()
        .map((m) => {
          const text = String(m.content || '').replace(/\s+/g, ' ').slice(0, 120);
          if (!text) return '';
          return `${m.role === 'user' ? '用户' : '我'}: ${text}`;
        })
        .filter(Boolean);
      if (lines.length) sections.push('【最近的私聊记录】\n' + lines.join('\n'));
    }
  }

  if (includeMoments) {
    const moments = await safe(async () => {
      const { data } = await db
        .from('moments')
        .select('content, is_user_post, created_at, character_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(momentLimit * 3);
      return data as any[] | null;
    });
    if (moments?.length) {
      const lines = moments
        .filter((m) => m.is_user_post || m.character_id === characterId)
        .slice(0, momentLimit)
        .map((m) => {
          const text = String(m.content || '').replace(/\s+/g, ' ').slice(0, 100);
          return text ? `${m.is_user_post ? '用户发的朋友圈' : '我发的朋友圈'}: ${text}` : '';
        })
        .filter(Boolean);
      if (lines.length) sections.push('【最近的朋友圈】\n' + lines.join('\n'));
    }
  }

  if (includeGroups) {
    const groupMsgs = await safe(async () => {
      const { data } = await db
        .from('group_messages')
        .select('sender_type, content, character_id, created_at')
        .order('created_at', { ascending: false })
        .limit(groupLimit * 4);
      return data as any[] | null;
    });
    if (groupMsgs?.length) {
      const lines = [...groupMsgs]
        .filter((m) => m.sender_type === 'user' || m.character_id === characterId)
        .slice(0, groupLimit)
        .reverse()
        .map((m) => {
          const text = String(m.content || '').replace(/\s+/g, ' ').slice(0, 100);
          return text ? `${m.sender_type === 'user' ? '用户' : '我'}(群聊): ${text}` : '';
        })
        .filter(Boolean);
      if (lines.length) sections.push('【最近的群聊】\n' + lines.join('\n'));
    }
  }

  if (!sections.length) return '';
  return (
    '\n\n' +
    sections.join('\n\n') +
    '\n\n以上是你在私聊、朋友圈、群聊里共同经历过的事。请自然地记得它们，' +
    '不要说"根据我的记忆"，也不要重复复述，更不要与既有设定或已发生的事情矛盾。\n'
  );
}
