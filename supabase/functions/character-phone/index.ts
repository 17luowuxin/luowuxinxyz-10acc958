// 角色的梦境小手机：从角色视角生成备忘录/日记、相册、搜索记录（使用用户自己的 API）
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireUser } from "../_shared/require-user.ts";
import { buildCharacterContext } from "../_shared/character-context.ts";
import { getDataDb } from "../_shared/scene-memory.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { characterId, userId, authSource } = await req.json();
    if (typeof characterId !== 'string' || !characterId) return json({ error: '缺少角色' }, 400);
    const auth = await requireUser(req, userId, authSource);
    if (!auth.ok) return authErrorResponse(auth, corsHeaders);
    const uid = auth.userId;
    const db = getDataDb(auth.source);

    const { data: keys } = await db.from('api_keys').select('provider, api_key').eq('user_id', uid);
    const get = (p: string) => (keys || []).find((k: any) => k.provider === p)?.api_key;
    const apiKey = get('custom');
    if (!apiKey) return json({ error: '请先在设置中配置API密钥' }, 400);
    let base = String(get('custom_base_url') || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
    const model = get('custom_model') || 'gpt-4o-mini';

    const { data: character } = await db.from('characters').select('name, persona').eq('id', characterId).eq('user_id', uid).maybeSingle();
    if (!character) return json({ error: '角色不存在' }, 404);
    const { data: profile } = await db.from('profiles').select('nickname, persona').eq('user_id', uid).maybeSingle();
    const context = await buildCharacterContext(db, uid, characterId, { chatLimit: 30 });
    const userName = profile?.nickname || '对方';

    const system = `你就是${character.name}本人，不是AI。以下是你的人设：\n${character.persona || ''}\n\n你正在和「${userName}」交往/相处。${profile?.persona ? `对方的设定：${profile.persona}` : ''}${context}

现在请生成「你自己的手机」里的私密内容，严格符合你的人设、说话风格和你们最近发生的事，全部用中文，要有活人感、细节具体，不要OOC。
只输出JSON，格式：
{"notes":[{"title":"标题","content":"备忘录或日记正文，60-200字","date":"如 昨天 23:41"}],
"photos":[{"caption":"相册里照片的画面描述，具体到构图和细节","date":"如 3天前"}],
"searches":[{"query":"浏览器搜索词","time":"如 今天 01:12"}]}
notes 4-6条（至少两条是关于${userName}的心里话），photos 6-9条，searches 8-12条（有些暴露你对${userName}的在意，有些是符合你人设的日常）。`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: '生成我的手机内容。' }], max_tokens: 3000 }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error('character-phone api error', resp.status, t);
      return json({ error: `API请求失败（${resp.status}）：${t.slice(0, 200)}` }, 502);
    }
    const data = await resp.json();
    let raw = String(data.choices?.[0]?.message?.content || '');
    raw = raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json?/g, '').replace(/```/g, '');
    const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
    let parsed: any;
    try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch { return json({ error: 'AI返回格式不正确，请重试' }, 502); }
    const arr = (v: any) => (Array.isArray(v) ? v : []);
    return json({
      notes: arr(parsed.notes), photos: arr(parsed.photos), searches: arr(parsed.searches),
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('character-phone error', e);
    return json({ error: e instanceof Error ? e.message : '未知错误' }, 500);
  }
});
