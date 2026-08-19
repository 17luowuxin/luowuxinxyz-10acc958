import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authErrorResponse, requireUser } from "../_shared/require-user.ts";

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

async function checkDefaultApiSetting(supabase: any, userId: string): Promise<AIConfig> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('user_id', userId);

  if (error || !data || data.length === 0) {
    return { provider: 'default' };
  }

  const customKey = data.find((k: any) => k.provider === 'custom');
  const deepseekKey = data.find((k: any) => k.provider === 'deepseek');
  const openaiKey = data.find((k: any) => k.provider === 'openai');
  const baseUrl = data.find((k: any) => k.provider === 'custom_base_url');
  const model = data.find((k: any) => k.provider === 'custom_model');

  if (customKey) {
    return {
      provider: 'custom',
      apiKey: customKey.api_key,
      baseUrl: baseUrl?.api_key || 'https://api.openai.com/v1',
      model: model?.api_key || 'gpt-3.5-turbo',
    };
  } else if (deepseekKey) {
    return {
      provider: 'deepseek',
      apiKey: deepseekKey.api_key,
    };
  } else if (openaiKey) {
    return {
      provider: 'openai',
      apiKey: openaiKey.api_key,
    };
  }

  return { provider: 'default' };
}

async function getAICompletion(
  messages: Array<{ role: string; content: string }>,
  config: AIConfig
): Promise<string> {
  let apiUrl: string;
  let headers: Record<string, string>;
  let body: any;

  if (config.provider === 'custom' && config.apiKey) {
    apiUrl = `${config.baseUrl}/chat/completions`;
    headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
    body = {
      model: config.model || 'gpt-3.5-turbo',
      messages,
      max_tokens: 2048,
    };
  } else if (config.provider === 'deepseek' && config.apiKey) {
    apiUrl = 'https://api.deepseek.com/chat/completions';
    headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
    body = {
      model: 'deepseek-chat',
      messages,
      max_tokens: 2048,
    };
  } else if (config.provider === 'openai' && config.apiKey) {
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
    body = {
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 2048,
    };
  } else {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('No API configuration available');
    }
    apiUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
    headers = {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    };
    body = {
      model: 'google/gemini-2.5-flash',
      messages,
      max_tokens: 2048,
    };
  }

  console.log(`Using ${config.provider} API for memory summary`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API error:', response.status, errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  } else if (data.choices?.[0]?.text) {
    return data.choices[0].text;
  } else if (data.content) {
    return data.content;
  } else if (data.response) {
    return data.response;
  }

  console.error('Unexpected response format:', JSON.stringify(data));
  throw new Error('Could not extract content from AI response');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let { characterId, userId, characterName, characterPersona, authSource } = await req.json();

    const auth = await requireUser(req, userId, authSource);
    if (!auth.ok) return authErrorResponse(auth, corsHeaders);
    userId = auth.userId;
    authSource = auth.source;

    if (!characterId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing characterId or userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cloudSupabase = createClient(supabaseUrl, supabaseKey);

    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const externalServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
    const externalSupabase = externalUrl && externalServiceKey
      ? createClient(externalUrl, externalServiceKey)
      : null;

    let dataSupabase = authSource === 'external' && externalSupabase
      ? externalSupabase
      : cloudSupabase;
    let dataSource: 'cloud' | 'external' = dataSupabase === externalSupabase ? 'external' : 'cloud';

    // Get user's API config
    const apiConfig = await checkDefaultApiSetting(dataSupabase, userId);

    // Get recent messages
    let { data: rawMessages, error: messagesError } = await dataSupabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // 云库消息不足时，自动回退到外部库（兼容旧调用方未传 authSource）
    if ((messagesError || !rawMessages || rawMessages.length < 3) && dataSource === 'cloud' && externalSupabase) {
      const externalResult = await externalSupabase
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('character_id', characterId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!externalResult.error && (externalResult.data?.length || 0) > (rawMessages?.length || 0)) {
        rawMessages = externalResult.data;
        messagesError = null;
        dataSupabase = externalSupabase;
        dataSource = 'external';
        console.log(`Falling back to external data source for user ${userId}`);
      }
    }

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    const messageCount = rawMessages?.length || 0;
    if (messageCount < 3) {
      console.log(`Not enough messages for summary: ${messageCount} messages found for character ${characterId} (source=${dataSource})`);
      return new Response(
        JSON.stringify({ success: true, message: `消息不足（当前${messageCount}条，至少需要3条）` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messages = [...(rawMessages ?? [])].reverse();

    // Get existing memory (兼容外部旧表无 manually_edited)
    let existingSummary = '';
    let isManuallyEdited = false;

    const { data: existingMemoryData, error: existingMemoryError } = await dataSupabase
      .from('character_memories')
      .select('summary, manually_edited')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingMemoryError) {
      if (existingMemoryError.code === 'PGRST204' && String(existingMemoryError.message || '').includes('manually_edited')) {
        const { data: legacyMemory, error: legacyError } = await dataSupabase
          .from('character_memories')
          .select('summary')
          .eq('character_id', characterId)
          .eq('user_id', userId)
          .maybeSingle();

        if (legacyError) {
          console.error('Error fetching legacy memory:', legacyError);
          throw legacyError;
        }

        existingSummary = legacyMemory?.summary || '';
      } else {
        console.error('Error fetching existing memory:', existingMemoryError);
        throw existingMemoryError;
      }
    } else {
      existingSummary = existingMemoryData?.summary || '';
      isManuallyEdited = existingMemoryData?.manually_edited === true;
    }

    // Format messages for summary
    const conversationText = messages
      .map((m: any) => `${m.role === 'user' ? '用户' : characterName || '角色'}: ${m.content}`)
      .join('\n');

    // Build prompt - if manually edited, treat existing summary as pinned core memory
    let systemPrompt: string;
    if (isManuallyEdited && existingSummary) {
      systemPrompt = `你是一个对话记忆助手。你的任务是总结对话内容，提取关键信息。

【重要】以下是用户手动设定的核心记忆，这些内容必须完整保留，不得删除或修改：
---
${existingSummary}
---

在保留以上核心记忆的基础上，从最新对话中补充以下信息：
1. 用户提到的重要个人信息（名字、喜好、习惯、生日、工作等）
2. 对话中建立的关系和情感连接
3. 重要的话题和讨论内容
4. 任何承诺或约定
5. 最近的情绪状态和重要事件
6. 用户的偏好和习惯

请用简洁的中文总结，保持在800字以内。格式：先输出核心记忆（原文保留），再输出补充记忆。`;
    } else {
      systemPrompt = `你是一个对话记忆助手。你的任务是总结对话内容，提取关键信息，包括：
1. 用户提到的重要个人信息（名字、喜好、习惯、生日、工作等）
2. 对话中建立的关系和情感连接（称呼、亲密度变化）
3. 重要的话题和讨论内容（最近聊了什么、讨论了什么问题）
4. 任何承诺或约定（约好要做的事、答应的事情）
5. 最近的情绪状态和重要事件
6. 用户的偏好和习惯（喜欢什么、不喜欢什么）

${existingSummary ? `之前的记忆摘要：\n${existingSummary}\n\n请在此基础上更新和补充记忆，保留重要的旧信息，加入新的关键内容。如有矛盾以最新对话为准。` : ''}

请用简洁的中文总结，保持在800字以内。重点关注最近的对话内容。`;
    }

    const userPrompt = `以下是${characterName || '角色'}与用户的最近对话，请总结关键记忆：

${conversationText}`;

    const summary = await getAICompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], apiConfig);

    const hasMissingOnConflictConstraint = (error: any) =>
      error?.code === '42P10' ||
      String(error?.message || '').includes('no unique or exclusion constraint matching the ON CONFLICT specification');

    const writeMemory = async (payload: Record<string, unknown>) => {
      let { error } = await dataSupabase
        .from('character_memories')
        .upsert(payload as any, {
          onConflict: 'character_id,user_id'
        });

      if (!error) return null;
      if (!hasMissingOnConflictConstraint(error)) return error;

      const { data: updatedRows, error: updateError } = await dataSupabase
        .from('character_memories')
        .update(payload as any)
        .eq('character_id', characterId)
        .eq('user_id', userId)
        .select('id')
        .limit(1);

      if (updateError) return updateError;
      if ((updatedRows?.length || 0) > 0) return null;

      const { error: insertError } = await dataSupabase
        .from('character_memories')
        .insert(payload as any);

      return insertError || null;
    };

    // 获取数据库中的实际消息总数
    const { count: totalDbCount } = await dataSupabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('character_id', characterId)
      .eq('user_id', userId);
    const actualMessageCount = totalDbCount || messages.length;

    const basePayload: Record<string, unknown> = {
      character_id: characterId,
      user_id: userId,
      summary,
      message_count: actualMessageCount,
      updated_at: new Date().toISOString(),
    };

    const memoryPayload: Record<string, unknown> = {
      ...basePayload,
      manually_edited: isManuallyEdited,
    };

    let upsertError = await writeMemory(memoryPayload);

    if (upsertError?.code === 'PGRST204' && String(upsertError.message || '').includes('manually_edited')) {
      upsertError = await writeMemory(basePayload);
    }

    if (upsertError) {
      console.error('Error upserting memory:', upsertError);
      throw upsertError;
    }

    console.log(`Memory summary updated for character ${characterId}, source: ${dataSource}, manually_edited: ${isManuallyEdited}`);

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in generate-memory-summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
