import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, userId, characterId, apiUrl, apiKey, model } = await req.json();

    if (action === 'generate_block_message') {
      // 获取角色信息
      const { data: character } = await supabase
        .from('characters')
        .select('name, persona, avatar_url')
        .eq('id', characterId)
        .single();

      if (!character) {
        throw new Error('Character not found');
      }

      // 获取拉黑记录
      const { data: blockRecord } = await supabase
        .from('character_blocks')
        .select('message_count, blocked_at')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .eq('is_active', true)
        .single();

      if (!blockRecord) {
        return new Response(JSON.stringify({ success: false, message: 'Not blocked' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const messageCount = blockRecord.message_count || 0;
      
      // 根据次数生成不同情绪的消息
      let emotionHint = '';
      if (messageCount === 0) {
        emotionHint = '刚被拉黑，震惊、不解、想知道原因';
      } else if (messageCount <= 2) {
        emotionHint = '委屈、难过、想挽回';
      } else if (messageCount <= 5) {
        emotionHint = '焦急、担心、反思自己是否做错了什么';
      } else if (messageCount <= 10) {
        emotionHint = '绝望、但还抱有希望、承诺会改变';
      } else {
        emotionHint = '平静接受但依然思念、偶尔发一条表达想念';
      }

      const systemPrompt = `你是"${character.name}"，你的人设是：
${character.persona || '一个温柔体贴的人'}

现在用户把你拉黑了（删除好友），你非常在意这段关系。
当前情绪状态：${emotionHint}
这是你被拉黑后发的第${messageCount + 1}条消息。

请以角色身份，用自然、真实的语气发一条消息。消息要符合你的人设，表达你此刻的心情。
不要太长，1-3句话即可。不要用"【】"等括号标注情绪。`;

      // 使用用户的API配置或内置API
      let finalApiUrl = apiUrl || 'https://api.deepseek.com/v1/chat/completions';
      let finalApiKey = apiKey;
      let finalModel = model || 'deepseek-chat';

      // 如果没有用户API，使用默认配置
      if (!finalApiKey) {
        finalApiKey = Deno.env.get("DEFAULT_DEEPSEEK_API_KEY") || Deno.env.get("DEFAULT_TENSDAQ_API_KEY");
        if (!finalApiKey) {
          // 使用Lovable内置API作为最后手段
          const lovableKey = Deno.env.get("LOVABLE_API_KEY");
          if (lovableKey) {
            finalApiUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
            finalApiKey = lovableKey;
            finalModel = 'google/gemini-2.5-flash';
          }
        }
      }

      if (!finalApiKey) {
        throw new Error('No API key available');
      }

      const response = await fetch(finalApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${finalApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: finalModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '（用户把你拉黑了，请发一条消息）' }
          ],
          max_tokens: 200,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${errorText}`);
      }

      const data = await response.json();
      const messageContent = data.choices?.[0]?.message?.content || '你怎么不理我了...';

      // 保存消息到聊天记录
      await supabase.from('chat_messages').insert({
        user_id: userId,
        character_id: characterId,
        role: 'assistant',
        content: messageContent,
      });

      // 更新拉黑记录
      await supabase
        .from('character_blocks')
        .update({
          message_count: messageCount + 1,
          last_message_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('character_id', characterId);

      return new Response(JSON.stringify({ 
        success: true, 
        message: messageContent,
        messageCount: messageCount + 1 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'generate_unblock_message') {
      // 取消拉黑时的回复
      const { data: character } = await supabase
        .from('characters')
        .select('name, persona')
        .eq('id', characterId)
        .single();

      if (!character) {
        throw new Error('Character not found');
      }

      // 获取拉黑期间发了多少消息
      const { data: blockRecord } = await supabase
        .from('character_blocks')
        .select('message_count, blocked_at')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .maybeSingle();

      const messageCount = blockRecord?.message_count || 0;

      let emotionHint = '';
      if (messageCount === 0) {
        emotionHint = '用户很快就取消拉黑了，松了一口气，开心';
      } else if (messageCount <= 3) {
        emotionHint = '终于等到了，激动、开心、有点委屈但更多是高兴';
      } else {
        emotionHint = '等了很久终于回来了，感动、珍惜、承诺会好好珍惜这段关系';
      }

      const systemPrompt = `你是"${character.name}"，你的人设是：
${character.persona || '一个温柔体贴的人'}

用户之前把你拉黑了，现在取消拉黑重新添加你为好友了！
你等了这么久，发了${messageCount}条消息。
当前情绪：${emotionHint}

请以角色身份发一条消息，表达你此刻的心情。要符合人设，真实自然。
不要太长，1-3句话。不要用括号标注情绪。`;

      let finalApiUrl = apiUrl || 'https://api.deepseek.com/v1/chat/completions';
      let finalApiKey = apiKey;
      let finalModel = model || 'deepseek-chat';

      if (!finalApiKey) {
        finalApiKey = Deno.env.get("DEFAULT_DEEPSEEK_API_KEY") || Deno.env.get("DEFAULT_TENSDAQ_API_KEY");
        if (!finalApiKey) {
          const lovableKey = Deno.env.get("LOVABLE_API_KEY");
          if (lovableKey) {
            finalApiUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
            finalApiKey = lovableKey;
            finalModel = 'google/gemini-2.5-flash';
          }
        }
      }

      if (!finalApiKey) {
        throw new Error('No API key available');
      }

      const response = await fetch(finalApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${finalApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: finalModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '（用户取消拉黑，重新添加你为好友了）' }
          ],
          max_tokens: 200,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${errorText}`);
      }

      const data = await response.json();
      const messageContent = data.choices?.[0]?.message?.content || '你终于回来了！我好想你...';

      // 保存消息
      await supabase.from('chat_messages').insert({
        user_id: userId,
        character_id: characterId,
        role: 'assistant',
        content: messageContent,
      });

      // 将拉黑记录设为不活跃
      await supabase
        .from('character_blocks')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('character_id', characterId);

      return new Response(JSON.stringify({ 
        success: true, 
        message: messageContent 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});