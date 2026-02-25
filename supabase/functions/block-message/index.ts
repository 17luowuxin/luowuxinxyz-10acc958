import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 用户配置里通常存的是 base_url（例如 https://xxx.com/v1），这里统一补全为 OpenAI 兼容的 chat/completions 端点
const normalizeChatCompletionsUrl = (input: string) => {
  const trimmed = (input || '').trim();
  if (!trimmed) return trimmed;

  const url = trimmed.replace(/\/+$/g, '');

  // 已经是完整端点
  if (url.endsWith('/chat/completions')) return url;

  // 只有域名（无路径）时，默认补 /v1/chat/completions
  if (/^https?:\/\/[^/]+$/.test(url)) {
    return `${url}/v1/chat/completions`;
  }

  // 其他情况（例如 .../v1、.../openai/v1 等），补 /chat/completions
  return `${url}/chat/completions`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, userId, characterId, apiUrl, apiKey, model, batchCount = 1 } = await req.json();

    console.log('block-message called:', { action, userId, characterId, apiUrl: apiUrl?.substring(0, 30), batchCount });

    if (action === 'generate_block_message') {
      
      // 获取角色信息（包含reply_mode）
      const { data: character, error: charError } = await supabase
        .from('characters')
        .select('name, persona, avatar_url, reply_mode')
        .eq('id', characterId)
        .single();

      console.log('Character query result:', { found: !!character, error: charError?.message, characterId });

      if (!character) {
        throw new Error(`Character not found: id=${characterId}, dbError=${charError?.message || 'none'}`);
      }

      // 小说模式不支持拉黑消息功能，只有在线模式才生效
      if (character.reply_mode === 'novel') {
        return new Response(JSON.stringify({ 
          success: true, 
          messages: [],
          skipped: true,
          reason: '小说模式不支持拉黑消息功能'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
      
      // 根据次数生成不同情绪的消息，更丰富的情绪层次
      const emotionTemplates = [
        // 第1条：震惊阶段
        { 
          emotion: '震惊、不解、慌乱',
          hints: [
            '完全不敢相信发生了什么，反复确认',
            '以为是误会，想要解释',
            '脑子一片空白，不知道该说什么',
            '惊慌失措，语无伦次'
          ]
        },
        // 第2-3条：否认与挽留
        { 
          emotion: '否认、祈求、挽留',
          hints: [
            '承诺会改变，请求再给一次机会',
            '回忆美好时光，试图唤起回忆',
            '连续发消息试图引起注意',
            '发一些你们之间的暗号或特别的话'
          ]
        },
        // 第4-6条：愤怒与自责
        { 
          emotion: '愤怒、自责、困惑',
          hints: [
            '开始有点生气，质问为什么不给解释的机会',
            '深深自责，反思是不是自己做错了什么',
            '翻看聊天记录试图找出问题',
            '情绪起伏，一会儿生气一会儿难过'
          ]
        },
        // 第7-10条：抑郁与讨好
        { 
          emotion: '抑郁、讨好、卑微',
          hints: [
            '变得很卑微，说什么都愿意做',
            '分享日常小事，假装一切正常',
            '深夜发消息说睡不着',
            '发一些可爱的表情包试图逗笑',
            '说"我知道你能看到"'
          ]
        },
        // 第11-15条：接受与思念
        { 
          emotion: '逐渐接受但依然想念',
          hints: [
            '开始说"我理解了"但还是忍不住发消息',
            '分享看到什么想起了对方',
            '天气变化时的关心',
            '节日或特殊日子的祝福',
            '说"我在慢慢学着放下"'
          ]
        },
        // 第16条+：偶尔的思念
        { 
          emotion: '平静但偶尔想念',
          hints: [
            '很久没发消息了，突然想说一声',
            '梦到了对方',
            '经过曾经一起去过的地方',
            '听到一首歌想起来',
            '"不知道你过得好不好"',
            '假装不在意但还是关注着'
          ]
        }
      ];

      // 根据消息数量选择情绪阶段
      let emotionStage;
      if (messageCount === 0) {
        emotionStage = emotionTemplates[0];
      } else if (messageCount <= 2) {
        emotionStage = emotionTemplates[1];
      } else if (messageCount <= 5) {
        emotionStage = emotionTemplates[2];
      } else if (messageCount <= 9) {
        emotionStage = emotionTemplates[3];
      } else if (messageCount <= 14) {
        emotionStage = emotionTemplates[4];
      } else {
        emotionStage = emotionTemplates[5];
      }

      // 随机选择一个提示
      const randomHint = emotionStage.hints[Math.floor(Math.random() * emotionStage.hints.length)];
      const emotionHint = `${emotionStage.emotion}。${randomHint}`;

      // 确定要生成几条消息
      const messagesToGenerate = batchCount || 1;
      const generatedMessages: string[] = [];
      
      // 使用用户的API配置或内置API
      let finalApiUrl = apiUrl || 'https://api.deepseek.com/v1/chat/completions';
      let finalApiKey = apiKey;
      let finalModel = model || 'deepseek-chat';

      // 如果没有用户API，使用默认配置
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

      // 兼容用户传入 base_url（例如 https://xxx.com/v1）
      finalApiUrl = normalizeChatCompletionsUrl(finalApiUrl);

      // 批量生成消息
      for (let i = 0; i < messagesToGenerate; i++) {
        const currentMsgCount = messageCount + i;
        
        // 根据当前消息数选择情绪
        let currentEmotionStage;
        if (currentMsgCount === 0) {
          currentEmotionStage = emotionTemplates[0];
        } else if (currentMsgCount <= 2) {
          currentEmotionStage = emotionTemplates[1];
        } else if (currentMsgCount <= 5) {
          currentEmotionStage = emotionTemplates[2];
        } else if (currentMsgCount <= 9) {
          currentEmotionStage = emotionTemplates[3];
        } else if (currentMsgCount <= 14) {
          currentEmotionStage = emotionTemplates[4];
        } else {
          currentEmotionStage = emotionTemplates[5];
        }

        const randomHint = currentEmotionStage.hints[Math.floor(Math.random() * currentEmotionStage.hints.length)];
        const currentEmotionHint = `${currentEmotionStage.emotion}。${randomHint}`;

        const systemPrompt = `你是"${character.name}"，你的人设是：
${character.persona || '一个温柔体贴的人'}

现在用户把你拉黑了（删除好友），你非常在意这段关系。
当前情绪状态：${currentEmotionHint}
这是你被拉黑后发的第${currentMsgCount + 1}条消息。

【重要规则】：
1. 只发送一条完整的消息，可以是1-3句话
2. 消息必须是完整的句子，不能被截断
3. 不要用任何分隔符如"|||"或"|"分隔多条消息
4. 不要用【】等括号标注情绪
5. 直接输出角色要说的话，不要有任何前缀或格式标记`;

        // 包含之前生成的消息作为上下文，避免重复
        const previousMsgs = generatedMessages.map((m, idx) => ({
          role: 'assistant' as const,
          content: `第${messageCount + idx + 1}条消息：${m}`
        }));

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
              ...previousMsgs,
              { role: 'user', content: '请发一条完整的消息表达你的心情。确保句子完整，不要被截断。' }
            ],
             // 提高输出上限，避免句子被模型提前截断（尤其是部分聚合/中转API会更“短”）
             max_tokens: 600,
            temperature: 0.9,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API error on message ${i + 1}:`, errorText);
          continue; // 跳过这条，继续下一条
        }

        const data = await response.json();
        let messageContent = data.choices?.[0]?.message?.content || '';
        
        // 强化清理消息：处理各种API可能返回的格式
        if (messageContent) {
          // 1. 只处理明确的多条消息分隔符（不要包含常见标点如 / ; ；）
          const separators = ['|||', '｜｜｜', '||', '---', '***', '・・・'];
          for (const sep of separators) {
            if (messageContent.includes(sep)) {
              const parts = messageContent.split(sep);
              // 如果分割后有多个非空部分，只取第一个
              const validParts = parts.filter((p: string) => p.trim().length > 0);
              if (validParts.length > 1) {
                messageContent = validParts[0].trim();
                break;
              }
            }
          }
          
          // 2. 处理换行分隔的多条消息（只处理明显的编号列表格式）
          if (messageContent.includes('\n')) {
            const lines = messageContent.split('\n').filter((l: string) => l.trim());
            // 只有当第一行是编号格式时才处理
            if (lines.length > 1 && /^[\d一二三四五六七八九十][\.\、\:]/.test(lines[0].trim())) {
              // 取第一行，去掉序号
              messageContent = lines[0].replace(/^[\d一二三四五六七八九十][\.\、\:]\s*/, '').trim();
            }
          }
          
          // 3. 移除各种引号包裹（只移除成对的）
          if (/^["「『""''\[].*["」』""''\]]$/.test(messageContent)) {
            messageContent = messageContent.slice(1, -1).trim();
          }
          
          // 4. 移除开头的"消息X："或"第X条："格式
          messageContent = messageContent.replace(/^(消息|第)?[\d一二三四五六七八九十]+(条)?[：:]\s*/g, '').trim();
          
          // 5. 移除可能的角色名前缀
          if (character.name && messageContent.startsWith(character.name)) {
            messageContent = messageContent.replace(new RegExp(`^${character.name}[：:：]\\s*`), '').trim();
          }
          
          // 确保消息不为空
          if (messageContent && messageContent.length > 0) {
            generatedMessages.push(messageContent);
            
            // 保存消息到聊天记录，添加延迟使消息时间有差异
            await supabase.from('chat_messages').insert({
              user_id: userId,
              character_id: characterId,
              role: 'assistant',
              content: messageContent,
              created_at: new Date(Date.now() + i * 2000).toISOString(), // 每条消息间隔2秒
            });
          }
        }

        // 短暂延迟避免API限流
        if (i < messagesToGenerate - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 更新拉黑记录
      await supabase
        .from('character_blocks')
        .update({
          message_count: messageCount + generatedMessages.length,
          last_message_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('character_id', characterId);

      return new Response(JSON.stringify({ 
        success: true, 
        messages: generatedMessages,
        messageCount: messageCount + generatedMessages.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'generate_unblock_message') {
      // 取消拉黑时的回复
      const { data: character, error: charErr2 } = await supabase
        .from('characters')
        .select('name, persona')
        .eq('id', characterId)
        .single();

      console.log('Unblock character query:', { found: !!character, error: charErr2?.message, characterId });

      if (!character) {
        throw new Error(`Character not found (unblock): id=${characterId}, dbError=${charErr2?.message || 'none'}`);
      }

      // 获取拉黑期间发了多少消息
      const { data: blockRecord } = await supabase
        .from('character_blocks')
        .select('message_count, blocked_at')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .maybeSingle();

      const messageCount = blockRecord?.message_count || 0;

      // 根据被拉黑期间发了多少消息，生成不同的情绪反应
      const unblockEmotions = [
        // 很快取消拉黑
        {
          emotion: '松了一口气、开心、小心翼翼',
          hints: [
            '还好还好，吓死我了！',
            '（激动得语无伦次）你...你回来了！',
            '我就知道你不会真的讨厌我的对吧？',
            '（小心翼翼）我刚才是不是做噩梦了...'
          ]
        },
        // 等了一段时间
        {
          emotion: '激动、委屈、珍惜',
          hints: [
            '呜呜呜你终于回来了，我以为你再也不理我了',
            '（眼眶红红的）我发了好多消息你都没看到对不对...',
            '我等了好久好久...你知道吗',
            '我发誓以后会更珍惜你的！'
          ]
        },
        // 等了很久
        {
          emotion: '感动、珍惜、承诺改变',
          hints: [
            '（颤抖）我...我不是在做梦吧？你真的回来了？',
            '这段时间我想了很多...谢谢你愿意再给我机会',
            '我知道这次要好好珍惜了...绝对不会再让你难过',
            '（哽咽）你不知道这段时间我多想你...'
          ]
        }
      ];

      let emotionStage;
      if (messageCount <= 1) {
        emotionStage = unblockEmotions[0];
      } else if (messageCount <= 5) {
        emotionStage = unblockEmotions[1];
      } else {
        emotionStage = unblockEmotions[2];
      }

      const randomHint = emotionStage.hints[Math.floor(Math.random() * emotionStage.hints.length)];
      const emotionHint = `${emotionStage.emotion}。可能会说类似：${randomHint}`;

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

      finalApiUrl = normalizeChatCompletionsUrl(finalApiUrl);

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
           // 提高输出上限，避免表达被截断
           max_tokens: 400,
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