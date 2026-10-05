// 跨场景记忆：记录游戏等不入库场景的经历，并按需自动触发记忆总结
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SCENE_LOG_CATEGORY = 'scene_log';
const MAX_LOG_CHARS = 2500;
const SUMMARY_COOLDOWN_MS = 15 * 60_000;

export function getDataDb(source?: string) {
  const extUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
  const extKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
  if (source === 'external' && extUrl && extKey) return createClient(extUrl, extKey);
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

/** 把一段经历追加到角色的场景日志（滚动保留最近内容） */
export async function logSceneEvent(db: any, userId: string, characterId: string | undefined, scene: string, text: string) {
  if (!db || !userId || !characterId || !text) return;
  try {
    const line = `[${scene} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${String(text).replace(/\s+/g, ' ').slice(0, 200)}`;
    const { data } = await db.from('character_extracted_memories')
      .select('id, content').eq('user_id', userId).eq('character_id', characterId)
      .eq('category', SCENE_LOG_CATEGORY).limit(1).maybeSingle();
    if (data?.id) {
      const content = `${data.content}\n${line}`.slice(-MAX_LOG_CHARS);
      await db.from('character_extracted_memories').update({ content, updated_at: new Date().toISOString() }).eq('id', data.id);
    } else {
      await db.from('character_extracted_memories').insert({ user_id: userId, character_id: characterId, category: SCENE_LOG_CATEGORY, content: line });
    }
  } catch (e) {
    console.warn('[scene-memory] log failed:', e);
  }
}

/** 距上次总结超过冷却时间时，后台触发一次 generate-memory-summary（转发用户登录凭证） */
export async function maybeAutoSummarize(req: Request, db: any, userId: string, characterId: string | undefined, characterName: string, authSource?: string) {
  if (!db || !userId || !characterId) return;
  try {
    const { data } = await db.from('character_memories').select('updated_at')
      .eq('user_id', userId).eq('character_id', characterId)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (data?.updated_at && Date.now() - new Date(data.updated_at).getTime() < SUMMARY_COOLDOWN_MS) return;
    const authorization = req.headers.get('Authorization') || '';
    const task = fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-memory-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authorization, apikey: Deno.env.get('SUPABASE_ANON_KEY') || '' },
      body: JSON.stringify({ characterId, userId, characterName, authSource: authSource === 'external' ? 'external' : undefined }),
    }).then((r) => r.text()).catch((e) => console.warn('[scene-memory] summarize failed:', e));
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(task); else await task;
  } catch (e) {
    console.warn('[scene-memory] auto summarize check failed:', e);
  }
}
