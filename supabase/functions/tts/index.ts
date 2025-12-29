import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, ttsConfig } = await req.json();
    
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!ttsConfig?.apiKey || !ttsConfig?.baseUrl) {
      return new Response(
        JSON.stringify({ error: 'TTS API configuration is required (apiKey and baseUrl)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { apiKey, baseUrl, model } = ttsConfig;
    
    // 标准化 baseUrl - 移除尾部斜杠
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    
    // Build the request URL - support different API formats
    let requestUrl = normalizedBaseUrl;
    let requestBody: Record<string, unknown> = {};
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Detect API type based on URL patterns
    // ===== Volink API 专门检测 =====
    const isVolink = normalizedBaseUrl.includes('volink');
    const isOpenAILike = !isVolink && (
      normalizedBaseUrl.includes('openai') || 
      normalizedBaseUrl.includes('/v1/audio/speech') ||
      normalizedBaseUrl.includes('api2d') ||
      normalizedBaseUrl.includes('openrouter')
    );
    const isElevenLabs = normalizedBaseUrl.includes('elevenlabs');
    const isMinimax = !isVolink && normalizedBaseUrl.includes('minimax');
    const isFishAudio = normalizedBaseUrl.includes('fish.audio') || normalizedBaseUrl.includes('fish-audio');
    const isAzure = normalizedBaseUrl.includes('azure') || normalizedBaseUrl.includes('cognitiveservices');
    const isGoogleTTS = normalizedBaseUrl.includes('texttospeech.googleapis');
    const isByteDance = normalizedBaseUrl.includes('bytedance') || normalizedBaseUrl.includes('volcengine');
    const isXunfei = normalizedBaseUrl.includes('xfyun') || normalizedBaseUrl.includes('xunfei');
    const isBaidu = normalizedBaseUrl.includes('baidu');
    const isTencent = normalizedBaseUrl.includes('tencent');
    const isAliyun = normalizedBaseUrl.includes('aliyun') || normalizedBaseUrl.includes('alibaba');
    const isSiliconFlow = normalizedBaseUrl.includes('siliconflow');

    console.log('TTS API Detection:', {
      baseUrl: normalizedBaseUrl,
      isVolink,
      isOpenAILike,
      isElevenLabs,
      isMinimax,
      isFishAudio,
      isAzure,
      isGoogleTTS,
      isByteDance,
      voiceId,
    });

    // ===== Volink API =====
    // 文档: https://api.volink.org/
    // POST /api/v1/tts
    // Body: { voice_id, text, stream? }
    // Response: binary MP3
    if (isVolink) {
      // 验证 voice_id 必填
      if (!voiceId || voiceId === 'default') {
        return new Response(
          JSON.stringify({ 
            error: 'Volink TTS requires a voice_id. Please set the voice ID in character settings.',
            details: 'Go to chat menu (three dots) → Set character voice ID'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // 构建正确的 URL: baseUrl + /api/v1/tts
      // 处理不同的 baseUrl 格式:
      // - https://api.volink.org -> https://api.volink.org/api/v1/tts
      // - https://api.volink.org/ -> https://api.volink.org/api/v1/tts
      // - https://api.volink.org/api/v1/tts -> 保持不变
      if (normalizedBaseUrl.includes('/api/v1/tts')) {
        requestUrl = normalizedBaseUrl;
      } else if (normalizedBaseUrl.includes('/api/v1')) {
        requestUrl = `${normalizedBaseUrl}/tts`;
      } else if (normalizedBaseUrl.includes('/api')) {
        requestUrl = `${normalizedBaseUrl}/v1/tts`;
      } else {
        requestUrl = `${normalizedBaseUrl}/api/v1/tts`;
      }
      
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        text,
        voice_id: voiceId,
        // stream: false  // 可选，默认 false
      };
      
      console.log('Volink TTS Request:', { requestUrl, voiceId, textLength: text.length });
    } else if (isElevenLabs) {
      // ElevenLabs API format
      requestUrl = voiceId 
        ? `${normalizedBaseUrl.replace(/\/text-to-speech.*$/, '')}/text-to-speech/${voiceId}`
        : normalizedBaseUrl;
      headers['xi-api-key'] = apiKey;
      requestBody = {
        text,
        model_id: model || 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
      };
    } else if (isMinimax) {
      // Minimax TTS API format
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        text,
        voice_id: voiceId || 'default',
        model: model || 'speech-01',
        output_format: 'mp3',
      };
    } else if (isFishAudio) {
      // Fish Audio API format
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        text,
        reference_id: voiceId,
        format: 'mp3',
      };
    } else if (isAzure) {
      // Azure Cognitive Services TTS
      headers['Ocp-Apim-Subscription-Key'] = apiKey;
      headers['Content-Type'] = 'application/ssml+xml';
      headers['X-Microsoft-OutputFormat'] = 'audio-16khz-128kbitrate-mono-mp3';
      
      const voice = voiceId || 'zh-CN-XiaoxiaoNeural';
      requestBody = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>
        <voice name='${voice}'>${text}</voice>
      </speak>` as any;
    } else if (isGoogleTTS) {
      // Google Cloud TTS
      requestUrl = `${normalizedBaseUrl}?key=${apiKey}`;
      requestBody = {
        input: { text },
        voice: { languageCode: 'zh-CN', name: voiceId || 'zh-CN-Standard-A' },
        audioConfig: { audioEncoding: 'MP3' },
      };
    } else if (isByteDance) {
      // 字节跳动/火山引擎 TTS
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        text,
        voice_type: voiceId || 'zh_female_qingxin',
        encoding: 'mp3',
        speed_ratio: 1.0,
      };
    } else if (isXunfei) {
      // 讯飞 TTS
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        text,
        vcn: voiceId || 'xiaoyan',
        aue: 'lame',
        speed: 50,
        volume: 50,
        pitch: 50,
      };
    } else if (isBaidu) {
      // 百度 TTS
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const params = new URLSearchParams({
        tex: text,
        tok: apiKey,
        cuid: 'lovable_app',
        ctp: '1',
        lan: 'zh',
        per: voiceId || '0',
        aue: '3',
      });
      requestBody = params.toString() as any;
    } else if (isTencent) {
      // 腾讯云 TTS
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        Text: text,
        VoiceType: parseInt(voiceId) || 0,
        PrimaryLanguage: 1,
        SampleRate: 16000,
        Codec: 'mp3',
      };
    } else if (isAliyun) {
      // 阿里云 TTS
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        text,
        voice: voiceId || 'xiaoyun',
        format: 'mp3',
        sample_rate: 16000,
      };
    } else if (isSiliconFlow) {
      // SiliconFlow TTS API (OpenAI compatible)
      headers['Authorization'] = `Bearer ${apiKey}`;
      // SiliconFlow 使用 OpenAI 兼容格式
      if (!normalizedBaseUrl.includes('/audio/speech')) {
        requestUrl = `${normalizedBaseUrl}/v1/audio/speech`;
      }
      requestBody = {
        model: model || 'fishaudio/fish-speech-1.5',
        input: text,
        voice: voiceId || 'alloy',
        response_format: 'mp3',
      };
    } else if (isOpenAILike) {
      // OpenAI-compatible TTS API format
      headers['Authorization'] = `Bearer ${apiKey}`;
      // 确保 URL 包含正确的端点
      if (!normalizedBaseUrl.includes('/audio/speech')) {
        requestUrl = `${normalizedBaseUrl}/v1/audio/speech`;
      }
      requestBody = {
        model: model || 'tts-1',
        input: text,
        voice: voiceId || 'alloy',
        response_format: 'mp3',
      };
    } else {
      // Generic API format - try multiple field names for maximum compatibility
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        text,
        input: text,
        voice_id: voiceId,
        voice: voiceId,
        model: model,
        format: 'mp3',
        response_format: 'mp3',
      };
    }

    console.log('TTS Request:', {
      url: requestUrl,
      provider: isVolink ? 'Volink' : isElevenLabs ? 'ElevenLabs' : isMinimax ? 'Minimax' : 'Other',
      bodyType: typeof requestBody === 'string' ? 'string' : 'object',
      voiceId,
      model
    });

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API error:', response.status, errorText);
      
      // 解析常见错误
      let errorMessage = `TTS API error: ${response.status}`;
      if (response.status === 401) {
        errorMessage = 'TTS API key is invalid or expired';
      } else if (response.status === 402) {
        errorMessage = 'TTS API balance insufficient';
      } else if (response.status === 404) {
        errorMessage = 'Voice ID not found. Please check your voice_id setting.';
      } else if (response.status === 413) {
        errorMessage = 'Text too long for TTS API';
      } else if (response.status === 502) {
        errorMessage = 'TTS upstream provider error';
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: errorText.slice(0, 500),
          requestUrl: requestUrl.replace(apiKey, '***'),
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if response is JSON (contains base64 audio) or binary audio
    const contentType = response.headers.get('content-type') || '';
    
    console.log('TTS Response:', { contentType, status: response.status });
    
    if (contentType.includes('application/json')) {
      // Parse JSON response - might contain base64 audio
      const jsonData = await response.json();
      
      // Google TTS returns audioContent in JSON
      if (jsonData.audioContent) {
        return new Response(
          JSON.stringify({ audioContent: jsonData.audioContent }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Try various field names
      const audioContent = jsonData.audio || jsonData.audio_content || jsonData.data || jsonData.result || jsonData.audio_data;
      
      if (audioContent) {
        return new Response(
          JSON.stringify({ audioContent }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.error('No audio content in JSON response:', JSON.stringify(jsonData).slice(0, 500));
        return new Response(
          JSON.stringify({ error: 'No audio content in response', raw: jsonData }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Binary audio response (MP3) - convert to base64
      // Volink 和大多数 TTS API 都返回二进制 MP3
      const audioBuffer = await response.arrayBuffer();
      
      if (audioBuffer.byteLength === 0) {
        return new Response(
          JSON.stringify({ error: 'Empty audio response from TTS API' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('TTS audio received:', audioBuffer.byteLength, 'bytes');
      
      const audioContent = base64Encode(audioBuffer);
      
      return new Response(
        JSON.stringify({ audioContent }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: unknown) {
    console.error('TTS function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});