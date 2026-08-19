import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalTable, isLocalModeEnabled } from '@/lib/localDataStore';

export interface APIConfig {
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
  model?: string;
}

export interface TTSConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface VNConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface ImageConfig {
  enabled?: boolean;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  imageSize?: string;
  stylePrompt?: string;
}

export const useAPIConfig = () => {
  const { user } = useAuth();
  const [apiConfig, setApiConfig] = useState<APIConfig>({});
  const [ttsConfig, setTTSConfig] = useState<TTSConfig | null>(null);
  const [vnConfig, setVNConfig] = useState<VNConfig | null>(null);
  const [imageConfig, setImageConfig] = useState<ImageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAPIConfig = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const localMode = await isLocalModeEnabled(user.id);
      const result = localMode
        ? { data: await getLocalTable(user.id, 'api_keys'), error: null }
        : await supabase.from('api_keys').select('*').eq('user_id', user.id);
      const { data, error } = result;

      if (error) {
        console.error('Error fetching API config:', error);
        setApiConfig({});
        return;
      }

      if (data && data.length > 0) {
        const customKey = data.find(k => k.provider === 'custom');
        const deepseekKey = data.find(k => k.provider === 'deepseek');
        const openaiKey = data.find(k => k.provider === 'openai');
        const baseUrl = data.find(k => k.provider === 'custom_base_url');
        const model = data.find(k => k.provider === 'custom_model');

        // TTS 配置
        const ttsKey = data.find(k => k.provider === 'tts_api_key');
        const ttsBaseUrl = data.find(k => k.provider === 'tts_base_url');
        const ttsModel = data.find(k => k.provider === 'tts_model');

        if (ttsKey || ttsBaseUrl) {
          setTTSConfig({
            apiKey: ttsKey?.api_key,
            baseUrl: ttsBaseUrl?.api_key,
            model: ttsModel?.api_key,
          });
        } else {
          setTTSConfig(null);
        }

        // VN (视觉小说) 专用配置
        const vnKey = data.find(k => k.provider === 'vn_api_key');
        const vnBaseUrl = data.find(k => k.provider === 'vn_base_url');
        const vnModel = data.find(k => k.provider === 'vn_model');

        if (vnKey) {
          setVNConfig({
            apiKey: vnKey.api_key,
            baseUrl: vnBaseUrl?.api_key,
            model: vnModel?.api_key,
          });
        } else {
          setVNConfig(null);
        }

        // 图片生成配置 (统一用于聊天和空间)
        const imageEnabled = data.find(k => k.provider === 'space_image_enabled');
        const imageKey = data.find(k => k.provider === 'space_image_api_key');
        const imageUrl = data.find(k => k.provider === 'space_image_api_url');
        const imageModel = data.find(k => k.provider === 'space_image_model');
        const imageSize = data.find(k => k.provider === 'space_image_size');
        const imageStyle = data.find(k => k.provider === 'space_image_style_prompt');

        if (imageKey || imageUrl) {
          setImageConfig({
            enabled: imageEnabled?.api_key === 'true',
            apiKey: imageKey?.api_key,
            apiUrl: imageUrl?.api_key,
            model: imageModel?.api_key,
            imageSize: imageSize?.api_key,
            stylePrompt: imageStyle?.api_key,
          });
        } else {
          setImageConfig(null);
        }

        if (customKey) {
          setApiConfig({
            provider: 'custom',
            apiKey: customKey.api_key,
            baseUrl: baseUrl?.api_key,
            model: model?.api_key,
          });
        } else if (deepseekKey) {
          setApiConfig({
            provider: 'deepseek',
            apiKey: deepseekKey.api_key,
          });
        } else if (openaiKey) {
          setApiConfig({
            provider: 'openai',
            apiKey: openaiKey.api_key,
          });
        } else {
          setApiConfig({});
        }
      } else {
        setApiConfig({});
        setTTSConfig(null);
        setVNConfig(null);
        setImageConfig(null);
      }
    } catch (error) {
      console.error('Error fetching API config:', error);
      setApiConfig({});
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAPIConfig();
  }, [fetchAPIConfig]);

  const isConfigured = Boolean(apiConfig.apiKey && apiConfig.provider);

  return { apiConfig, ttsConfig, vnConfig, imageConfig, loading, isConfigured, refetch: fetchAPIConfig };
};
