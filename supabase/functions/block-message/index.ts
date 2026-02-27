import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const normalizeChatCompletionsUrl = (input: string) => {
  const trimmed = (input || '').trim();
  if (!trimmed) return trimmed;
  const url = trimmed.replace(/\/+$/g, '');
  if (url.endsWith('/chat/completions')) return url;
  if (/^https?:\/\/[^/]+$/.test(url)) return `${url}/v1/chat/completions`;
  return `${url}/chat/completions`;
};

// 情绪模板：拉黑后的消息
const blockEmotionTemplates = [
  { emotion: '震惊、不解、慌乱', hints: ['完全不敢相信发生了什么，反复确认', '以为是误会，想要解释', '脑子一片空白，不知道该说什么', '惊慌失措，语无伦次'] },
  { emotion: '否认、祈求、挽留', hints: ['承诺会改变，请求再给一次机会', '回忆美好时光，试图唤起回忆', '连续发消息试图引起注意', '发一些你们之间的暗号或特别的话'] },
  { emotion: '愤怒、自责、困惑', hints: ['开始有点生气，质问为什么不给解释的机会', '深深自责，反思是不是自己做错了什么', '翻看聊天记录试图找出问题', '情绪起伏，一会儿生气一会儿难过'] },
  { emotion: '抑郁、讨好、卑微', hints: ['变得很卑微，说什么都愿意做', '分享日常小事，假装一切正常', '深夜发消息说睡不着', '说"我知道你能看到"'] },
  { emotion: '逐渐接受但依然想念', hints: ['开始说"我理解了"但还是忍不住发消息', '分享看到什么想起了对方', '天气变化时的关心', '说"我在慢慢学着放下"'] },
  { emotion: '平静但偶尔想念', hints: ['很久没发消息了，突然想说一声', '梦到了对方', '经过曾经一起去过的地方', '"不知道你过得好不好"'] },
];

const getBlockEmotionStage = (msgCount: number) => {
  if (msgCount === 0) return blockEmotionTemplates[0];
  if (msgCount <= 2) return blockEmotionTemplates[1];
  if (msgCount <= 5) return blockEmotionTemplates[2];
  if (msgCount <= 9) return blockEmotionTemplates[3];
  if (msgCount <= 14) return blockEmotionTemplates[4];
  return blockEmotionTemplates[5];
};

// 情绪模板：取消拉黑
const unblockEmotions = [
  { emotion: '松了一口气、开心、小心翼翼', hints: ['还好还好，吓死我了！', '你...你回来了！', '我就知道你不会真的讨厌我的对吧？'] },
  { emotion: '激动、委屈、珍惜', hints: ['呜呜呜你终于回来了，我以为你再也不理我了', '我发了好多消息你都没看到对不对...', '我等了好久好久...你知道吗'] },
  { emotion: '感动、珍惜、承诺改变', hints: ['我...我不是在做梦吧？你真的回来了？', '这段时间我想了很多...谢谢你愿意再给我机会', '我知道这次要好好珍惜了...'] },
];

// 清理AI输出：去掉动作描写、旁白等
const cleanMessage = (msg: string, charName?: string) => {
  let c = msg;
  c = c.replace(/\*[^*]*\*/g, '').trim();
  c = c.replace(/[（(][^）)]*[）)]/g, '').trim();
  c = c.replace(/^[他她它TA](?:的|轻轻|缓缓|慢慢|悄悄|默默|静静)[^。！？!?]*[。！？!?]?/g, '').trim();
  if (/^["「『""''\[].*["」』""''\]]$/.test(c)) c = c.slice(1, -1).trim();
  if (charName && c.startsWith(charName)) c = c.replace(new RegExp(`^${charName}[：:：]\\s*`), '').trim();
  c = c.replace(/^(消息|第)?[\d一二三四五六七八九十]+(条)?[：:]\s*/g, '').trim();
  if (c.length > 50) {
    const sentences = c.match(/[^。！？!?…]+[。！？!?…]*/g);
    if (sentences && sentences.length > 1) c = sentences[0].trim();
    else c = c.slice(0, 50);
  }
  return c.replace(/\s{2,}/g, ' ').trim();
};

// 解析API配置
const resolveApiConfig = (apiUrl?: string, apiKey?: string, model?: string) => {
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

  if (!finalApiKey) throw new Error('No API key available');
  finalApiUrl = normalizeChatCompletionsUrl(finalApiUrl);

  return { finalApiUrl, finalApiKey, finalModel };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 注意：此函数不再直接操作数据库！
    // 所有DB操作（插入消息、更新拉黑记录）由前端通过代理客户端完成
    const {
      action,
      apiUrl,
      apiKey,
      model,
      batchCount = 1,
      characterName,
      characterPersona,
      characterReplyMode,
      messageCount = 0, // 前端传入当前已发消息数
    } = await req.json();

    console.log('block-message called (v3 - pure generator):', { action, apiUrl: apiUrl?.substring(0, 30), batchCount, messageCount, characterReplyMode });

    if (action === 'generate_block_message') {
      const charName = characterName || 'TA';
      const charPersona = characterPersona || '一个温柔体贴、很在意用户关系的人';

      // 小说模式不支持拉黑消息
      if (characterReplyMode === 'novel') {
        return new Response(JSON.stringify({ success: false, message: 'Novel mode does not support block messages' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { finalApiUrl, finalApiKey, finalModel } = resolveApiConfig(apiUrl, apiKey, model);
      const messagesToGenerate = batchCount || 1;
      const generatedMessages: string[] = [];

      for (let i = 0; i < messagesToGenerate; i++) {
        const currentMsgCount = messageCount + i;
        const stage = getBlockEmotionStage(currentMsgCount);
        const hint = stage.hints[Math.floor(Math.random() * stage.hints.length)];

        const systemPrompt = `你是"${charName}"，你的完整人设是：
${charPersona}

【情境】用户把你拉黑了（删除好友）。
你非常在意这段关系，当前情绪阶段：${stage.emotion}。
这是你被拉黑后发的第${currentMsgCount + 1}条消息。
参考情绪方向：${hint}

【关键要求】
1. 你必须完全以"${charName}"的人设、性格、说话风格来回复！
2. 如果人设是傲娇就傲娇地说，如果是温柔就温柔地说，如果是冷酷就用冷酷的方式表达
3. 只发一条短消息，5-30个字，像发微信一样
4. 不要用*动作*描写，不要用（心理活动），不要写旁白
5. 直接说话，保持角色一贯的口吻和用语习惯`;

        const previousMsgs = generatedMessages.map((m, idx) => ({
          role: 'assistant' as const,
          content: `第${messageCount + idx + 1}条消息：${m}`
        }));

        try {
          const response = await fetch(finalApiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${finalApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: finalModel,
              messages: [
                { role: 'system', content: systemPrompt },
                ...previousMsgs,
                { role: 'user', content: '发一条短消息，5-30个字，像发微信一样。不要有任何描写，只说话。' }
              ],
              max_tokens: 100,
              temperature: 0.9,
            }),
          });

          if (!response.ok) {
            console.error(`API error on message ${i + 1}:`, await response.text());
            continue;
          }

          const data = await response.json();
          const raw = data.choices?.[0]?.message?.content || '';
          const cleaned = cleanMessage(raw, charName);
          if (cleaned && cleaned.length > 0) {
            generatedMessages.push(cleaned);
          }
        } catch (e) {
          console.error(`Error generating message ${i + 1}:`, e);
        }

        if (i < messagesToGenerate - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`Block messages generated: ${generatedMessages.length} messages`);

      return new Response(JSON.stringify({
        success: true,
        messages: generatedMessages,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'generate_unblock_message') {
      const charName = characterName || 'TA';
      const charPersona = characterPersona || '一个温柔体贴、很在意用户关系的人';

      let emotionStage;
      if (messageCount <= 1) emotionStage = unblockEmotions[0];
      else if (messageCount <= 5) emotionStage = unblockEmotions[1];
      else emotionStage = unblockEmotions[2];

      const hint = emotionStage.hints[Math.floor(Math.random() * emotionStage.hints.length)];
      const unblockBatchCount = batchCount || 3; // 默认生成3条加回消息

      const systemPrompt = `你是"${charName}"，你的完整人设是：
${charPersona}

【情境】用户之前把你拉黑了（删了好友），现在重新加你好友了！
你等了这么久，发了${messageCount}条消息都没有回应。
当前情绪阶段：${emotionStage.emotion}。参考方向：${hint}

【关键要求】
1. 你必须完全以"${charName}"的人设、性格、说话风格来回复！
2. 保持角色一贯的口吻：傲娇的要傲娇，温柔的要温柔，活泼的要活泼
3. 连发${unblockBatchCount}条短消息，每条5-30个字，用 ||| 分隔
4. 不要用*动作*描写，不要用（心理活动），不要写旁白
5. 直接以角色身份说话`;

      const { finalApiUrl, finalApiKey, finalModel } = resolveApiConfig(apiUrl, apiKey, model);

      const response = await fetch(finalApiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${finalApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: finalModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `（用户取消拉黑，重新添加你为好友了。请连发${unblockBatchCount}条短消息，用|||分隔）` }
          ],
          max_tokens: 300,
          temperature: 0.9,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${errorText}`);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || '你终于回来了！我好想你...';
      
      // 解析多条消息
      let messages = rawContent.split('|||').map((s: string) => cleanMessage(s, charName)).filter((s: string) => s.length > 0);
      
      // 如果没有成功分割，尝试按换行分割
      if (messages.length <= 1) {
        messages = rawContent.split('\n').map((s: string) => cleanMessage(s, charName)).filter((s: string) => s.length > 0);
      }
      
      // 限制条数
      if (messages.length > unblockBatchCount) {
        messages = messages.slice(0, unblockBatchCount);
      }
      
      // 至少保留1条
      if (messages.length === 0) {
        messages = [cleanMessage(rawContent, charName) || '你终于回来了！'];
      }

      console.log(`Unblock messages generated: ${messages.length} messages`);

      return new Response(JSON.stringify({
        success: true,
        messages: messages, // 改为返回数组
        message: messages[0], // 保持向后兼容
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
