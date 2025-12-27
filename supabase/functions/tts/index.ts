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
        JSON.stringify({ error: 'TTS API configuration is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { apiKey, baseUrl, model } = ttsConfig;
    
    // Build the request URL - support different API formats
    let requestUrl = baseUrl;
    let requestBody: Record<string, unknown> = {};
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Detect API type based on URL patterns
    const isOpenAILike = baseUrl.includes('openai') || baseUrl.includes('/v1/audio/speech');
    const isElevenLabs = baseUrl.includes('elevenlabs');
    const isMinimax = baseUrl.includes('minimax') || baseUrl.includes('volink');
    const isFishAudio = baseUrl.includes('fish.audio');

    if (isElevenLabs) {
      // ElevenLabs API format
      requestUrl = voiceId 
        ? `${baseUrl.replace(/\/$/, '')}/${voiceId}`
        : baseUrl;
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
    } else if (isOpenAILike) {
      // OpenAI-compatible TTS API format
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        model: model || 'tts-1',
        input: text,
        voice: voiceId || 'alloy',
        response_format: 'mp3',
      };
    } else {
      // Generic API format - try to be flexible
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        text,
        voice_id: voiceId,
        model: model,
        input: text,
        voice: voiceId,
      };
    }

    console.log('TTS Request URL:', requestUrl);
    console.log('TTS Request Body:', JSON.stringify(requestBody));

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `TTS API error: ${response.status} - ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if response is JSON (contains base64 audio) or binary audio
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      // Parse JSON response - might contain base64 audio
      const jsonData = await response.json();
      const audioContent = jsonData.audio || jsonData.audio_content || jsonData.data || jsonData.result;
      
      if (audioContent) {
        return new Response(
          JSON.stringify({ audioContent }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ error: 'No audio content in response', raw: jsonData }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Binary audio response - convert to base64
      const audioBuffer = await response.arrayBuffer();
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
