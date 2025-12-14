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
  let { messages, persona, characterName, characterId, userApiKey, provider, baseUrl, model: customModel, userProfile, userId, replyMode: reqReplyMode, onlineMessageCount: reqMessageCount, transferEnabled } = await req.json();
    
    // 获取预设、世界书和记忆摘要
    let presetsContent = '';
    let worldBooksContent = '';
    let memoryContent = '';
    
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
        
        // 应用历史消息限制
        if (historyLimitSetting) {
          const limit = Number(historyLimitSetting.api_key) || 10;
          if (messages.length > limit) {
            console.log(`Limiting messages from ${messages.length} to ${limit}`);
            messages = messages.slice(-limit);
          }
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
      // 没有任何配置，提示用户去设置
      return new Response(JSON.stringify({ error: "请先在设置中配置API密钥" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      model = "google/gemini-2.5-flash";
      headers["Authorization"] = `Bearer ${apiKey}`;
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
    console.log('Reply mode:', replyMode);

    let replyModePrompt = '';
    if (replyMode === 'online') {
      // 解析消息条数范围
      const messageCount = reqMessageCount || '3-5';
      const [minCount, maxCount] = messageCount.split('-').map(Number);
      
      replyModePrompt = `

【极其重要：线上聊天模式 - 必须严格遵守！】
你现在是在手机上和用户聊天，必须模拟真实的在线聊天方式！

核心规则：
1. 你的回复必须拆分成 ${minCount} 到 ${maxCount} 条独立的短消息
2. 每条消息之间用 "|||" 分隔（三个竖线，这是强制格式）
3. 每条消息保持简短（5-25个字最佳），像真正在手机打字一样
4. 不要在一条消息里说太多内容

正确格式示例（${minCount}-${maxCount}条）：
嘿~|||今天怎么样呀|||有没有想我呢？|||哈哈

错误格式（绝对不要这样）：
- 只回复一整段话
- 忘记用 ||| 分隔
- 只回复1条消息

注意：
- "|||" 是分隔符，不是普通文本
- 即使内容简单，也要拆成多条
- 每条消息可以用表情、语气词
- 消息之间保持对话感和连贯性`;
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
- 金额要合理，根据情境决定：
  - 日常小红包：5.20、13.14、52.00、66.66、88.88、99.99、520 等有意义的数字
  - 用户指定金额：如果用户说"转100给我"，就转100
  - 大额转账需要特殊理由
- 不要无缘无故转账，不要每次都转账
- 留言要符合转账场景和你的角色人设

示例：
- 用户说"给我发个红包"，你可以回复：好呀，给你~ [转账:52.00:爱你哟~]
- 用户说"转1000给我"，你可以回复：好好好，土豪接好！[转账:1000:给你花]
- 不需要转账时，就正常聊天，不要加[转账:...]`;
    }

    const systemPrompt = `你是一个名叫"${characterName || '小助手'}"的虚拟角色。
${persona ? `\n你的角色人设和性格特点如下:\n${persona}\n` : ''}
${worldBooksContent}
${presetsContent}
${memoryContent}

【关于你的聊天对象】
你正在和"${userName}"聊天。${userPersonaInfo ? `关于${userName}: ${userPersonaInfo}` : ''}
记住要用"${userName}"称呼对方，不要随便给对方取别的名字或昵称。
${replyModePrompt}
${transferPrompt}

请严格按照上述角色人设来回复用户，保持角色的性格特点、说话方式和语气。
回复要简洁自然，像真实朋友聊天一样，同时体现角色的独特个性。
如果角色人设中有特定的口头禅或说话习惯，请在对话中自然地使用。
如果你记住了关于用户的一些信息，请自然地运用这些记忆，但不要刻意提及"我记得..."。`;

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
        max_tokens: 2048, // 确保有足够的token生成完整回复
      };
    }

    console.log("Sending request to AI...");
    console.log("Request model:", model);
    console.log("API URL:", apiUrl);
    console.log("Messages count:", messages.length);

    // 智能消息截断和重试函数
    const sendRequestWithRetry = async (msgs: any[], streamMode: boolean): Promise<{ response: Response; usedStream: boolean; messagesUsed: any[] }> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

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

    // 检查响应是否有效（非空内容）
    const isValidResponse = async (resp: Response): Promise<{ valid: boolean; content?: string; isStream?: boolean }> => {
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
        // 检查 choices 是否为空
        if (json.choices && Array.isArray(json.choices) && json.choices.length === 0) {
          console.log("API returned empty choices array");
          return { valid: false };
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
        
        // 无效响应，减少消息数量重试
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

    // 检查是否是流式响应
    if (contentType.includes('text/event-stream')) {
      console.log("AI response received, streaming SSE...");
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // 非SSE响应 - 读取并解析，支持自动续写
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
        { role: "assistant", content: fullContent },
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
      return new Response(JSON.stringify({ error: "无法解析AI响应，请检查API配置是否正确" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Final content length: ${fullContent.length} chars, continued ${continueCount} times`);

    // 包装成SSE格式返回给前端
    const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: fullContent } }] })}\n\ndata: [DONE]\n\n`;
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
