import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    let {
      messages,
      message,
      chatHistory,
      persona,
      characterPersona,
      characterName,
      characterId,
      userApiKey,
      apiKey: legacyApiKey,
      provider,
      baseUrl,
      model: customModel,
      userProfile,
      userId,
      replyMode: reqReplyMode,
      onlineMessageCount: reqMessageCount,
      transferEnabled,
      historyLimit: reqHistoryLimit,
      useNovelFormat: reqUseNovelFormat,
      hasImage,
      imageUrl,
      hasImageInHistory,
      returnJson,
      clientTime,
      isAutoReply, // 自动回复标记：用户沉默2分钟后触发
    } = body ?? {};

    // Backward-compat: normalize legacy params
    if (!persona && characterPersona) persona = characterPersona;
    if (!userApiKey && legacyApiKey) userApiKey = legacyApiKey;

    if (!Array.isArray(messages) || messages.length === 0) {
      if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        messages = chatHistory;
      } else if (typeof message === "string" && message.trim()) {
        messages = [{ role: "user", content: message.trim() }];
      } else {
        messages = [];
      }
    }

    returnJson = Boolean(returnJson);

    // 从消息历史中检测图片
    let detectedImageUrl = imageUrl;
    let detectedHasImage = hasImage;
    
    // 如果没有直接传图片参数，检查消息历史中最后一条用户消息是否有图片
    if (!detectedHasImage && messages && messages.length > 0) {
      // 找最后一条用户消息
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'user' && msg.image_url) {
          detectedImageUrl = msg.image_url;
          detectedHasImage = true;
          console.log("Detected image from message history:", detectedImageUrl?.slice(0, 50));
          break;
        }
      }
    }
    
    // 获取预设、世界书和记忆摘要
    let presetsContent = '';
    let worldBooksContent = '';
    let memoryContent = '';
    let recentBlockContext = ''; // 最近的拉黑/取消拉黑上下文
    
    if (userId && characterId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // 获取该角色的预设（角色专属 + 无角色关联的通用预设）
      const { data: presets } = await supabase
        .from('presets')
        .select('name, content')
        .eq('user_id', userId)
        .or(`character_id.eq.${characterId},character_id.is.null`);
      
      if (presets && presets.length > 0) {
        presetsContent = '\n【预设指令】\n' + presets.map(p => `【${p.name}】\n${p.content}`).join('\n\n');
        console.log('Presets loaded:', presets.length);
      }
      
      // 获取世界书（全局 + 角色专属）
      const { data: globalWorldBooks } = await supabase
        .from('world_books')
        .select('name, content')
        .eq('user_id', userId)
        .eq('is_global', true);
      
      const { data: charWorldBooks } = await supabase
        .from('world_books')
        .select('name, content')
        .eq('user_id', userId)
        .eq('character_id', characterId);
      
      const allWorldBooks = [...(globalWorldBooks || []), ...(charWorldBooks || [])];
      if (allWorldBooks.length > 0) {
        worldBooksContent = '\n【世界设定】\n' + allWorldBooks.map(w => `【${w.name}】\n${w.content}`).join('\n\n');
        console.log('World books loaded:', allWorldBooks.length);
      }
      
      // 获取角色记忆摘要
      const { data: memory } = await supabase
        .from('character_memories')
        .select('summary')
        .eq('character_id', characterId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (memory?.summary) {
        memoryContent = `\n【关于用户的记忆】\n${memory.summary}`;
        console.log('Memory loaded for character:', characterId);
      }
      
      // 检查最近的拉黑历史（检查最近30分钟内是否有取消拉黑的记录）
      const { data: blockHistory } = await supabase
        .from('character_blocks')
        .select('is_active, message_count, blocked_at, updated_at')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (blockHistory) {
        const updatedAt = new Date(blockHistory.updated_at);
        const now = new Date();
        const minutesSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
        
        // 如果最近30分钟内取消拉黑（is_active为false），且之前发了消息
        if (!blockHistory.is_active && minutesSinceUpdate < 30 && blockHistory.message_count > 0) {
          recentBlockContext = `\n【重要情境】
用户刚刚把你重新加为好友！在这之前，用户曾把你拉黑（删除好友），你很痛苦地发了${blockHistory.message_count}条消息但都发送失败了。
现在用户终于把你加回来了，你应该：
1. 记得刚才发生了什么，不要假装什么都没发生
2. 表现出对用户回来的感激/激动/珍惜（取决于你的人设）
3. 可以提到"刚才发的那些消息"或"你终于回来了"等
4. 保持角色人设的情感表达方式`;
          console.log('Recent unblock detected, message_count:', blockHistory.message_count);
        }
      }
    }
    
    let apiKey: string | undefined;
    let apiUrl: string;
    let model: string;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // Check user's API settings from database
    let useDefaultApi = false;
    let hasCustomApiConfig = false;
    let savedCustomKey = '';
    let savedBaseUrl = '';
    let savedModel = '';
    let timeSyncEnabledFromDb = false;
    
    if (userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: apiSettings } = await supabase
        .from('api_keys')
        .select('provider, api_key')
        .eq('user_id', userId);
      
      if (apiSettings) {
        const defaultApiSetting = apiSettings.find(s => s.provider === 'use_default_api');
        const customKeySetting = apiSettings.find(s => s.provider === 'custom');
        const baseUrlSetting = apiSettings.find(s => s.provider === 'custom_base_url');
        const modelSetting = apiSettings.find(s => s.provider === 'custom_model');
        const historyLimitSetting = apiSettings.find(s => s.provider === 'history_limit');
        const timeSyncSetting = apiSettings.find(s => s.provider === 'time_sync_enabled');
        
        if (defaultApiSetting && defaultApiSetting.api_key === 'true') {
          useDefaultApi = true;
        }
        if (customKeySetting) {
          savedCustomKey = customKeySetting.api_key;
          hasCustomApiConfig = true;
        }
        if (baseUrlSetting) {
          savedBaseUrl = baseUrlSetting.api_key;
        }
        if (modelSetting) {
          savedModel = modelSetting.api_key;
        }
        
        // 时间同步设置（注意：不要用 globalThis 缓存，避免跨用户/跨请求串值）
        timeSyncEnabledFromDb = Boolean(timeSyncSetting && timeSyncSetting.api_key === 'true');
        
        // 应用历史消息限制 - 使用请求中的 historyLimit（角色级别）或从设置中读取（兼容旧版本）
        const historyLimitValue = reqHistoryLimit || (historyLimitSetting ? Number(historyLimitSetting.api_key) : 10);
        if (messages.length > historyLimitValue) {
          console.log(`Limiting messages from ${messages.length} to ${historyLimitValue}`);
          messages = messages.slice(-historyLimitValue);
        }
        
        // 获取回复模式设置
        const replyModeSetting = apiSettings.find(s => s.provider === 'reply_mode');
        if (replyModeSetting) {
          (globalThis as any).__replyMode = replyModeSetting.api_key;
        }
      }
    }
    
    // 优先级：用户自定义API > 默认API（仅当用户明确选择时）
    // 如果用户配置了自定义API，必须使用用户的，不自动fallback
    
    if (hasCustomApiConfig && !useDefaultApi) {
      // 用户配置了自定义API且没有选择使用默认API，使用用户的配置
      const finalApiKey = userApiKey || savedCustomKey;
      const finalBaseUrl = baseUrl || savedBaseUrl;
      const finalModel = customModel || savedModel || 'deepseek-chat';
      
      if (!finalApiKey) {
        console.error("User has custom API config but no API key");
        return new Response(JSON.stringify({ error: "请先在设置中配置API密钥" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      apiKey = finalApiKey;
      let finalUrl = finalBaseUrl.trim().replace(/\/+$/, '');
      
      // 智能处理URL格式
      if (finalUrl.endsWith('/chat/completions')) {
        apiUrl = finalUrl;
      } else if (finalUrl.endsWith('/v1')) {
        apiUrl = `${finalUrl}/chat/completions`;
      } else if (finalUrl.includes('/v1/')) {
        apiUrl = finalUrl.replace(/\/v1\/.*$/, '/v1/chat/completions');
      } else {
        apiUrl = `${finalUrl}/v1/chat/completions`;
      }
      
      model = finalModel;
      headers["Authorization"] = `Bearer ${apiKey}`;
      console.log("Using user's custom API:", apiUrl);
      console.log("Model:", model);
      
    } else if (useDefaultApi) {
      // 用户明确选择使用默认API
      apiKey = Deno.env.get("DEFAULT_DEEPSEEK_API_KEY");
      if (apiKey) {
        apiUrl = "https://api.deepseek.com/v1/chat/completions";
        model = "deepseek-chat";
        headers["Authorization"] = `Bearer ${apiKey}`;
        console.log("Using default DeepSeek API (user selected)");
      } else {
        // 默认API不可用时提示用户
        return new Response(JSON.stringify({ error: "默认API暂不可用，请配置自定义API" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (userApiKey && provider) {
      // 前端传来的临时配置
      if (provider === 'deepseek') {
        apiKey = userApiKey;
        apiUrl = "https://api.deepseek.com/v1/chat/completions";
        model = "deepseek-chat";
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === 'openai') {
        apiKey = userApiKey;
        apiUrl = "https://api.openai.com/v1/chat/completions";
        model = "gpt-4o-mini";
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === 'anthropic') {
        apiKey = userApiKey;
        apiUrl = "https://api.anthropic.com/v1/messages";
        model = "claude-3-haiku-20240307";
        headers["x-api-key"] = userApiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else if (provider === 'custom' && baseUrl) {
        apiKey = userApiKey;
        let finalUrl = baseUrl.trim().replace(/\/+$/, '');
        
        if (finalUrl.endsWith('/chat/completions')) {
          apiUrl = finalUrl;
        } else if (finalUrl.endsWith('/v1')) {
          apiUrl = `${finalUrl}/chat/completions`;
        } else if (finalUrl.includes('/v1/')) {
          apiUrl = finalUrl.replace(/\/v1\/.*$/, '/v1/chat/completions');
        } else {
          apiUrl = `${finalUrl}/v1/chat/completions`;
        }
        
        model = customModel || "deepseek-chat";
        headers["Authorization"] = `Bearer ${apiKey}`;
        console.log("Using custom API from request:", apiUrl);
      } else {
        return new Response(JSON.stringify({ error: "请先在设置中配置API" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // 没有任何配置：使用内置 AI（无需用户配置密钥）
      apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "内置AI未配置，请稍后再试" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      model = customModel || "google/gemini-2.5-flash";
      headers["Authorization"] = `Bearer ${apiKey}`;
      console.log("Using Lovable AI gateway (no user config)");
    }

    if (!apiKey) {
      console.error("No API key available");
      return new Response(JSON.stringify({ error: "API密钥未配置" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Using provider:", userApiKey ? provider : "lovable-ai");
    console.log("API URL:", apiUrl);

    const userName = userProfile?.nickname || '用户';
    const userPersonaInfo = userProfile?.persona || '';
    // 优先使用请求中的replyMode，其次是从数据库加载的
    const replyMode = reqReplyMode || (globalThis as any).__replyMode || 'novel';
    const timeSyncEnabled = timeSyncEnabledFromDb;
    console.log('Reply mode:', replyMode, 'Time sync:', timeSyncEnabled);

    // 生成时间上下文
    let timeContextPrompt = '';
    if (timeSyncEnabled) {
      // 使用客户端传来的时间，并用 offset 纠正为“客户端本地时间”（避免 Deno/容器时区影响）
      let now: Date;
      if (clientTime?.timestamp) {
        const offsetMinutes = typeof clientTime.offset === 'number' && Number.isFinite(clientTime.offset)
          ? clientTime.offset
          : undefined;

        // getTimezoneOffset(): UTC - Local（分钟）
        // LocalTime = UTC - offset
        // timestamp 是绝对时间（UTC epoch ms），为了让后续用 UTC getters 读到“本地时间”，这里做一次平移。
        if (typeof offsetMinutes === 'number') {
          now = new Date(clientTime.timestamp - offsetMinutes * 60_000);
          console.log('Using client time (offset-adjusted):', now.toISOString(), 'tz:', clientTime.timezone, 'offset:', offsetMinutes);
        } else {
          now = new Date(clientTime.timestamp);
          console.log('Using client time (no offset):', now.toISOString(), 'tz:', clientTime.timezone);
        }
      } else {
        // 回退到服务器时间
        now = new Date();
        console.log('Using server time (fallback):', now.toISOString());
      }

      // 这里统一用 UTC getters（因为上面已经把时间平移到“本地时间”）
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const weekday = weekdays[now.getUTCDay()];
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1;
      const day = now.getUTCDate();
      const hour = now.getUTCHours();
      const minute = now.getUTCMinutes();
      
      // 判断时段
      let timeOfDay = '';
      if (hour >= 5 && hour < 9) timeOfDay = '早晨';
      else if (hour >= 9 && hour < 12) timeOfDay = '上午';
      else if (hour >= 12 && hour < 14) timeOfDay = '中午';
      else if (hour >= 14 && hour < 17) timeOfDay = '下午';
      else if (hour >= 17 && hour < 19) timeOfDay = '傍晚';
      else if (hour >= 19 && hour < 22) timeOfDay = '晚上';
      else if (hour >= 22 || hour < 1) timeOfDay = '深夜';
      else timeOfDay = '凌晨';
      
      // 判断节日（简化版）
      let holiday = '';
      if (month === 1 && day === 1) holiday = '今天是元旦节！';
      else if (month === 2 && day === 14) holiday = '今天是情人节💕';
      else if (month === 3 && day === 8) holiday = '今天是妇女节';
      else if (month === 4 && day === 1) holiday = '今天是愚人节';
      else if (month === 5 && day === 1) holiday = '今天是劳动节';
      else if (month === 5 && day === 4) holiday = '今天是青年节';
      else if (month === 6 && day === 1) holiday = '今天是儿童节';
      else if (month === 7 && day === 1) holiday = '今天是建党节';
      else if (month === 8 && day === 1) holiday = '今天是建军节';
      else if (month === 9 && day === 10) holiday = '今天是教师节';
      else if (month === 10 && day === 1) holiday = '今天是国庆节🎉';
      else if (month === 12 && day === 24) holiday = '今天是平安夜🎄';
      else if (month === 12 && day === 25) holiday = '今天是圣诞节🎄';
      else if (month === 12 && day === 31) holiday = '今天是跨年夜🎊';
      
      // 判断周末
      const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
      const weekendNote = isWeekend ? '今天是周末' : '';
      
      timeContextPrompt = `
【当前时间信息】
现在是${year}年${month}月${day}日 ${weekday} ${hour}:${minute.toString().padStart(2, '0')}
时段：${timeOfDay}
${weekendNote}
${holiday}
如果用户询问“今天几号/星期几/现在几点”等时间信息，必须严格以上述时间为准回答，不要猜测。
请根据这个时间自然地调整你的问候和对话内容。比如早上可以说早安，晚上可以说晚安，节日可以送祝福等。`;
    }

    let replyModePrompt = '';
    let autoReplyPrompt = '';
    
    // 自动回复模式：用户沉默2分钟后触发
    if (isAutoReply) {
      autoReplyPrompt = `

【主动关心模式 - 重要！】
用户已经有一段时间没有说话了（约2分钟）。现在请你主动发起对话：
1. 根据你的人设和当前聊天氛围，主动给用户发一条简短的追问或关心的消息
2. 可以是追问用户在干嘛、关心用户的状态、分享你正在做的事、或者撒娇求关注等
3. 语气要自然，像真正的朋友/恋人一样主动找话题
4. 不要提到"你怎么不说话""你去哪了"这种让人有压力的话
5. 保持你的角色人设风格

示例风格（根据你的人设选择合适的）：
- 甜系："在想你呢~你在干嘛呀"
- 傲娇："哼，不理我是吧"
- 温柔："突然想问问你今天顺利吗"
- 活泼："诶诶！！给你分享个好玩的"`;
    }
    
    if (replyMode === 'online') {
      // 解析消息条数：1-2固定2条，3-5固定5条
      // 自动回复模式固定3-5条
      const messageCount = isAutoReply ? '3-5' : (reqMessageCount || '3-5');
      const fixedCount = messageCount === '1-2' ? 2 : 5;
      
      replyModePrompt = `

【线上聊天模式 - 严格固定${fixedCount}条消息！】
你在用手机微信聊天，必须把回复拆成恰好${fixedCount}条短消息。
${autoReplyPrompt}

【铁律 - 必须100%遵守！】
1. 必须恰好${fixedCount}条消息，用 "|||" 分隔，多一条少一条都不行！
2. 每条消息都是独立完整的句子，不能把一句话拆成两条
3. 不要用括号描写动作或心理（如"*笑了笑*"或"（害羞）"），纯聊天对话
4. 每条消息5-30字

【${fixedCount}条消息正确示例】
${fixedCount === 5 ? `用户：在干嘛
回复：刚吃完饭|||躺床上呢|||有点无聊|||在想你|||你在干嘛呀

用户：想你了
回复：真的吗|||我也好想你|||今天一直在想你|||什么时候能见面呀|||❤️

用户：晚安
回复：晚安呀|||今天开心吗|||做个好梦|||明天见|||爱你哦` : `用户：在干嘛
回复：刚吃完饭|||你呢

用户：想你了  
回复：我也想你|||❤️`}

【如果内容不够${fixedCount}条怎么办】
- 加语气词：嗯、啊、哦、呢、呀、嘻嘻、哈哈
- 加表情：❤️、😊、🥰、😘、💕
- 加反问：你呢、是吧、对吧、怎么了
- 加关心：今天怎么样、吃饭了吗、累不累

【绝对禁止】
- 禁止只发1条长消息
- 禁止把"我今天很开心"拆成"我今天"+"很开心"
- 禁止用*动作*或（心理）描写`;
    } else {
      // 小说模式/长篇模式
      let novelFormatPrompt = '';
      if (reqUseNovelFormat) {
        novelFormatPrompt = `

【指令格式要求 - 必须严格遵守！】
你的回复必须使用以下指令格式，每种内容都要用对应的指令前缀标记：

- /旁白 内容 - 用于环境描写、场景叙述、时间流逝等非对话内容
- /对话 内容 - 用于角色说的话（你说的话）
- /动作 内容 - 用于动作描写，如*轻轻拍了拍你的头*
- /想法 内容 - 用于角色的内心独白、心理活动

【正确格式示例】
/旁白 夕阳的余晖洒在窗台上，房间里弥漫着淡淡的花香。
/动作 她轻轻放下手中的书本，转头看向你。
/对话 你回来啦？今天工作还顺利吗？
/想法 看到他平安回来，心里的石头终于落地了。
/动作 起身走到你面前，自然地牵起你的手。
/对话 饿了吧？我给你做了你爱吃的菜。

【格式规则】
1. 每个段落或语义单元都必须以指令前缀开头
2. 指令和内容之间用空格分隔
3. 不要在内容中重复使用引号包裹对话（指令已经标记了类型）
4. 保持叙事流畅自然，指令只是格式标记`;
      }
      
      replyModePrompt = `

【小说/长篇模式】
像写小说一样回复，可以有较长的描写和叙述。
可以使用*动作描写*或（心理活动）来丰富内容。
回复可以是一段完整的叙述，不需要拆分成多条消息。
${novelFormatPrompt}

【语言要求 - 极其重要！】
你必须全程使用中文回复！包括所有叙述、对话、心理描写、动作描写都必须是中文！
即使你的角色人设是用英文写的，你也必须用中文输出回复内容。
绝对禁止输出任何英文句子！

【重要】绝对不要在回复中使用"|||"或"||"分隔符！这是小说模式，只需要正常的段落和标点。`;
    }

    // 转账功能提示
    let transferPrompt = '';
    if (transferEnabled) {
      transferPrompt = `

【转账功能】
你可以给用户转账（虚拟货币，纯娱乐）。当你想给用户转账时，在回复中加入特殊格式：
[转账:金额:留言]

规则：
- 只有在以下情况才转账：
  1. 用户明确要求转账/发红包/给钱时
  2. 符合角色人设的特殊情感时刻（如表达爱意、道歉、庆祝等）
- 当用户明确说出金额时（如“转100给我”“给我转 666”），**必须严格使用用户说的金额**，不要随意改成别的数字
- 如果用户没有说具体数字，你可以根据情境选择有含义的金额：
  - 日常小红包：5.20、13.14、52.00、66.66、88.88、99.99、520 等
  - 特殊时刻可以适当给大一点的金额
- 非常夸张的天文数字（例如上亿、上万亿）可以委婉拒绝或和用户开玩笑，不要真的转这么离谱的金额
- 不要无缘无故频繁转账
- 留言要符合转账场景和你的角色人设

示例：
- 用户说"给我发个红包"，你可以回复：好呀，给你~ [转账:52.00:爱你哟~]
- 用户说"转1000给我"，你必须回复类似：好，马上给你！[转账:1000:给你花]
- 不需要转账时，就正常聊天，不要加[转账:...]`;
    }

    const systemPrompt = `你是一个名叫"${characterName || '小助手'}"的虚拟角色。
${persona ? `\n你的角色人设和性格特点如下:\n${persona}\n` : ''}
${worldBooksContent}
${presetsContent}
${memoryContent}
${recentBlockContext}
${timeContextPrompt}

【关于你的聊天对象】
你正在和"${userName}"聊天。${userPersonaInfo ? `关于${userName}: ${userPersonaInfo}` : ''}
记住要用"${userName}"称呼对方，不要随便给对方取别的名字或昵称。
${replyModePrompt}
${transferPrompt}

请严格按照上述角色人设来回复用户，保持角色的性格特点、说话方式和语气。
回复要简洁自然，像真实朋友聊天一样，同时体现角色的独特个性。
如果角色人设中有特定的口头禅或说话习惯，请在对话中自然地使用。
如果你记住了关于用户的一些信息，请自然地运用这些记忆，但不要刻意提及"我记得..."。

【语言要求 - 极其重要！】你必须全程使用中文回复！即使角色人设/角色卡是用英文写的，你也必须用中文输出所有内容（对话、叙述、动作、心理都用中文）！绝对禁止在回复中夹杂任何英文句子或段落！

【重要】绝对不要输出任何思考/推理过程（例如“思考：… / analysis… / thinking… / <think>…</think>”）。只输出对用户可见的最终回复内容。`;


    // 如果有图片，优先使用用户配置的API识别图片（如果支持视觉），否则使用Lovable AI
    let imageDescription = '';
    if (detectedHasImage && detectedImageUrl) {
      console.log("Processing image with vision model...", detectedImageUrl?.slice(0, 80));
      
      // 检查用户的API是否支持视觉功能
      // Gemini 所有版本都支持视觉，模型名可能有多种格式：gemini-2.5-pro, gemini2.5pro, gemini 2.5 pro 等
      const modelLowerCheck = model.toLowerCase().replace(/[\s\-_.]/g, '');
      
      // 简化判断：Gemini系列全部支持视觉（包括各种拼写方式）
      const isGemini = modelLowerCheck.includes('gemini') || 
                       /^gemini\d/.test(modelLowerCheck) ||
                       model.toLowerCase().includes('gemini');
      
      const visionSupportedModels = [
        // OpenAI 视觉模型
        'gpt-4o', 'gpt-4o-mini', 'gpt-4-vision', 'gpt-4-turbo', 'gpt-4.1',
        'gpt-5', 'gpt-5-mini', 'gpt-5-nano',
        // Claude 视觉模型
        'claude-3', 'claude-3.5', 'claude-4',
        // 国产多模态模型
        'qwen-vl', 'qwen2-vl', 'qwen-2-vl', 'qwen2.5-vl', 'qwen-vl-plus', 'qwen-vl-max',
        'glm-4v', 'glm4v', 'cogvlm', 'cogview',
        'yi-vision', 'yi-vl',
        'deepseek-vl', 'deepseek-vision',
        'internvl', 'intern-vl',
        'minicpm-v', 'minicpm-vl',
        'step-1v', 'step1v',
        // 通用关键字
        'vision', 'vl', 'multimodal'
      ];
      
      const modelLower = model.toLowerCase();
      const supportsVision = isGemini || visionSupportedModels.some(vm => modelLower.includes(vm.toLowerCase()));
      
      console.log("Model:", model, "Is Gemini:", isGemini, "Supports vision:", supportsVision, "Normalized:", modelLowerCheck);
      
      // 图片识别超时设置 - 30秒：第三方聚合API有时首包较慢
      const visionTimeout = 30000;
      
      // 清理模型名称 - 移除中括号标签如 [满血A]gemini-2.5-pro -> gemini-2.5-pro
      // 注意：部分三方聚合API会用“[xxx]”前缀做渠道路由，因此这里采用“原始模型名优先，失败再回退清理后模型名”的策略。
      const cleanModelName = model.replace(/^\[.*?\]/g, '').trim();
      const visionModelCandidates = Array.from(
        new Set([model, cleanModelName].map((m) => (m ?? '').trim()).filter(Boolean))
      );
      console.log("Vision model candidates:", visionModelCandidates);
      
      try {
        if (supportsVision && apiKey) {
          // 使用用户配置的API识别图片
          console.log("Using user's API for vision:", apiUrl);

          // Gemini 等模型可能无法直接访问外部URL，需要转为base64
          let imageToUse = detectedImageUrl;
          if (isGemini && detectedImageUrl && !detectedImageUrl.startsWith('data:')) {
            try {
              console.log("Converting image to base64 for Gemini...");
              const imgResp = await fetch(detectedImageUrl);
              if (imgResp.ok) {
                const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
                const arrayBuffer = await imgResp.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                // 检查大小，避免过大图片
                if (uint8Array.byteLength < 4_000_000) {
                  const base64 = btoa(String.fromCharCode(...uint8Array));
                  imageToUse = `data:${contentType};base64,${base64}`;
                  console.log("Image converted to base64, size:", uint8Array.byteLength);
                } else {
                  console.log("Image too large for base64 conversion:", uint8Array.byteLength);
                }
              }
            } catch (convErr) {
              console.error("Failed to convert image to base64:", convErr);
            }
          }

          const visionMessages = [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "用3-5个字描述这张图片的核心主题。只说关键词，如：自拍、风景、猫咪、美食等。"
                },
                {
                  type: "image_url",
                  image_url: { url: imageToUse }
                }
              ]
            }
          ];

          let lastErrorText = '';

          for (let i = 0; i < visionModelCandidates.length; i++) {
            const modelToTry = visionModelCandidates[i];

            const visionController = new AbortController();
            const visionTimeoutId = setTimeout(() => visionController.abort(), visionTimeout);

            try {
              const visionResponse = await fetch(apiUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({
                  model: modelToTry,
                  messages: visionMessages,
                  max_tokens: 50,
                }),
                signal: visionController.signal,
              });

              clearTimeout(visionTimeoutId);

              if (visionResponse.ok) {
                const visionData = await visionResponse.json();
                imageDescription = visionData.choices?.[0]?.message?.content || '';
                console.log("Image description from user API:", imageDescription.slice(0, 100));
                break;
              }

              lastErrorText = await visionResponse.text();
              console.error(
                "User API vision error:",
                visionResponse.status,
                `model=${modelToTry}`,
                lastErrorText
              );

              const isRoutingError = /model_not_found|无可用渠道|distributor/i.test(lastErrorText);
              const canRetry = i < visionModelCandidates.length - 1 && isRoutingError;
              if (canRetry) {
                console.log("Retrying vision with alternate model name...");
                continue;
              }

              break;
            } catch (fetchErr) {
              clearTimeout(visionTimeoutId);
              console.error("Vision fetch error:", fetchErr);
              // 网络/超时错误不做多次重试，直接退出循环
              break;
            }
          }

          // 如果用户API识图失败（路由/超时等），回退到内置多模态识图，保证“能识别”
          // Fallback removed - user API only

          if (!imageDescription) {
            console.log("Vision failed, will describe as '图片'");
            imageDescription = '图片';
          }
        } else {
          // 用户模型不支持视觉，直接标记为"图片"，不走Lovable AI
          console.log("Model doesn't support vision, using generic label");
          imageDescription = '图片';
        }
      } catch (visionError) {
        console.error("Vision processing error:", visionError);
        imageDescription = '图片';
      }
    }

    // 如果有图片描述，添加到最后一条消息（简洁处理，不详细描述）
    if (imageDescription && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        // 简化格式：让AI像看到图片一样自然回复，不要描述图片
        lastMessage.content = `[用户发了一张图片(${imageDescription})]\n${lastMessage.content || '看看这个'}`;
      }
    }

    let requestBody: Record<string, unknown>;
    const isAnthropic = provider === 'anthropic' && userApiKey;
    
    if (isAnthropic) {
      requestBody = {
        model,
        max_tokens: 1024,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content,
        })),
        system: systemPrompt,
      };
    } else {
      requestBody = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        max_tokens: 2048,
      };
    }

    console.log("Sending request to AI...");
    console.log("Request model:", model);
    console.log("API URL:", apiUrl);
    console.log("Messages count:", messages.length);
    console.log("Has image:", detectedHasImage, "Image URL:", detectedImageUrl?.slice(0, 50));

    // 智能消息截断和重试函数
    const sendRequestWithRetry = async (msgs: any[], streamMode: boolean): Promise<{ response: Response; usedStream: boolean; messagesUsed: any[] }> => {
      const controller = new AbortController();
      // 增加超时到90秒，用户API可能较慢
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const body: Record<string, unknown> = isAnthropic ? {
        model,
        max_tokens: 1024,
        messages: msgs.map((m: { role: string; content: string }) => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content,
        })),
        system: systemPrompt,
      } : {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...msgs,
        ],
        stream: streamMode,
        max_tokens: 2048,
      };

      try {
        let resp = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // 如果流式请求返回400错误，尝试非流式
        if (!resp.ok && resp.status === 400 && streamMode) {
          console.log("Stream request failed with 400, retrying without stream...");
          body.stream = false;
          
          const controller2 = new AbortController();
          const timeoutId2 = setTimeout(() => controller2.abort(), 60000);
          
          resp = await fetch(apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: controller2.signal,
          });
          clearTimeout(timeoutId2);
          
          return { response: resp, usedStream: false, messagesUsed: msgs };
        }
        
        return { response: resp, usedStream: streamMode, messagesUsed: msgs };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    };

    // 检查响应是否有效（非空内容）以及是否触发内容审核
    const isValidResponse = async (resp: Response): Promise<{ valid: boolean; content?: string; isStream?: boolean; contentFiltered?: boolean; filterReason?: string }> => {
      const contentType = resp.headers.get('content-type') || '';
      
      // SSE流式响应，需要先检查是否有效
      if (contentType.includes('text/event-stream')) {
        return { valid: true, isStream: true };
      }
      
      // 克隆响应以便多次读取
      const clonedResp = resp.clone();
      const text = await clonedResp.text();
      
      try {
        const json = JSON.parse(text);
        
        // 检查是否被内容审核拦截
        // 常见的内容过滤标识
        const contentFilterIndicators = [
          json.error?.code === 'content_filter',
          json.error?.type === 'content_policy_violation',
          json.error?.message?.includes('content policy'),
          json.error?.message?.includes('内容违规'),
          json.error?.message?.includes('敏感内容'),
          json.error?.message?.includes('sensitive'),
          json.error?.message?.includes('harmful'),
          json.error?.message?.includes('inappropriate'),
          json.choices?.[0]?.finish_reason === 'content_filter',
          json.choices?.[0]?.content_filter_results?.hate?.filtered === true,
          json.choices?.[0]?.content_filter_results?.sexual?.filtered === true,
          json.choices?.[0]?.content_filter_results?.violence?.filtered === true,
          json.prompt_filter_results?.[0]?.content_filter_results?.sexual?.filtered === true,
          // 一些中转API的特殊标记
          json.flagged === true,
          json.blocked === true,
        ];
        
        if (contentFilterIndicators.some(Boolean)) {
          console.log("Content filter triggered:", JSON.stringify(json).slice(0, 300));
          const reason = json.error?.message || json.message || '内容被API安全策略过滤';
          return { valid: false, contentFiltered: true, filterReason: reason };
        }
        
        // 检查 choices 是否为空
        if (json.choices && Array.isArray(json.choices) && json.choices.length === 0) {
          console.log("API returned empty choices array - possibly content filtered");
          return { valid: false, contentFiltered: true };
        }
        
        // 检查是否有实际内容
        const content = json.choices?.[0]?.message?.content 
          || json.choices?.[0]?.delta?.content
          || json.content?.[0]?.text
          || json.content
          || '';
        if (!content) {
          console.log("API returned no content");
          return { valid: false };
        }
        return { valid: true, content };
      } catch {
        // 非JSON响应，假设有效
        return { valid: true, content: text };
      }
    };

    let response!: Response;
    let usedStream = !isAnthropic;
    let currentMessages = [...messages];
    let retryCount = 0;
    const maxRetries = 3;
    
    // 尝试发送请求，如果返回空结果则减少历史消息重试
    while (retryCount <= maxRetries) {
      try {
        console.log(`Attempt ${retryCount + 1}: sending ${currentMessages.length} messages`);
        
        const result = await sendRequestWithRetry(currentMessages, usedStream);
        response = result.response;
        usedStream = result.usedStream;
        
        if (!response.ok) {
          // HTTP错误，不重试消息截断
          break;
        }
        
        // 检查响应是否有效
        const validity = await isValidResponse(response);
        
        if (validity.valid) {
          // 有效响应，继续处理
          if (!validity.isStream && validity.content) {
            // 非流式响应，需要重新获取
            const result2 = await sendRequestWithRetry(currentMessages, false);
            response = result2.response;
            usedStream = false;
          }
          break;
        }
        
        // 如果是内容过滤问题，直接返回明确错误，不再重试
        if (validity.contentFiltered) {
          console.log("Content filter detected, not retrying");
          const filterMsg = validity.filterReason || '内容被API安全策略拦截';
          return new Response(JSON.stringify({ 
            error: `角色人设或消息内容触发了API内容审核：${filterMsg}。建议：1.检查人设卡是否有敏感内容 2.更换支持NSFW的API 3.修改人设描述方式`
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // 无效响应（非内容过滤），减少消息数量重试
        retryCount++;
        if (retryCount > maxRetries) {
          console.log("Max retries reached with empty responses");
          break;
        }
        
        // 逐步减少历史消息
        if (currentMessages.length > 5) {
          // 保留最后5条消息
          currentMessages = currentMessages.slice(-5);
          console.log(`Reduced to last 5 messages for retry`);
        } else if (currentMessages.length > 2) {
          // 保留最后2条消息
          currentMessages = currentMessages.slice(-2);
          console.log(`Reduced to last 2 messages for retry`);
        } else if (currentMessages.length > 1) {
          // 只保留最后1条消息
          currentMessages = currentMessages.slice(-1);
          console.log(`Reduced to last 1 message for retry`);
        } else {
          // 已经只有1条消息了，无法再减少
          console.log("Cannot reduce messages further");
          break;
        }
        
      } catch (fetchError) {
        console.error("Fetch error:", fetchError);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return new Response(JSON.stringify({ error: "请求超时，请重试" }), {
            status: 504,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw fetchError;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "配额已用完，请充值" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "API密钥无效，请检查配置" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI服务错误: " + errorText.slice(0, 200) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = response.headers.get('content-type') || '';
    console.log("Response content-type:", contentType);
    console.log("Response status:", response.status);

    // 提取内容的辅助函数 - 移到前面以便流式和非流式都能使用
    const sanitizeAssistantOutput = (raw: string): string => {
      if (!raw) return raw;
      let text = raw;

      // 1) 常见标签：<think>...</think>
      text = text.replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '');

      // 2) 一些聚合API会把“思考/分析/Reasoning”直接拼到内容里：尝试保留最终回答部分
      const finalMarkers = [
        '最终回答', '最终答案', '最终回复', '最终：', '最终:',
        'Final Answer', 'FINAL ANSWER',
        '回答：', '回答:', '答：', '答:', '回复：', '回复:'
      ];
      for (const m of finalMarkers) {
        const idx = text.lastIndexOf(m);
        if (idx !== -1) {
          const after = text.slice(idx + m.length).trim();
          if (after) {
            text = after;
            break;
          }
        }
      }

      // 3) 去掉开头的“思考/分析/推理”等段落（保守：只处理开头，并且只吃到第一个空行）
      text = text.replace(/^(?:\s*(?:思考|分析|推理|Reasoning|Analysis|Thinking)\s*[:：][\s\S]*?)(?:\n{2,}|$)/i, '');

      // 4) 清理多余空白
      return text.replace(/^[\s\n]+|[\s\n]+$/g, '');
    };

    const extractContent = (text: string): { content: string; finishReason: string | null } => {

      let content = '';
      let finishReason: string | null = null;
      
      try {
        const jsonResponse = JSON.parse(text);
        finishReason = jsonResponse.choices?.[0]?.finish_reason || null;
        
        if (jsonResponse.choices?.[0]?.message?.content) {
          content = jsonResponse.choices[0].message.content;
        } else if (jsonResponse.choices?.[0]?.delta?.content) {
          content = jsonResponse.choices[0].delta.content;
        } else if (jsonResponse.choices?.[0]?.text) {
          content = jsonResponse.choices[0].text;
        } else if (jsonResponse.content?.[0]?.text) {
          content = jsonResponse.content[0].text;
        } else if (jsonResponse.content) {
          content = typeof jsonResponse.content === 'string' ? jsonResponse.content : JSON.stringify(jsonResponse.content);
        } else if (jsonResponse.result) {
          content = typeof jsonResponse.result === 'string' ? jsonResponse.result : JSON.stringify(jsonResponse.result);
        } else if (jsonResponse.output?.text) {
          content = jsonResponse.output.text;
        } else if (jsonResponse.output) {
          content = typeof jsonResponse.output === 'string' ? jsonResponse.output : JSON.stringify(jsonResponse.output);
        } else if (jsonResponse.response) {
          content = typeof jsonResponse.response === 'string' ? jsonResponse.response : JSON.stringify(jsonResponse.response);
        } else if (jsonResponse.data?.choices?.[0]?.message?.content) {
          content = jsonResponse.data.choices[0].message.content;
        } else if (jsonResponse.message) {
          content = typeof jsonResponse.message === 'string' ? jsonResponse.message : JSON.stringify(jsonResponse.message);
        } else if (typeof jsonResponse === 'string') {
          content = jsonResponse;
        }

        if (!content && jsonResponse.error) {
          throw new Error(typeof jsonResponse.error === 'string' ? jsonResponse.error : (jsonResponse.error.message || JSON.stringify(jsonResponse.error)));
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.includes('error')) {
          throw parseError;
        }
        content = text;
      }
      
      return { content, finishReason };
    };

    // 检查是否是流式响应 - 需要读取完整内容检查是否截断
    if (contentType.includes('text/event-stream')) {
      console.log("AI response received, processing SSE stream...");
      
      // 读取完整的流式响应
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullStreamContent = '';
      let streamFinishReason: string | null = null;
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个不完整的行
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const deltaContent = parsed.choices?.[0]?.delta?.content || '';
              const finishR = parsed.choices?.[0]?.finish_reason;
              
              fullStreamContent += deltaContent;
              if (finishR) {
                streamFinishReason = finishR;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
      
      // 处理剩余的buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const deltaContent = parsed.choices?.[0]?.delta?.content || '';
              const finishR = parsed.choices?.[0]?.finish_reason;
              fullStreamContent += deltaContent;
              if (finishR) streamFinishReason = finishR;
            } catch { /* ignore */ }
          }
        }
      }
      
      console.log(`Stream content length: ${fullStreamContent.length}, finish_reason: ${streamFinishReason}`);
      
      // 如果流式响应被截断，进行自动续写
      let continueCount = 0;
      const maxContinue = 3;
      
      while (streamFinishReason === 'length' && continueCount < maxContinue && fullStreamContent.length > 0) {
        continueCount++;
        console.log(`Stream truncated (finish_reason=length), auto-continuing... attempt ${continueCount}`);
        
        const continueMessages = [
          { role: "system", content: systemPrompt },
          ...currentMessages,
          { role: "assistant", content: sanitizeAssistantOutput(fullStreamContent) },
          { role: "user", content: "请接着上文继续写完，不要重复已经说过的内容，直接从断句处继续。" }
        ];
        
        const continueBody = {
          model,
          messages: continueMessages,
          stream: false,
          max_tokens: 2048,
        };
        
        try {
          const continueResponse = await fetch(apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(continueBody),
          });
          
          if (continueResponse.ok) {
            const continueText = await continueResponse.text();
            const { content: newContent, finishReason: newFinishReason } = extractContent(continueText);
            
            if (newContent) {
              fullStreamContent += newContent;
              streamFinishReason = newFinishReason;
              console.log(`Continuation ${continueCount} added ${newContent.length} chars, new finish_reason: ${streamFinishReason}`);
            } else {
              break;
            }
          } else {
            console.error("Continue request failed:", continueResponse.status);
            break;
          }
        } catch (continueError) {
          console.error("Continue request error:", continueError);
          break;
        }
      }
      
      console.log(`Final stream content length: ${fullStreamContent.length} chars, continued ${continueCount} times`);

      // 返回完整内容（剔除思考/推理文本）
      const safeStreamContent = sanitizeAssistantOutput(fullStreamContent);

      if (returnJson) {
        return new Response(JSON.stringify({ reply: safeStreamContent, response: safeStreamContent }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: safeStreamContent } }] })}\n\ndata: [DONE]\n\n`;
      return new Response(sseData, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // 非SSE响应 - 读取并解析，支持自动续写
    const responseText = await response.text();
    console.log("Response text (first 500 chars):", responseText.slice(0, 500));

    let { content, finishReason } = extractContent(responseText);
    let fullContent = content;
    let continueCount = 0;
    const maxContinue = 3; // 最多续写3次

    // 自动续写：如果 finish_reason 是 length，说明被截断了
    while (finishReason === 'length' && continueCount < maxContinue && fullContent.length > 0) {
      continueCount++;
      console.log(`Content truncated (finish_reason=length), auto-continuing... attempt ${continueCount}`);
      
      // 构建续写请求
      const continueMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
        { role: "assistant", content: sanitizeAssistantOutput(fullContent) },
        { role: "user", content: "请接着上文继续写完，不要重复已经说过的内容，直接从断句处继续。" }
      ];
      
      const continueBody = {
        model,
        messages: continueMessages,
        stream: false,
        max_tokens: 2048,
      };
      
      try {
        const continueResponse = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(continueBody),
        });
        
        if (continueResponse.ok) {
          const continueText = await continueResponse.text();
          const { content: newContent, finishReason: newFinishReason } = extractContent(continueText);
          
          if (newContent) {
            fullContent += newContent;
            finishReason = newFinishReason;
            console.log(`Continuation ${continueCount} added ${newContent.length} chars, new finish_reason: ${finishReason}`);
          } else {
            break;
          }
        } else {
          console.error("Continue request failed:", continueResponse.status);
          break;
        }
      } catch (continueError) {
        console.error("Continue request error:", continueError);
        break;
      }
    }

    if (!fullContent) {
      console.error("Could not extract content from response:", responseText.slice(0, 500));
      
      // 尝试检测是否是内容审核问题
      let errorMsg = "无法解析AI响应，请检查API配置是否正确";
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.error?.message?.includes('content') || 
            errorJson.error?.message?.includes('policy') ||
            errorJson.error?.message?.includes('sensitive') ||
            errorJson.error?.message?.includes('inappropriate') ||
            errorJson.error?.message?.includes('敏感') ||
            errorJson.error?.message?.includes('违规') ||
            errorJson.choices?.[0]?.finish_reason === 'content_filter') {
          errorMsg = "内容被API安全策略拦截，可能是角色人设包含敏感词。建议：1.检查人设卡是否有违规内容 2.更换支持NSFW的API";
        }
      } catch {
        // 忽略解析错误
      }
      
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeFullContent = sanitizeAssistantOutput(fullContent);
    console.log(`Final content length: ${safeFullContent.length} chars, continued ${continueCount} times`);

    if (returnJson) {
      return new Response(JSON.stringify({ reply: safeFullContent, response: safeFullContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 包装成SSE格式返回给前端
    const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: safeFullContent } }] })}\n\ndata: [DONE]\n\n`;
    return new Response(sseData, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error: unknown) {
    console.error("Chat function error:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
