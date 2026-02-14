import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { characterId, userId, characterName, characterPersona } = await req.json();

    if (!characterId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing characterId or userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's API config
    const apiConfig = await checkDefaultApiSetting(supabase, userId);

    // Get recent messages
    const { data: rawMessages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    if (!rawMessages || rawMessages.length < 5) {
      return new Response(
        JSON.stringify({ success: true, message: 'Not enough messages for summary' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messages = rawMessages.reverse();

    // Get existing memory
    const { data: existingMemory } = await supabase
      .from('character_memories')
      .select('summary, manually_edited')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .maybeSingle();

    const isManuallyEdited = existingMemory?.manually_edited === true;
    const existingSummary = existingMemory?.summary || '';

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

    // Upsert memory - keep manually_edited flag
    const { error: upsertError } = await supabase
      .from('character_memories')
      .upsert({
        character_id: characterId,
        user_id: userId,
        summary: summary,
        message_count: messages.length,
        manually_edited: isManuallyEdited,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'character_id,user_id'
      });

    if (upsertError) {
      console.error('Error upserting memory:', upsertError);
      throw upsertError;
    }

    console.log(`Memory summary updated for character ${characterId}, manually_edited: ${isManuallyEdited}`);

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
