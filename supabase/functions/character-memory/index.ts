import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AIConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: string;
}

function getSupabaseClients() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cloud = createClient(supabaseUrl, supabaseKey);

  const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
  const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
  const external = externalUrl && externalKey ? createClient(externalUrl, externalKey) : null;

  return { cloud, external };
}

function getDataClient(authSource: string | undefined, cloud: any, external: any) {
  return authSource === 'external' && external ? external : cloud;
}

async function getApiConfig(supabase: any, userId: string): Promise<AIConfig> {
  const { data } = await supabase
    .from('api_keys')
    .select('provider, api_key')
    .eq('user_id', userId);

  if (!data || data.length === 0) return { provider: 'default' };

  const get = (p: string) => data.find((k: any) => k.provider === p)?.api_key;

  if (get('custom')) {
    return {
      provider: 'custom',
      apiKey: get('custom'),
      baseUrl: get('custom_base_url') || 'https://api.openai.com/v1',
      model: get('custom_model') || 'gpt-3.5-turbo',
    };
  } else if (get('deepseek')) {
    return { provider: 'deepseek', apiKey: get('deepseek') };
  } else if (get('openai')) {
    return { provider: 'openai', apiKey: get('openai') };
  }
  return { provider: 'default' };
}

async function callAI(
  messages: Array<{ role: string; content: string }>,
  config: AIConfig,
  maxTokens = 1024
): Promise<string> {
  let apiUrl: string;
  let headers: Record<string, string>;
  let body: any;

  if (config.provider === 'custom' && config.apiKey) {
    apiUrl = `${config.baseUrl}/chat/completions`;
    headers = { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };
    body = { model: config.model || 'gpt-3.5-turbo', messages, max_tokens: maxTokens };
  } else if (config.provider === 'deepseek' && config.apiKey) {
    apiUrl = 'https://api.deepseek.com/chat/completions';
    headers = { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };
    body = { model: 'deepseek-chat', messages, max_tokens: maxTokens };
  } else if (config.provider === 'openai' && config.apiKey) {
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    headers = { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };
    body = { model: 'gpt-4o-mini', messages, max_tokens: maxTokens };
  } else {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('No API configuration available');
    apiUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
    headers = { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' };
    body = { model: 'google/gemini-2.5-flash', messages, max_tokens: maxTokens };
  }

  console.log(`Using ${config.provider} for character-memory`);
  const response = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(body) });

  if (!response.ok) {
    const errText = await response.text();
    console.error('AI API error:', response.status, errText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || data.content || data.response || '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { action, characterId, userId, messages, apiKey, baseUrl, model, authSource } = await req.json();

    if (!characterId || !userId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing characterId or userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { cloud, external } = getSupabaseClients();
    const dataClient = getDataClient(authSource, cloud, external);

    // Use provided API config or fetch from DB
    let apiConfig: AIConfig;
    if (apiKey && baseUrl) {
      apiConfig = { provider: 'custom', apiKey, baseUrl, model: model || 'gpt-3.5-turbo' };
    } else {
      apiConfig = await getApiConfig(dataClient, userId);
    }

    // ========================
    // ACTION: extract_memories
    // ========================
    if (action === 'extract_memories') {
      const extractPrompt = `你是一个记忆提取助手。请从以下对话中提取重要信息，只提取值得长期记住的内容。

提取规则：
1. 用户的个人信息（姓名、年龄、职业、生日等）
2. 用户的喜好和厌恶（喜欢的食物、爱好、讨厌的事等）
3. 重要事件和约定（约会、承诺、计划等）
4. 情感关系变化（关系进展、特殊称呼等）
5. 不要提取无意义的闲聊内容
6. 每条记忆用一句话概括，要具体明确

请以JSON数组格式返回，每条记忆包含 content（内容）和 category（分类：personal/preference/event/relationship/other）。
如果没有值得记住的内容，返回空数组 []。

示例输出：
[{"content":"用户喜欢吃草莓蛋糕","category":"preference"},{"content":"用户下周三要去北京出差","category":"event"}]`;

      const conversationText = (messages || []).map((m: any) =>
        `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`
      ).join('\n');

      const rawContent = await callAI([
        { role: 'system', content: extractPrompt },
        { role: 'user', content: `以下是最近的对话记录：\n\n${conversationText}` },
      ], apiConfig);

      let memories: { content: string; category: string }[] = [];
      try {
        memories = JSON.parse(rawContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
      } catch { memories = []; }

      if (memories.length > 0) {
        // Deduplicate against existing
        const { data: existing } = await dataClient
          .from('character_extracted_memories')
          .select('content')
          .eq('user_id', userId)
          .eq('character_id', characterId);

        const existingSet = new Set((existing || []).map((m: any) => m.content.toLowerCase()));
        const newMemories = memories.filter(m => !existingSet.has(m.content.toLowerCase()));

        if (newMemories.length > 0) {
          const { error } = await dataClient.from('character_extracted_memories').insert(
            newMemories.map(m => ({
              user_id: userId,
              character_id: characterId,
              content: m.content,
              category: m.category || 'other',
            }))
          );
          if (error) console.error('Insert memories error:', error);
        }

        console.log(`Extracted ${newMemories.length} new memories for character ${characterId}`);
        return new Response(JSON.stringify({ success: true, extracted: newMemories.length }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, extracted: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========================
    // ACTION: summarize
    // ========================
    if (action === 'summarize') {
      const conversationText = (messages || []).map((m: any) =>
        `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`
      ).join('\n');

      const summary = await callAI([
        { role: 'system', content: '请将以下对话记录压缩为一段简洁的摘要（200字以内），保留关键信息、情感变化和重要事件。直接输出摘要文本。' },
        { role: 'user', content: conversationText },
      ], apiConfig, 512);

      if (summary) {
        // 获取数据库中的实际消息总数作为 message_count
        const { count: dbCount } = await dataClient
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('character_id', characterId)
          .eq('user_id', userId);
        const totalMessageCount = dbCount || (messages || []).length;
        
        const { error } = await dataClient.from('character_summaries').insert({
          user_id: userId,
          character_id: characterId,
          summary,
          message_count: totalMessageCount,
        });
        if (error) console.error('Insert summary error:', error);
      }

      console.log(`Generated summary for character ${characterId}`);
      return new Response(JSON.stringify({ success: true, summary }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('character-memory error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
