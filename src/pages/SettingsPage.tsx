import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Key, LogOut, Check, Loader2, Globe, Eye, EyeOff, TestTube, RefreshCw, Zap, Sparkles, Image as ImageIcon, Volume2, Shield, Camera, Lock, Brush, Settings, X, Copy, Trash2, Upload, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { APP_VERSION, BUILD_DATE, CHANGELOG } from '@/config/version';
import { PushNotificationCard } from '@/components/settings/PushNotificationCard';

const DEFAULT_MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek', description: '强大的通用对话模型' },
];

// NovelAI 尺寸预设
const NOVELAI_SIZES = [
  { id: 'square', name: '方图 (1024x1024)', width: 1024, height: 1024 },
  { id: 'portrait', name: '竖图 (832x1216)', width: 832, height: 1216 },
  { id: 'landscape', name: '横图 (1216x832)', width: 1216, height: 832 },
  { id: 'portrait_small', name: '竖图小 (640x1024)', width: 640, height: 1024 },
  { id: 'landscape_small', name: '横图小 (1024x640)', width: 1024, height: 640 },
];

// NovelAI 采样器
const NOVELAI_SAMPLERS = [
  'k_euler_ancestral',
  'k_euler',
  'k_dpmpp_2s_ancestral',
  'k_dpmpp_2m',
  'k_dpmpp_sde',
  'ddim_v3',
];

// NovelAI UC预设
const NOVELAI_UC_PRESETS = [
  { id: 0, name: 'Preset 1 - Light' },
  { id: 1, name: 'Preset 2 - Heavy' },
  { id: 2, name: 'Preset 3 - Human Focus' },
  { id: 3, name: 'None' },
];

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('https://api.deepseek.com/v1');
  const [customModel, setCustomModel] = useState('deepseek-chat');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [usingDefaultApi, setUsingDefaultApi] = useState(false);
  const [defaultModel, setDefaultModel] = useState('deepseek-chat');
  
  // NovelAI state
  const [novelaiEnabled, setNovelaiEnabled] = useState(true);
  const [novelaiKey, setNovelaiKey] = useState('');
  const [novelaiModel, setNovelaiModel] = useState('nai-diffusion-4-5-curated');
  const [novelaiCustomModel, setNovelaiCustomModel] = useState('');
  const [showNovelaiKey, setShowNovelaiKey] = useState(false);
  const [novelaiConfigured, setNovelaiConfigured] = useState(false);
  const [testingNovelai, setTestingNovelai] = useState(false);
  const [novelaiAutoGenerate, setNovelaiAutoGenerate] = useState(false);
  
  // NovelAI 生成设置
  const [novelaiSettingsOpen, setNovelaiSettingsOpen] = useState(false);
  const [novelaiSize, setNovelaiSize] = useState('portrait');
  const [novelaiSteps, setNovelaiSteps] = useState(28);
  const [novelaiScale, setNovelaiScale] = useState(5);
  const [novelaiSampler, setNovelaiSampler] = useState('k_euler_ancestral');
  const [novelaiSeed, setNovelaiSeed] = useState(-1);
  const [novelaiUcPreset, setNovelaiUcPreset] = useState(0);
  const [novelaiQualityTags, setNovelaiQualityTags] = useState(true);
  const [novelaiSmea, setNovelaiSmea] = useState(true);
  const [novelaiSmeaDyn, setNovelaiSmeaDyn] = useState(false);
  const [novelaiDefaultPrompt, setNovelaiDefaultPrompt] = useState('masterpiece, best quality, 1girl, beautiful, detailed face, detailed eyes, long hair, anime style');
  const [novelaiDefaultNegative, setNovelaiDefaultNegative] = useState('lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark');
  
  // NovelAI 测试生成弹窗
  const [novelaiTestOpen, setNovelaiTestOpen] = useState(false);
  const [novelaiTestPrompt, setNovelaiTestPrompt] = useState('1girl, solo, long hair, blue eyes, smile, outdoors, cherry blossoms, spring');
  const [novelaiTestNegative, setNovelaiTestNegative] = useState('');
  const [novelaiTestDrawing, setNovelaiTestDrawing] = useState(false);
  const [novelaiTestResult, setNovelaiTestResult] = useState<string | null>(null);
  
  // NovelAI 垫图(img2img)功能
  const [novelaiTestRefImage, setNovelaiTestRefImage] = useState<string | null>(null);
  const [novelaiTestRefStrength, setNovelaiTestRefStrength] = useState(0.6);
  const novelaiRefInputRef = useRef<HTMLInputElement>(null);
  
  // NovelAI 可用模型列表
  const [novelaiModels, setNovelaiModels] = useState<{ id: string; name: string; description: string }[]>([]);
  
  // TTS state
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsBaseUrl, setTtsBaseUrl] = useState('');
  const [ttsApiKey, setTtsApiKey] = useState('');
  const [ttsModel, setTtsModel] = useState('');
  const [ttsTestVoiceId, setTtsTestVoiceId] = useState('');
  const [showTtsKey, setShowTtsKey] = useState(false);
  const [ttsConfigured, setTtsConfigured] = useState(false);
  const [testingTts, setTestingTts] = useState(false);

  // VN (视觉小说) 专用 API state
  const [vnApiKey, setVnApiKey] = useState('');
  const [vnBaseUrl, setVnBaseUrl] = useState('');
  const [vnModel, setVnModel] = useState('');
  const [showVnKey, setShowVnKey] = useState(false);
  const [vnConfigured, setVnConfigured] = useState(false);
  const [testingVn, setTestingVn] = useState(false);

  // 图片生成API state (统一用于聊天和空间)
  const [spaceImageEnabled, setSpaceImageEnabled] = useState(false);
  const [spaceImageApiKey, setSpaceImageApiKey] = useState('');
  const [spaceImageApiUrl, setSpaceImageApiUrl] = useState('');
  const [spaceImageModel, setSpaceImageModel] = useState('');
  const [showSpaceImageKey, setShowSpaceImageKey] = useState(false);
  const [spaceImageConfigured, setSpaceImageConfigured] = useState(false);
  const [testingSpaceImage, setTestingSpaceImage] = useState(false);
  const [spaceImageAvailableModels, setSpaceImageAvailableModels] = useState<string[]>([]);
  const [fetchingSpaceImageModels, setFetchingSpaceImageModels] = useState(false);
  
  // 测试绘图功能 state
  const [testDrawPrompt, setTestDrawPrompt] = useState('');
  const [testDrawing, setTestDrawing] = useState(false);
  const [testDrawResult, setTestDrawResult] = useState<string | null>(null);

  // Unsplash 免费配图 state
  const [unsplashEnabled, setUnsplashEnabled] = useState(false);
  const [unsplashAccessKey, setUnsplashAccessKey] = useState('');
  const [showUnsplashKey, setShowUnsplashKey] = useState(false);
  const [unsplashConfigured, setUnsplashConfigured] = useState(false);
  const [testingUnsplash, setTestingUnsplash] = useState(false);
  const [unsplashCategory, setUnsplashCategory] = useState('auto');

  // 时间同步 state
  const [timeSyncEnabled, setTimeSyncEnabled] = useState(false);

  useEffect(() => {
    if (user) fetchApiKeys();
  }, [user]);

  const fetchApiKeys = async () => {
    const { data } = await supabase.from('api_keys').select('*').eq('user_id', user?.id);
    if (data) {
      const customKey = data.find(k => k.provider === 'custom');
      const baseUrl = data.find(k => k.provider === 'custom_base_url');
      const model = data.find(k => k.provider === 'custom_model');
      const useDefault = data.find(k => k.provider === 'use_default_api');
      const defaultModelSetting = data.find(k => k.provider === 'default_model');
      
      // NovelAI settings
      const novelaiKeySetting = data.find(k => k.provider === 'novelai');
      const novelaiModelSetting = data.find(k => k.provider === 'novelai_model');
      const novelaiAutoSetting = data.find(k => k.provider === 'novelai_auto_generate');
      
      // 总是加载保存的自定义API配置
      if (customKey) {
        setApiKey(customKey.api_key);
      }
      if (baseUrl) {
        setCustomBaseUrl(baseUrl.api_key);
      }
      if (model) {
        setCustomModel(model.api_key);
      }
      if (defaultModelSetting) {
        setDefaultModel(defaultModelSetting.api_key);
      }
      
      // NovelAI config
      const novelaiEnabledSetting = data.find(k => k.provider === 'novelai_enabled');
      if (novelaiEnabledSetting) {
        setNovelaiEnabled(novelaiEnabledSetting.api_key !== 'false');
      }
      if (novelaiKeySetting) {
        setNovelaiKey(novelaiKeySetting.api_key);
        setNovelaiConfigured(true);
      }
      if (novelaiModelSetting) {
        // 直接使用保存的模型或默认V4 Full
        setNovelaiModel(novelaiModelSetting.api_key || 'nai-diffusion-4-full');
      }
      if (novelaiAutoSetting) {
        setNovelaiAutoGenerate(novelaiAutoSetting.api_key === 'true');
      }
      
      // NovelAI 高级设置
      const novelaiSizeSetting = data.find(k => k.provider === 'novelai_size');
      const novelaiStepsSetting = data.find(k => k.provider === 'novelai_steps');
      const novelaiScaleSetting = data.find(k => k.provider === 'novelai_scale');
      const novelaiSamplerSetting = data.find(k => k.provider === 'novelai_sampler');
      const novelaiSeedSetting = data.find(k => k.provider === 'novelai_seed');
      const novelaiUcPresetSetting = data.find(k => k.provider === 'novelai_uc_preset');
      const novelaiQualityTagsSetting = data.find(k => k.provider === 'novelai_quality_tags');
      const novelaiSmeaSetting = data.find(k => k.provider === 'novelai_smea');
      const novelaiSmeaDynSetting = data.find(k => k.provider === 'novelai_smea_dyn');
      const novelaiDefaultPromptSetting = data.find(k => k.provider === 'novelai_default_prompt');
      const novelaiDefaultNegativeSetting = data.find(k => k.provider === 'novelai_default_negative');
      
      if (novelaiSizeSetting) setNovelaiSize(novelaiSizeSetting.api_key);
      if (novelaiStepsSetting) setNovelaiSteps(parseInt(novelaiStepsSetting.api_key) || 28);
      if (novelaiScaleSetting) setNovelaiScale(parseFloat(novelaiScaleSetting.api_key) || 5);
      if (novelaiSamplerSetting) setNovelaiSampler(novelaiSamplerSetting.api_key);
      if (novelaiSeedSetting) setNovelaiSeed(parseInt(novelaiSeedSetting.api_key) || -1);
      if (novelaiUcPresetSetting) setNovelaiUcPreset(parseInt(novelaiUcPresetSetting.api_key) || 0);
      if (novelaiQualityTagsSetting) setNovelaiQualityTags(novelaiQualityTagsSetting.api_key !== 'false');
      if (novelaiSmeaSetting) setNovelaiSmea(novelaiSmeaSetting.api_key !== 'false');
      if (novelaiSmeaDynSetting) setNovelaiSmeaDyn(novelaiSmeaDynSetting.api_key === 'true');
      if (novelaiDefaultPromptSetting) setNovelaiDefaultPrompt(novelaiDefaultPromptSetting.api_key);
      if (novelaiDefaultNegativeSetting) setNovelaiDefaultNegative(novelaiDefaultNegativeSetting.api_key);
      
      // TTS settings
      const ttsEnabledSetting = data.find(k => k.provider === 'tts_enabled');
      const ttsBaseUrlSetting = data.find(k => k.provider === 'tts_base_url');
      const ttsApiKeySetting = data.find(k => k.provider === 'tts_api_key');
      const ttsModelSetting = data.find(k => k.provider === 'tts_model');
      
      if (ttsEnabledSetting) setTtsEnabled(ttsEnabledSetting.api_key !== 'false');
      if (ttsBaseUrlSetting) {
        setTtsBaseUrl(ttsBaseUrlSetting.api_key);
        setTtsConfigured(true);
      }
      if (ttsApiKeySetting) setTtsApiKey(ttsApiKeySetting.api_key);
      if (ttsModelSetting) setTtsModel(ttsModelSetting.api_key);
      
      // VN (视觉小说) 专用 API 配置
      const vnApiKeySetting = data.find(k => k.provider === 'vn_api_key');
      const vnBaseUrlSetting = data.find(k => k.provider === 'vn_base_url');
      const vnModelSetting = data.find(k => k.provider === 'vn_model');
      
      if (vnApiKeySetting) {
        setVnApiKey(vnApiKeySetting.api_key);
        setVnConfigured(true);
      }
      if (vnBaseUrlSetting) setVnBaseUrl(vnBaseUrlSetting.api_key);
      if (vnModelSetting) setVnModel(vnModelSetting.api_key);
      
      // 空间图片生成API配置
      const spaceImageEnabledSetting = data.find(k => k.provider === 'space_image_enabled');
      const spaceImageApiKeySetting = data.find(k => k.provider === 'space_image_api_key');
      const spaceImageApiUrlSetting = data.find(k => k.provider === 'space_image_api_url');
      const spaceImageModelSetting = data.find(k => k.provider === 'space_image_model');
      
      if (spaceImageEnabledSetting) setSpaceImageEnabled(spaceImageEnabledSetting.api_key === 'true');
      if (spaceImageApiKeySetting) {
        setSpaceImageApiKey(spaceImageApiKeySetting.api_key);
        setSpaceImageConfigured(true);
      }
      if (spaceImageApiUrlSetting) setSpaceImageApiUrl(spaceImageApiUrlSetting.api_key);
      if (spaceImageModelSetting) setSpaceImageModel(spaceImageModelSetting.api_key);
      
      // Unsplash 免费配图配置
      const unsplashEnabledSetting = data.find(k => k.provider === 'unsplash_enabled');
      const unsplashAccessKeySetting = data.find(k => k.provider === 'unsplash_access_key');
      const unsplashCategorySetting = data.find(k => k.provider === 'unsplash_category');
      
      if (unsplashEnabledSetting) setUnsplashEnabled(unsplashEnabledSetting.api_key === 'true');
      if (unsplashAccessKeySetting) {
        setUnsplashAccessKey(unsplashAccessKeySetting.api_key);
        setUnsplashConfigured(true);
      }
      if (unsplashCategorySetting) setUnsplashCategory(unsplashCategorySetting.api_key);
      
      // 时间同步设置
      const timeSyncSetting = data.find(k => k.provider === 'time_sync_enabled');
      if (timeSyncSetting) setTimeSyncEnabled(timeSyncSetting.api_key === 'true');
      
      // 判断当前使用哪种API
      if (useDefault && useDefault.api_key === 'true') {
        setUsingDefaultApi(true);
        setIsConfigured(true);
      } else if (customKey) {
        setUsingDefaultApi(false);
        setIsConfigured(true);
      }
    }
  };

  const fetchModels = async () => {
    if (!apiKey || !customBaseUrl) {
      toast.error('请先输入API密钥和Base URL');
      return;
    }

    setFetchingModels(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-models', {
        body: {
          apiKey: apiKey,
          baseUrl: customBaseUrl,
        },
      });

      if (error) {
        toast.error(`获取模型失败: ${error.message}`);
        return;
      }

      if (data.success && data.models) {
        setAvailableModels(data.models);
        setShowModelDropdown(true);
        toast.success(`获取到 ${data.models.length} 个模型`);
      } else {
        toast.error(data.error || '获取模型失败');
      }
    } catch (error) {
      toast.error('获取模型列表失败');
    } finally {
      setFetchingModels(false);
    }
  };

  const saveSettings = async () => {
    if (!user || !apiKey.trim()) {
      toast.error('请输入API密钥');
      return;
    }

    // Clear default API flag when saving custom
    await supabase.from('api_keys').delete().eq('user_id', user.id).eq('provider', 'use_default_api');

    // Save API key
    const { data: existing } = await supabase
      .from('api_keys')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'custom')
      .single();
    
    if (existing) {
      await supabase.from('api_keys').update({ api_key: apiKey }).eq('id', existing.id);
    } else {
      await supabase.from('api_keys').insert({ user_id: user.id, provider: 'custom', api_key: apiKey });
    }

    // Save base URL
    const { data: existingUrl } = await supabase
      .from('api_keys')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'custom_base_url')
      .single();
    
    if (existingUrl) {
      await supabase.from('api_keys').update({ api_key: customBaseUrl }).eq('id', existingUrl.id);
    } else {
      await supabase.from('api_keys').insert({ user_id: user.id, provider: 'custom_base_url', api_key: customBaseUrl });
    }

    // Save model
    const { data: existingModel } = await supabase
      .from('api_keys')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'custom_model')
      .single();
    
    if (existingModel) {
      await supabase.from('api_keys').update({ api_key: customModel }).eq('id', existingModel.id);
    } else {
      await supabase.from('api_keys').insert({ user_id: user.id, provider: 'custom_model', api_key: customModel });
    }

    setUsingDefaultApi(false);
    setIsConfigured(true);
    toast.success('API配置已保存');
  };

  const testConnection = async () => {
    if (!apiKey) {
      toast.error('请先输入API密钥');
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-api-connection', {
        body: {
          provider: 'custom',
          apiKey: apiKey,
          baseUrl: customBaseUrl,
          model: customModel,
        },
      });

      if (error) {
        toast.error(`连接失败: ${error.message}`);
        return;
      }

      if (data.success) {
        toast.success('API连接成功！');
      } else {
        toast.error(`连接失败: ${data.error}`);
      }
    } catch (error) {
      toast.error('连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const selectModel = (model: string) => {
    setCustomModel(model);
    setShowModelDropdown(false);
  };

  const useDefaultApiHandler = async () => {
    if (!user) return;
    
    // Save the use_default_api flag
    const { data: existing } = await supabase
      .from('api_keys')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'use_default_api')
      .single();
    
    if (existing) {
      await supabase.from('api_keys').update({ api_key: 'true' }).eq('id', existing.id);
    } else {
      await supabase.from('api_keys').insert({ user_id: user.id, provider: 'use_default_api', api_key: 'true' });
    }
    
    // Clear custom API settings
    await supabase.from('api_keys').delete().eq('user_id', user.id).eq('provider', 'custom');
    
    setUsingDefaultApi(true);
    setApiKey('');
    setIsConfigured(true);
    toast.success('已切换到默认API');
  };

  const saveDefaultModel = async (modelId: string) => {
    if (!user) return;
    
    setDefaultModel(modelId);
    
    const { data: existing } = await supabase
      .from('api_keys')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'default_model')
      .single();
    
    if (existing) {
      await supabase.from('api_keys').update({ api_key: modelId }).eq('id', existing.id);
    } else {
      await supabase.from('api_keys').insert({ user_id: user.id, provider: 'default_model', api_key: modelId });
    }
    
    const modelName = DEFAULT_MODELS.find(m => m.id === modelId)?.name || modelId;
    toast.success(`已切换到 ${modelName}`);
  };

  // NovelAI functions
  const saveNovelaiSettings = async () => {
    if (!user) {
      toast.error('请先登录');
      return;
    }
    
    if (!novelaiKey.trim()) {
      toast.error('请输入NovelAI API密钥');
      return;
    }

    // 验证Token格式
    const trimmedKey = novelaiKey.trim();
    if (!trimmedKey.startsWith('pst-')) {
      toast.error('NovelAI Token格式不正确，应以 pst- 开头');
      return;
    }
    
    if (trimmedKey.length < 50) {
      toast.error('NovelAI Token长度不足，请确认复制完整');
      return;
    }

    const modelToSave = novelaiModel || 'nai-diffusion-4-5-curated';

    const providersToReplace = [
      'novelai',
      'novelai_enabled',
      'novelai_model',
      'novelai_auto_generate',
    ];

    console.log('Saving NovelAI settings for user:', user.id, 'key length:', trimmedKey.length);

    const { error: delErr } = await supabase
      .from('api_keys')
      .delete()
      .eq('user_id', user.id)
      .in('provider', providersToReplace);

    if (delErr) {
      console.error('Delete error:', delErr);
      toast.error('删除旧配置失败: ' + delErr.message);
      return;
    }

    const rows: Array<{ user_id: string; provider: string; api_key: string }> = [
      { user_id: user.id, provider: 'novelai', api_key: trimmedKey },
      { user_id: user.id, provider: 'novelai_enabled', api_key: novelaiEnabled ? 'true' : 'false' },
      { user_id: user.id, provider: 'novelai_model', api_key: modelToSave },
      { user_id: user.id, provider: 'novelai_auto_generate', api_key: novelaiAutoGenerate ? 'true' : 'false' },
    ];

    const { data: insData, error: insErr } = await supabase.from('api_keys').insert(rows).select();
    
    if (insErr) {
      console.error('Insert error:', insErr);
      toast.error('保存失败: ' + insErr.message);
      return;
    }

    console.log('NovelAI settings saved successfully:', insData?.length, 'rows');
    setNovelaiConfigured(true);
    toast.success('NovelAI配置已保存');
  };

  // NovelAI 生成设置保存
  const saveNovelaiGenSettings = async () => {
    if (!user) return;

    const settingsToSave = [
      { provider: 'novelai_size', value: novelaiSize },
      { provider: 'novelai_steps', value: String(novelaiSteps) },
      { provider: 'novelai_scale', value: String(novelaiScale) },
      { provider: 'novelai_sampler', value: novelaiSampler },
      { provider: 'novelai_seed', value: String(novelaiSeed) },
      { provider: 'novelai_uc_preset', value: String(novelaiUcPreset) },
      { provider: 'novelai_quality_tags', value: novelaiQualityTags ? 'true' : 'false' },
      { provider: 'novelai_smea', value: novelaiSmea ? 'true' : 'false' },
      { provider: 'novelai_smea_dyn', value: novelaiSmeaDyn ? 'true' : 'false' },
      { provider: 'novelai_default_prompt', value: novelaiDefaultPrompt },
      { provider: 'novelai_default_negative', value: novelaiDefaultNegative },
    ];

    const providers = settingsToSave.map(s => s.provider);
    await supabase.from('api_keys').delete().eq('user_id', user.id).in('provider', providers);

    const rows = settingsToSave.map(s => ({
      user_id: user.id,
      provider: s.provider,
      api_key: s.value,
    }));

    const { error } = await supabase.from('api_keys').insert(rows);
    if (error) {
      toast.error('保存失败: ' + error.message);
      return;
    }

    setNovelaiSettingsOpen(false);
    toast.success('生成设置已保存');
  };

  // NovelAI 恢复默认设置
  const resetNovelaiGenSettings = () => {
    setNovelaiSize('portrait');
    setNovelaiSteps(28);
    setNovelaiScale(5);
    setNovelaiSampler('k_euler_ancestral');
    setNovelaiSeed(-1);
    setNovelaiUcPreset(0);
    setNovelaiQualityTags(true);
    setNovelaiSmea(true);
    setNovelaiSmeaDyn(false);
    setNovelaiDefaultPrompt('masterpiece, best quality, 1girl, beautiful, detailed face, detailed eyes, long hair, anime style');
    setNovelaiDefaultNegative('lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark');
    toast.success('已恢复默认设置');
  };

  const testNovelaiConnection = async () => {
    if (!novelaiKey) {
      toast.error('请先输入NovelAI API密钥');
      return;
    }

    setTestingNovelai(true);
    try {
      const { data, error } = await supabase.functions.invoke('novelai-models', {
        body: { apiKey: novelaiKey },
      });

      if (error) {
        toast.error(`连接失败: ${error.message}`);
        return;
      }

      if (data.success) {
        toast.success(`NovelAI连接成功！订阅等级: ${data.subscription || 'Unknown'}`);
      } else {
        toast.error(`连接失败: ${data.error}`);
      }
    } catch (error) {
      toast.error('连接测试失败');
    } finally {
      setTestingNovelai(false);
    }
  };
  
  // NovelAI 测试画图函数
  const testNovelaiDraw = async () => {
    if (!novelaiKey || !novelaiTestPrompt.trim()) {
      toast.error('请先输入API密钥和提示词');
      return;
    }
    
    setNovelaiTestDrawing(true);
    setNovelaiTestResult(null);
    
    // 获取尺寸
    const sizeConfig = NOVELAI_SIZES.find(s => s.id === novelaiSize) || NOVELAI_SIZES[1];
    
    try {
      const { data, error } = await supabase.functions.invoke('novelai-generate', {
        body: { 
          prompt: novelaiTestPrompt.trim(),
          negativePrompt: novelaiTestNegative.trim() || novelaiDefaultNegative,
          userId: user?.id,
          width: sizeConfig.width,
          height: sizeConfig.height,
          steps: novelaiSteps,
          scale: novelaiScale,
          sampler: novelaiSampler,
          seed: novelaiSeed,
          ucPreset: novelaiUcPreset,
          qualityTags: novelaiQualityTags,
          smea: novelaiSmea,
          smeaDyn: novelaiSmeaDyn,
          // 垫图功能
          referenceImage: novelaiTestRefImage,
          referenceStrength: novelaiTestRefStrength,
        },
      });
      
      if (error) {
        // 尝试提取后端返回的具体错误信息
        let detail = error.message;
        try {
          const resp = (error as any)?.context?.response as Response | undefined;
          if (resp) {
            const body = await resp.clone().json();
            if (body?.error) detail = body.error;
          }
        } catch {
          // ignore
        }
        toast.error(`画图失败: ${detail}`);
        return;
      }
      
      if (data.success && data.imageUrl) {
        setNovelaiTestResult(data.imageUrl);
        toast.success('NovelAI画图成功！');
      } else {
        toast.error(`画图失败: ${data.error || '未知错误'}`);
      }
    } catch (error) {
      toast.error('画图测试失败');
      console.error('NovelAI test draw error:', error);
    } finally {
      setNovelaiTestDrawing(false);
    }
  };
  
  // NovelAI 垫图上传处理
  const handleNovelaiRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setNovelaiTestRefImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  // 清除NovelAI数据确认弹窗状态
  const [clearNovelaiConfirmOpen, setClearNovelaiConfirmOpen] = useState(false);
  const [clearingNovelai, setClearingNovelai] = useState(false);

  // 清除所有NovelAI数据
  const clearAllNovelaiData = async () => {
    if (!user) return;
    
    setClearingNovelai(true);
    try {
      // 所有NovelAI相关的provider前缀
      const novelaiProviders = [
        'novelai',
        'novelai_enabled',
        'novelai_model',
        'novelai_auto_generate',
        'novelai_size',
        'novelai_steps',
        'novelai_scale',
        'novelai_sampler',
        'novelai_seed',
        'novelai_uc_preset',
        'novelai_quality_tags',
        'novelai_smea',
        'novelai_smea_dyn',
        'novelai_default_prompt',
        'novelai_default_negative',
        // 旧版本/残留配置（垫图/风格迁移/其他参数）
        'novelai_width',
        'novelai_height',
        'novelai_negative_prompt',
        'novelai_nsfw',
        'novelai_reference_image',
        'novelai_reference_strength',
        'novelai_vibe_transfer',
        'novelai_vibe_image',
        'novelai_vibe_strength',
      ];
      
      // 删除所有NovelAI配置
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('user_id', user.id)
        .in('provider', novelaiProviders);
      
      if (error) {
        toast.error('清除失败: ' + error.message);
        return;
      }
      
      // 同时删除所有角色专属的NAI提示词
      const { error: charError } = await supabase
        .from('api_keys')
        .delete()
        .eq('user_id', user.id)
        .or('provider.like.nai_positive_%,provider.like.nai_negative_%');
      
      if (charError) {
        console.error('清除角色NAI提示词失败:', charError);
      }
      
      // 重置本地状态
      setNovelaiKey('');
      setNovelaiModel('nai-diffusion-4-5-curated');
      setNovelaiAutoGenerate(false);
      setNovelaiEnabled(true);
      setNovelaiConfigured(false);
      setNovelaiSize('portrait');
      setNovelaiSteps(28);
      setNovelaiScale(5);
      setNovelaiSampler('k_euler_ancestral');
      setNovelaiSeed(-1);
      setNovelaiUcPreset(0);
      setNovelaiQualityTags(true);
      setNovelaiSmea(true);
      setNovelaiSmeaDyn(false);
      setNovelaiDefaultPrompt('masterpiece, best quality, 1girl, beautiful, detailed face, detailed eyes, long hair, anime style');
      setNovelaiDefaultNegative('lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark');
      
      setClearNovelaiConfirmOpen(false);
      toast.success('NovelAI数据已清除');
    } catch (error) {
      toast.error('清除失败');
      console.error('Clear NovelAI data error:', error);
    } finally {
      setClearingNovelai(false);
    }
  };

  // 复制提示词
  const copyPromptToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('已复制到剪贴板');
    }).catch(() => {
      toast.error('复制失败');
    });
  };

  const useCustomApiHandler = () => {
    setUsingDefaultApi(false);
  };

  // TTS functions
  const saveTtsSettings = async () => {
    if (!user || !ttsBaseUrl.trim() || !ttsApiKey.trim()) {
      toast.error('请填写TTS API配置');
      return;
    }

    const providersToReplace = ['tts_enabled', 'tts_base_url', 'tts_api_key', 'tts_model'];
    
    await supabase.from('api_keys').delete().eq('user_id', user.id).in('provider', providersToReplace);
    
    const rows = [
      { user_id: user.id, provider: 'tts_enabled', api_key: ttsEnabled ? 'true' : 'false' },
      { user_id: user.id, provider: 'tts_base_url', api_key: ttsBaseUrl.trim() },
      { user_id: user.id, provider: 'tts_api_key', api_key: ttsApiKey.trim() },
    ];
    
    if (ttsModel.trim()) {
      rows.push({ user_id: user.id, provider: 'tts_model', api_key: ttsModel.trim() });
    }
    
    const { error } = await supabase.from('api_keys').insert(rows);
    if (error) {
      toast.error('保存失败: ' + error.message);
      return;
    }
    
    setTtsConfigured(true);
    toast.success('TTS配置已保存');
  };

  const testTtsConnection = async () => {
    if (!ttsBaseUrl || !ttsApiKey) {
      toast.error('请先填写TTS配置');
      return;
    }

    // 检查是否是 Volink API，需要提供 voiceId
    const isVolink = ttsBaseUrl.includes('volink');
    if (isVolink && !ttsTestVoiceId.trim()) {
      toast.error('Volink API 需要填写测试语音ID');
      return;
    }

    setTestingTts(true);
    try {
      const { data, error } = await supabase.functions.invoke('tts', {
        body: {
          text: '你好，这是语音测试。',
          voiceId: ttsTestVoiceId.trim() || 'alloy',
          ttsConfig: {
            apiKey: ttsApiKey,
            baseUrl: ttsBaseUrl,
            model: ttsModel,
          },
        },
      });

      if (error) {
        toast.error(`连接失败: ${error.message}`);
        return;
      }

      if (data.audioContent) {
        // Play the test audio
        const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        const audio = new Audio(audioUrl);
        audio.play();
        toast.success('TTS连接成功！正在播放测试语音...');
      } else if (data.error) {
        toast.error(`TTS错误: ${data.error}${data.details ? `\n${data.details}` : ''}`);
      } else {
        toast.error('未收到音频数据');
      }
    } catch (error) {
      toast.error('连接测试失败');
    } finally {
      setTestingTts(false);
    }
  };

  // 空间图片生成API函数
  const saveSpaceImageSettings = async () => {
    if (!user || !spaceImageApiKey.trim() || !spaceImageApiUrl.trim()) {
      toast.error('请填写空间图片API配置');
      return;
    }

    const providersToReplace = ['space_image_enabled', 'space_image_api_key', 'space_image_api_url', 'space_image_model'];
    
    await supabase.from('api_keys').delete().eq('user_id', user.id).in('provider', providersToReplace);
    
    const rows = [
      { user_id: user.id, provider: 'space_image_enabled', api_key: spaceImageEnabled ? 'true' : 'false' },
      { user_id: user.id, provider: 'space_image_api_key', api_key: spaceImageApiKey.trim() },
      { user_id: user.id, provider: 'space_image_api_url', api_key: spaceImageApiUrl.trim() },
    ];
    
    if (spaceImageModel.trim()) {
      rows.push({ user_id: user.id, provider: 'space_image_model', api_key: spaceImageModel.trim() });
    }
    
    const { error } = await supabase.from('api_keys').insert(rows);
    if (error) {
      toast.error('保存失败: ' + error.message);
      return;
    }
    
    setSpaceImageConfigured(true);
    toast.success('空间图片API配置已保存');
  };

  const testSpaceImageApi = async () => {
    if (!spaceImageApiKey || !spaceImageApiUrl) {
      toast.error('请先填写配置');
      return;
    }

    setTestingSpaceImage(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: '一只可爱的猫咪',
          testMode: true,
          apiKey: spaceImageApiKey,
          apiUrl: spaceImageApiUrl,
          model: spaceImageModel,
        },
      });

      if (error) {
        toast.error('连接测试失败: ' + error.message);
        return;
      }

      if (data.success && data.imageUrl) {
        toast.success('图片API连接成功！');
      } else {
        toast.error(data.error || 'API响应异常');
      }
    } catch (error) {
      toast.error('连接测试失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setTestingSpaceImage(false);
    }
  };

  // 测试绘图功能 - 输入提示词生成图片
  const testDrawImage = async () => {
    if (!spaceImageApiKey || !spaceImageApiUrl) {
      toast.error('请先填写并保存API配置');
      return;
    }
    if (!testDrawPrompt.trim()) {
      toast.error('请输入绘图提示词');
      return;
    }

    setTestDrawing(true);
    setTestDrawResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: testDrawPrompt.trim(),
          testMode: true,
          apiKey: spaceImageApiKey,
          apiUrl: spaceImageApiUrl,
          model: spaceImageModel,
        },
      });

      if (error) {
        toast.error('绘图失败: ' + error.message);
        return;
      }

      if (data.success && data.imageUrl) {
        setTestDrawResult(data.imageUrl);
        toast.success('绘图成功！');
      } else {
        toast.error(data.error || '绘图失败');
      }
    } catch (error) {
      toast.error('绘图失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setTestDrawing(false);
    }
  };

  // 获取图片API可用模型
  const fetchSpaceImageModels = async () => {
    if (!spaceImageApiKey || !spaceImageApiUrl) {
      toast.error('请先填写API Key和URL');
      return;
    }

    setFetchingSpaceImageModels(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-models', {
        body: {
          apiKey: spaceImageApiKey,
          baseUrl: spaceImageApiUrl,
        },
      });

      if (error) {
        toast.error(`获取模型失败: ${error.message}`);
        return;
      }

      if (data.success && data.models) {
        setSpaceImageAvailableModels(data.models);
        toast.success(`获取到 ${data.models.length} 个模型`);
      } else {
        toast.error(data.error || '获取模型失败');
      }
    } catch (error) {
      toast.error('获取模型列表失败');
    } finally {
      setFetchingSpaceImageModels(false);
    }
  };

  // ----- Unsplash 免费配图 测试 & 保存 -----
  const saveUnsplashSettings = async () => {
    if (!user || !unsplashAccessKey.trim()) {
      toast.error('请输入 Unsplash Access Key');
      return;
    }

    const providersToReplace = ['unsplash_enabled', 'unsplash_access_key', 'unsplash_category'];
    
    await supabase.from('api_keys').delete().eq('user_id', user.id).in('provider', providersToReplace);
    
    const rows = [
      { user_id: user.id, provider: 'unsplash_enabled', api_key: unsplashEnabled ? 'true' : 'false' },
      { user_id: user.id, provider: 'unsplash_access_key', api_key: unsplashAccessKey.trim() },
      { user_id: user.id, provider: 'unsplash_category', api_key: unsplashCategory },
    ];
    
    const { error } = await supabase.from('api_keys').insert(rows);
    if (error) {
      toast.error('保存失败: ' + error.message);
      return;
    }
    
    setUnsplashConfigured(true);
    toast.success('Unsplash 配置已保存');
  };

  const testUnsplashApi = async () => {
    if (!unsplashAccessKey) {
      toast.error('请先填写 Access Key');
      return;
    }

    setTestingUnsplash(true);
    try {
      // 通过 Edge Function 测试，避免 CORS 问题
      const { data, error } = await supabase.functions.invoke('test-unsplash', {
        body: { accessKey: unsplashAccessKey }
      });

      if (error) {
        toast.error('连接测试失败: ' + error.message);
        return;
      }

      if (data.success) {
        toast.success(data.message || 'Unsplash 连接成功！');
      } else {
        toast.error(data.error || '连接测试失败');
      }
    } catch (error) {
      toast.error('连接测试失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setTestingUnsplash(false);
    }
  };

  // ----- VN (视觉小说) 专用 API 测试 & 保存 -----
  const saveVnSettings = async () => {
    if (!user || !vnApiKey.trim() || !vnBaseUrl.trim()) {
      toast.error('请输入 API 密钥和 Base URL');
      return;
    }

    const keysToUpsert = [
      { provider: 'vn_api_key', value: vnApiKey },
      { provider: 'vn_base_url', value: vnBaseUrl },
      { provider: 'vn_model', value: vnModel || '' },
    ];

    for (const item of keysToUpsert) {
      const { data: existing } = await supabase
        .from('api_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', item.provider)
        .maybeSingle();

      if (existing) {
        await supabase.from('api_keys').update({ api_key: item.value }).eq('id', existing.id);
      } else {
        await supabase.from('api_keys').insert({ user_id: user.id, provider: item.provider, api_key: item.value });
      }
    }

    setVnConfigured(true);
    toast.success('视觉小说 API 配置已保存');
  };

  const testVnConnection = async () => {
    if (!vnApiKey || !vnBaseUrl) {
      toast.error('请先输入 API 密钥和 Base URL');
      return;
    }

    setTestingVn(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-api-connection', {
        body: { apiKey: vnApiKey, baseUrl: vnBaseUrl, model: vnModel || undefined },
      });

      if (error) {
        toast.error(`测试失败: ${error.message}`);
      } else if (data?.success) {
        toast.success('视觉小说 API 连接成功！');
      } else {
        toast.error(data?.error || '连接失败');
      }
    } catch (e) {
      toast.error('测试失败');
    } finally {
      setTestingVn(false);
    }
  };

  return (
    <div className="min-h-screen bg-background/70 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/home')}
          className="rounded-full"
        >
          <ChevronLeft className="w-6 h-6 text-purple-600" />
        </Button>
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-purple-500" />
          <h1 className="text-lg font-bold text-purple-700">API密钥管理</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Main API Card */}
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-purple-100/50">
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                <span className="text-lg">🔗</span>
              </div>
              <div>
                <h2 className="font-bold text-gray-800">自定义对话API</h2>
                <p className="text-xs text-gray-500">
                  支持 OpenAI、Claude、智谱、Deepseek 等兼容 OpenAI 格式的 API
                </p>
              </div>
            </div>
            {isConfigured && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium">
                <Check className="w-3.5 h-3.5" /> 已配置
              </span>
            )}
          </div>

          {/* Time Sync Toggle */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50/80 to-cyan-50/80 rounded-2xl mb-4">
            <div>
              <p className="font-medium text-gray-800 flex items-center gap-2">
                🕐 时间同步
              </p>
              <p className="text-xs text-gray-500">让AI知道当前时间、星期、节日等</p>
            </div>
            <button
              onClick={async () => {
                const newVal = !timeSyncEnabled;
                setTimeSyncEnabled(newVal);
                if (user) {
                  await supabase.from('api_keys').delete().eq('user_id', user.id).eq('provider', 'time_sync_enabled');
                  await supabase.from('api_keys').insert({ user_id: user.id, provider: 'time_sync_enabled', api_key: newVal ? 'true' : 'false' });
                  toast.success(newVal ? '时间同步已开启' : '时间同步已关闭');
                }
              }}
              className={`w-14 h-8 rounded-full transition-all ${
                timeSyncEnabled ? 'bg-blue-400' : 'bg-gray-300'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                timeSyncEnabled ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Default API Button */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={useDefaultApiHandler}
              className={`flex-1 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all ${
                usingDefaultApi 
                  ? 'bg-gradient-to-r from-green-400 to-emerald-400 text-white shadow-lg' 
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Zap className="w-4 h-4" />
              使用默认API
            </button>
            <button
              onClick={useCustomApiHandler}
              className={`flex-1 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all ${
                !usingDefaultApi 
                  ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white shadow-lg' 
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Key className="w-4 h-4" />
              自定义API
            </button>
          </div>

          {usingDefaultApi ? (
            <div className="space-y-4">
              <div className="bg-green-50 rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                  <Check className="w-5 h-5" />
                  正在使用默认API
                </div>
                <p className="text-sm text-green-500 mt-1">请选择要使用的模型</p>
              </div>
              
              {/* Default Model Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-purple-600 block">选择模型</label>
                <div className="grid grid-cols-2 gap-3">
                  {DEFAULT_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => saveDefaultModel(model.id)}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        defaultModel === model.id
                          ? 'border-purple-400 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-purple-200'
                      }`}
                    >
                      <div className="font-medium text-gray-800">{model.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{model.description}</div>
                      {defaultModel === model.id && (
                        <div className="flex items-center gap-1 text-xs text-purple-600 mt-2">
                          <Check className="w-3 h-3" /> 当前使用
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Base URL */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-purple-600 mb-2">
                  <Globe className="w-4 h-4" />
                  Base URL
                </label>
                <Input
                  placeholder="https://api.deepseek.com/v1"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  填写API地址，系统会自动补全路径。例如：https://api.example.com/v1
                </p>
              </div>

              {/* API Key */}
              <div>
                <label className="text-sm font-medium text-purple-600 mb-2 block">
                  API Key
                </label>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="rounded-2xl bg-white border-gray-200 h-12 pr-12 text-gray-700 placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  从API提供商获取的密钥，通常以 sk- 开头
                </p>
              </div>

              {/* Model Name with Fetch Button */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-purple-600">
                    Model Name
                  </label>
                  <button
                    onClick={fetchModels}
                    disabled={fetchingModels || !apiKey || !customBaseUrl}
                    className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {fetchingModels ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    自动获取模型
                  </button>
                </div>
                
                {availableModels.length > 0 ? (
                  <select
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="w-full h-12 px-4 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                    style={{ 
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '20px'
                    }}
                  >
                    {availableModels.map((model, index) => (
                      <option key={index} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    placeholder="deepseek-chat"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
                  />
                )}
                
                {availableModels.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    已获取 {availableModels.length} 个可用模型
                  </p>
                )}
              </div>

              {/* Test Button */}
              <button
                onClick={testConnection}
                disabled={testing || !apiKey}
                className="w-full py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4 text-green-500" />
                )}
                测试API连接
              </button>

              {/* Save Button */}
              <Button
                onClick={saveSettings}
                disabled={!apiKey}
                className="w-full py-6 rounded-2xl bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium shadow-lg hover:shadow-xl transition-all"
              >
                保存配置
              </Button>
            </div>
          )}
        </div>

        {/* NovelAI Configuration Card */}
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-pink-100/50">
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">NovelAI 画图</h2>
                <p className="text-xs text-gray-500">
                  配置NovelAI实现角色AI画图功能
                </p>
              </div>
            </div>
            {novelaiConfigured && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium">
                <Check className="w-3.5 h-3.5" /> 已配置
              </span>
            )}
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-50/80 to-purple-50/80 rounded-2xl mb-4">
            <div>
              <p className="font-medium text-gray-800">启用画图功能</p>
              <p className="text-xs text-gray-500">关闭后将不会生成任何图片</p>
            </div>
            <button
              onClick={async () => {
                const newVal = !novelaiEnabled;
                setNovelaiEnabled(newVal);
                // 立即保存开关状态到数据库，即使还没配置 API Key
                if (user) {
                  await supabase.from('api_keys').delete().eq('user_id', user.id).eq('provider', 'novelai_enabled');
                  await supabase.from('api_keys').insert({ user_id: user.id, provider: 'novelai_enabled', api_key: newVal ? 'true' : 'false' });
                }
              }}
              className={`w-14 h-8 rounded-full transition-all ${
                novelaiEnabled ? 'bg-pink-400' : 'bg-gray-300'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                novelaiEnabled ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className={`space-y-4 ${!novelaiEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* NovelAI API Key */}
            <div>
              <label className="text-sm font-medium text-pink-600 mb-2 block">
                NovelAI API Token
              </label>
              <div className="relative">
                <Input
                  type={showNovelaiKey ? 'text' : 'password'}
                  placeholder="pst-..."
                  value={novelaiKey}
                  onChange={(e) => setNovelaiKey(e.target.value)}
                  className="rounded-2xl bg-white border-gray-200 h-12 pr-12 text-gray-700 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowNovelaiKey(!showNovelaiKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNovelaiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                在NovelAI账户设置中获取API Token
              </p>
            </div>

            {/* Model Selection - 支持 V4.5 最新模型 */}
            <div>
              <label className="text-sm font-medium text-pink-600 mb-2 block">
                模型选择
              </label>
              <select
                value={novelaiModel}
                onChange={(e) => setNovelaiModel(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-300"
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '20px'
                }}
              >
                <optgroup label="NEW - V4.5 最新">
                  <option value="nai-diffusion-4-5-curated">V4.5 Curated (推荐)</option>
                  <option value="nai-diffusion-4-5-full">V4.5 Full (最强)</option>
                </optgroup>
                <optgroup label="V4">
                  <option value="nai-diffusion-4-curated-preview">V4 Curated</option>
                  <option value="nai-diffusion-4-full">V4 Full</option>
                </optgroup>
                <optgroup label="Legacy - 旧版">
                  <option value="nai-diffusion-3">Anime V3</option>
                  <option value="nai-diffusion-furry-3">Furry V3</option>
                </optgroup>
                {novelaiModels.length > 0 && (
                  <optgroup label="从API获取">
                    {novelaiModels.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="text-xs text-gray-400 mt-1.5">
                V4.5是官方最新模型，推荐使用V4.5 Curated或V4.5 Full
              </p>
            </div>

            {/* Auto Generate Toggle */}
            <div className="flex items-center justify-between p-4 bg-pink-50/50 rounded-2xl">
              <div>
                <p className="font-medium text-gray-800">自动画图</p>
                <p className="text-xs text-gray-500">聊天时角色根据场景自动生成图片</p>
              </div>
              <button
                onClick={() => setNovelaiAutoGenerate(!novelaiAutoGenerate)}
                className={`w-14 h-8 rounded-full transition-all ${
                  novelaiAutoGenerate ? 'bg-pink-400' : 'bg-gray-300'
                }`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  novelaiAutoGenerate ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* 生成设置 和 测试生成 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => setNovelaiSettingsOpen(true)}
                className="flex-1 py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <Settings className="w-4 h-4 text-pink-500" />
                生成设置
              </button>
              <button
                onClick={() => setNovelaiTestOpen(true)}
                disabled={!novelaiKey}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
              >
                <Brush className="w-4 h-4" />
                测试生成
              </button>
            </div>

            {/* Save Button */}
            <Button
              onClick={saveNovelaiSettings}
              disabled={!novelaiKey}
              className="w-full py-6 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 text-white font-medium shadow-lg hover:shadow-xl transition-all"
            >
              保存NovelAI配置
            </Button>

            {/* 清除数据按钮 */}
            {novelaiConfigured && (
              <button
                onClick={() => setClearNovelaiConfirmOpen(true)}
                className="w-full py-3 rounded-2xl bg-red-50 text-red-500 font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                清除所有NovelAI数据
              </button>
            )}
          </div>
        </div>

        {/* NovelAI 清除数据确认弹窗 */}
        <Dialog open={clearNovelaiConfirmOpen} onOpenChange={setClearNovelaiConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                确认清除NovelAI数据
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <p className="text-gray-600 text-sm">
                此操作将清除您的所有NovelAI配置，包括：
              </p>
              <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
                <li>API Token</li>
                <li>模型选择和生成设置</li>
                <li>默认提示词设置</li>
                <li>所有角色专属的提示词</li>
              </ul>
              <p className="text-red-500 text-sm font-medium">
                ⚠️ 此操作不可恢复！
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setClearNovelaiConfirmOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={clearAllNovelaiData}
                  disabled={clearingNovelai}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {clearingNovelai ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  确认清除
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* NovelAI 生成设置弹窗 */}
        <Dialog open={novelaiSettingsOpen} onOpenChange={setNovelaiSettingsOpen}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>NovelAI 生成设置</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* 图像尺寸 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">图像尺寸（oplus可无限出小图）</label>
                <select
                  value={novelaiSize}
                  onChange={(e) => setNovelaiSize(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm"
                >
                  {NOVELAI_SIZES.map(size => (
                    <option key={size.id} value={size.id}>{size.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400">建议使用官方支持的标准尺寸以获得最佳效果</p>
              </div>

              {/* 采样步数 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">采样步数 (Steps)</label>
                <Input
                  type="number"
                  value={novelaiSteps}
                  onChange={(e) => setNovelaiSteps(parseInt(e.target.value) || 28)}
                  className="rounded-xl"
                  min={1}
                  max={50}
                />
                <p className="text-xs text-gray-400">推荐值: 28 (值越高质量越好但耗时越长)</p>
              </div>

              {/* CFG Scale */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">提示词相关性 (CFG Scale)</label>
                <Input
                  type="number"
                  value={novelaiScale}
                  onChange={(e) => setNovelaiScale(parseFloat(e.target.value) || 5)}
                  className="rounded-xl"
                  min={0}
                  max={20}
                  step={0.5}
                />
                <p className="text-xs text-gray-400">推荐值: 5 (控制图像与提示词的相关程度)</p>
              </div>

              {/* Sampler */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">采样器 (Sampler)</label>
                <select
                  value={novelaiSampler}
                  onChange={(e) => setNovelaiSampler(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm"
                >
                  {NOVELAI_SAMPLERS.map(sampler => (
                    <option key={sampler} value={sampler}>
                      {sampler === 'k_euler_ancestral' ? 'Euler Ancestral' : 
                       sampler === 'k_euler' ? 'Euler' :
                       sampler === 'k_dpmpp_2s_ancestral' ? 'DPM++ 2S Ancestral' :
                       sampler === 'k_dpmpp_2m' ? 'DPM++ 2M' :
                       sampler === 'k_dpmpp_sde' ? 'DPM++ SDE' :
                       sampler === 'ddim_v3' ? 'DDIM V3' : sampler}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seed */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">随机种子 (Seed)</label>
                <Input
                  type="number"
                  value={novelaiSeed}
                  onChange={(e) => setNovelaiSeed(parseInt(e.target.value) || -1)}
                  className="rounded-xl"
                />
                <p className="text-xs text-gray-400">-1 表示随机，固定种子可复现相同图像</p>
              </div>

              {/* UC Preset */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">负面提示词预设 (UC Preset)</label>
                <select
                  value={novelaiUcPreset}
                  onChange={(e) => setNovelaiUcPreset(parseInt(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm"
                >
                  {NOVELAI_UC_PRESETS.map(preset => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
              </div>

              {/* 质量标签 */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-700 text-sm">质量标签</p>
                  <p className="text-xs text-gray-500">自动添加质量提升标签</p>
                </div>
                <button
                  onClick={() => setNovelaiQualityTags(!novelaiQualityTags)}
                  className={`w-12 h-6 rounded-full transition-all ${
                    novelaiQualityTags ? 'bg-pink-400' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    novelaiQualityTags ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* SMEA */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-700 text-sm">SMEA (提升细节)</p>
                  <p className="text-xs text-gray-500">启用SMEA增强</p>
                </div>
                <button
                  onClick={() => setNovelaiSmea(!novelaiSmea)}
                  className={`w-12 h-6 rounded-full transition-all ${
                    novelaiSmea ? 'bg-pink-400' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    novelaiSmea ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* SMEA DYN */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-700 text-sm">SMEA DYN (动态优化)</p>
                  <p className="text-xs text-gray-500">启用动态SMEA</p>
                </div>
                <button
                  onClick={() => setNovelaiSmeaDyn(!novelaiSmeaDyn)}
                  className={`w-12 h-6 rounded-full transition-all ${
                    novelaiSmeaDyn ? 'bg-pink-400' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    novelaiSmeaDyn ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* 默认正面提示词 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">默认正面提示词</label>
                <Textarea
                  value={novelaiDefaultPrompt}
                  onChange={(e) => setNovelaiDefaultPrompt(e.target.value)}
                  className="rounded-xl min-h-[80px]"
                  placeholder="masterpiece, best quality, 1girl..."
                />
                <p className="text-xs text-gray-400">此提示词将在生成时自动使用（如果测试弹窗中未填写）</p>
              </div>

              {/* 默认负面提示词 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">默认负面提示词</label>
                <Textarea
                  value={novelaiDefaultNegative}
                  onChange={(e) => setNovelaiDefaultNegative(e.target.value)}
                  className="rounded-xl min-h-[80px]"
                  placeholder="lowres, bad anatomy, bad hands..."
                />
              </div>

              {/* 按钮 */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={resetNovelaiGenSettings}
                  className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  恢复默认
                </button>
                <button
                  onClick={saveNovelaiGenSettings}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-400 to-purple-400 text-white font-medium hover:shadow-lg transition-all"
                >
                  保存设置
                </button>
              </div>
              
              {/* 关闭按钮 */}
              <button
                onClick={() => setNovelaiSettingsOpen(false)}
                className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* NovelAI 测试生成弹窗 */}
        <Dialog open={novelaiTestOpen} onOpenChange={setNovelaiTestOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-xl">🖼️</span>
                NovelAI 测试生成
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* 正面提示词 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">正面提示词</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => copyPromptToClipboard(novelaiTestPrompt)}
                      className="p-1.5 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors"
                      title="复制"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (novelaiTestPrompt) {
                          const textarea = document.querySelector('textarea[data-prompt="positive"]') as HTMLTextAreaElement;
                          if (textarea) {
                            textarea.select();
                          }
                        }
                      }}
                      className="p-1.5 rounded-lg bg-purple-50 text-purple-500 hover:bg-purple-100 transition-colors"
                      title="全选"
                    >
                      <span className="text-xs font-bold">全</span>
                    </button>
                    <button
                      onClick={() => setNovelaiTestPrompt('')}
                      className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                      title="清空"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <Textarea
                  data-prompt="positive"
                  value={novelaiTestPrompt}
                  onChange={(e) => setNovelaiTestPrompt(e.target.value)}
                  className="rounded-xl min-h-[100px] font-mono text-sm"
                  style={{ wordBreak: 'break-all' }}
                  placeholder="1girl, solo, long hair, blue eyes, smile, outdoors, cherry blossoms, spring"
                />
              </div>

              {/* 负面提示词 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">负面提示词（可选）</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => copyPromptToClipboard(novelaiTestNegative)}
                      className="p-1.5 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors"
                      title="复制"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (novelaiTestNegative) {
                          const textarea = document.querySelector('textarea[data-prompt="negative"]') as HTMLTextAreaElement;
                          if (textarea) {
                            textarea.select();
                          }
                        }
                      }}
                      className="p-1.5 rounded-lg bg-purple-50 text-purple-500 hover:bg-purple-100 transition-colors"
                      title="全选"
                    >
                      <span className="text-xs font-bold">全</span>
                    </button>
                    <button
                      onClick={() => setNovelaiTestNegative('')}
                      className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                      title="清空"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <Textarea
                  data-prompt="negative"
                  value={novelaiTestNegative}
                  onChange={(e) => setNovelaiTestNegative(e.target.value)}
                  className="rounded-xl min-h-[80px] font-mono text-sm"
                  style={{ wordBreak: 'break-all' }}
                  placeholder="留空将使用设置中的默认负面提示词"
                />
              </div>

              {/* 垫图功能 (img2img) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">垫图 (img2img)</label>
                  {novelaiTestRefImage && (
                    <button
                      onClick={() => setNovelaiTestRefImage(null)}
                      className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                      title="移除垫图"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                
                <input
                  ref={novelaiRefInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleNovelaiRefImageUpload}
                  className="hidden"
                />
                
                {novelaiTestRefImage ? (
                  <div className="relative">
                    <img
                      src={novelaiTestRefImage}
                      alt="垫图预览"
                      className="w-full h-32 object-contain rounded-xl border border-gray-200 bg-gray-50"
                    />
                    <button
                      onClick={() => novelaiRefInputRef.current?.click()}
                      className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-white/90 text-gray-700 text-xs font-medium hover:bg-white transition-colors shadow-sm"
                    >
                      更换图片
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => novelaiRefInputRef.current?.click()}
                    className="w-full h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-purple-400 hover:text-purple-500 transition-colors"
                  >
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-sm">点击上传垫图</span>
                  </button>
                )}
                
                {/* 垫图强度 */}
                {novelaiTestRefImage && (
                  <div className="flex items-center gap-3 mt-2">
                    <label className="text-xs text-gray-500 whitespace-nowrap">重绘强度:</label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.05"
                      value={novelaiTestRefStrength}
                      onChange={(e) => setNovelaiTestRefStrength(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-gray-600 w-8">{novelaiTestRefStrength}</span>
                  </div>
                )}
                <p className="text-xs text-gray-400">上传图片后将以该图为基础进行重绘，强度越高变化越大</p>
              </div>

              {/* 生成按钮 */}
              <Button
                onClick={testNovelaiDraw}
                disabled={novelaiTestDrawing || !novelaiTestPrompt.trim()}
                className="w-full py-6 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium"
              >
                {novelaiTestDrawing ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Brush className="w-5 h-5 mr-2" />
                )}
                {novelaiTestRefImage ? '重绘图像' : '生成图像'}
              </Button>

              {/* 结果展示 */}
              {novelaiTestResult && (
                <div className="relative">
                  <img
                    src={novelaiTestResult}
                    alt="NovelAI生成的图片"
                    className="w-full rounded-xl shadow-lg border border-gray-200"
                    style={{ maxHeight: '300px', objectFit: 'contain', backgroundColor: '#f8f8f8' }}
                  />
                  <button
                    onClick={() => setNovelaiTestResult(null)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* 关闭按钮 */}
              <button
                onClick={() => setNovelaiTestOpen(false)}
                className="w-full py-3 rounded-xl bg-red-100 text-red-600 font-medium hover:bg-red-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* TTS Configuration Card */}
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-blue-100/50">
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">语音合成 (TTS)</h2>
                <p className="text-xs text-gray-500">
                  配置语音API实现通话语音播放
                </p>
              </div>
            </div>
            {ttsConfigured && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium">
                <Check className="w-3.5 h-3.5" /> 已配置
              </span>
            )}
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50/80 to-cyan-50/80 rounded-2xl mb-4">
            <div>
              <p className="font-medium text-gray-800">启用语音功能</p>
              <p className="text-xs text-gray-500">关闭后通话时角色不会播放语音</p>
            </div>
            <button
              onClick={async () => {
                const newVal = !ttsEnabled;
                setTtsEnabled(newVal);
                if (user) {
                  await supabase.from('api_keys').delete().eq('user_id', user.id).eq('provider', 'tts_enabled');
                  await supabase.from('api_keys').insert({ user_id: user.id, provider: 'tts_enabled', api_key: newVal ? 'true' : 'false' });
                }
              }}
              className={`w-14 h-8 rounded-full transition-all ${
                ttsEnabled ? 'bg-blue-400' : 'bg-gray-300'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                ttsEnabled ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className={`space-y-4 ${!ttsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* TTS Base URL */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-blue-600 mb-2">
                <Globe className="w-4 h-4" />
                TTS API URL
              </label>
              <Input
                placeholder="例如: https://api.elevenlabs.io/v1/text-to-speech"
                value={ttsBaseUrl}
                onChange={(e) => setTtsBaseUrl(e.target.value)}
                className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                支持 OpenAI TTS、ElevenLabs、Minimax、Fish Audio 等任意兼容API
              </p>
            </div>

            {/* TTS API Key */}
            <div>
              <label className="text-sm font-medium text-blue-600 mb-2 block">
                API Key
              </label>
              <div className="relative">
                <Input
                  type={showTtsKey ? 'text' : 'password'}
                  placeholder="你的TTS API密钥"
                  value={ttsApiKey}
                  onChange={(e) => setTtsApiKey(e.target.value)}
                  className="rounded-2xl bg-white border-gray-200 h-12 pr-12 text-gray-700 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowTtsKey(!showTtsKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showTtsKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* TTS Model */}
            <div>
              <label className="text-sm font-medium text-blue-600 mb-2 block">
                模型名称 (可选)
              </label>
              <Input
                placeholder="例如: tts-1, eleven_multilingual_v2"
                value={ttsModel}
                onChange={(e) => setTtsModel(e.target.value)}
                className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                不同API使用不同的模型名称，留空使用默认值
              </p>
            </div>

            {/* Test Voice ID */}
            <div>
              <label className="text-sm font-medium text-blue-600 mb-2 block">
                测试语音ID (Volink必填)
              </label>
              <Input
                placeholder="例如: 689334e84d3396ad1d28eea8"
                value={ttsTestVoiceId}
                onChange={(e) => setTtsTestVoiceId(e.target.value)}
                className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Volink等API需要提供voice_id才能测试，可在API文档中查找
              </p>
            </div>

            {/* Test Button */}
            <button
              onClick={testTtsConnection}
              disabled={testingTts || !ttsBaseUrl || !ttsApiKey}
              className="w-full py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {testingTts ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4 text-blue-500" />
              )}
              测试TTS连接
            </button>

            {/* Save Button */}
            <Button
              onClick={saveTtsSettings}
              disabled={!ttsBaseUrl || !ttsApiKey}
              className="w-full py-6 rounded-2xl bg-gradient-to-r from-blue-400 to-cyan-400 text-white font-medium shadow-lg hover:shadow-xl transition-all"
            >
              保存TTS配置
            </Button>
          </div>
        </div>

        {/* 图片生成API配置 (统一用于聊天和空间) */}
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-emerald-100/50">
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                <Brush className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">图片生成 API</h2>
                <p className="text-xs text-gray-500">
                  统一用于角色聊天和空间动态的AI绘图
                </p>
              </div>
            </div>
            {spaceImageConfigured && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium">
                <Check className="w-3.5 h-3.5" /> 已配置
              </span>
            )}
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 rounded-2xl mb-4">
            <div>
              <p className="font-medium text-gray-800">启用图片生成</p>
              <p className="text-xs text-gray-500">开启后聊天和空间都可以AI绘图</p>
            </div>
            <button
              onClick={async () => {
                const newVal = !spaceImageEnabled;
                setSpaceImageEnabled(newVal);
                if (user) {
                  await supabase.from('api_keys').delete().eq('user_id', user.id).eq('provider', 'space_image_enabled');
                  await supabase.from('api_keys').insert({ user_id: user.id, provider: 'space_image_enabled', api_key: newVal ? 'true' : 'false' });
                }
              }}
              className={`w-14 h-8 rounded-full transition-all ${
                spaceImageEnabled ? 'bg-emerald-400' : 'bg-gray-300'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                spaceImageEnabled ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className={`space-y-4 ${!spaceImageEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* API URL */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-emerald-600 mb-2">
                <Globe className="w-4 h-4" />
                图片API URL
              </label>
              <Input
                placeholder="例如: https://your-api.com/v1/images/generations"
                value={spaceImageApiUrl}
                onChange={(e) => setSpaceImageApiUrl(e.target.value)}
                className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                支持OpenAI格式的图片生成API，如Gemini图片生成、DALL-E等
              </p>
            </div>

            {/* API Key */}
            <div>
              <label className="text-sm font-medium text-emerald-600 mb-2 block">
                API Key
              </label>
              <div className="relative">
                <Input
                  type={showSpaceImageKey ? 'text' : 'password'}
                  placeholder="你的图片API密钥"
                  value={spaceImageApiKey}
                  onChange={(e) => setSpaceImageApiKey(e.target.value)}
                  className="rounded-2xl bg-white border-gray-200 h-12 pr-12 text-gray-700 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowSpaceImageKey(!showSpaceImageKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSpaceImageKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Model */}
            <div>
              <label className="text-sm font-medium text-emerald-600 mb-2 block">
                模型名称 (可选)
              </label>
              
              {/* Model Selection - show dropdown if models fetched */}
              {spaceImageAvailableModels.length > 0 ? (
                <select
                  value={spaceImageModel}
                  onChange={(e) => setSpaceImageModel(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  style={{ 
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '20px'
                  }}
                >
                  <option value="">使用API默认模型</option>
                  {spaceImageAvailableModels.map((model, index) => (
                    <option key={index} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder="例如: dall-e-3, gpt-image-1"
                  value={spaceImageModel}
                  onChange={(e) => setSpaceImageModel(e.target.value)}
                  className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
                />
              )}
              
              {/* Fetch Models Button */}
              <button
                onClick={fetchSpaceImageModels}
                disabled={fetchingSpaceImageModels || !spaceImageApiKey || !spaceImageApiUrl}
                className="mt-2 w-full py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-medium flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                {fetchingSpaceImageModels ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {spaceImageAvailableModels.length > 0 ? '重新获取模型' : '自动获取模型'}
              </button>
              
              <p className="text-xs text-gray-400 mt-1.5">
                点击上方按钮自动获取可用模型，或手动输入模型名称
              </p>
            </div>

            {/* Test Connection Button */}
            <button
              onClick={testSpaceImageApi}
              disabled={testingSpaceImage || !spaceImageApiKey || !spaceImageApiUrl}
              className="w-full py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {testingSpaceImage ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4 text-emerald-500" />
              )}
              测试连接
            </button>

            {/* Save Button */}
            <Button
              onClick={saveSpaceImageSettings}
              disabled={!spaceImageApiUrl || !spaceImageApiKey}
              className="w-full py-6 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 text-white font-medium shadow-lg hover:shadow-xl transition-all"
            >
              保存图片API配置
            </Button>

            {/* 测试绘图功能 */}
            <div className="mt-6 pt-6 border-t border-emerald-100">
              <div className="flex items-center gap-2 mb-3">
                <Brush className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-gray-700">测试绘图</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                输入提示词测试图片生成效果
              </p>
              
              <div className="flex gap-2">
                <Input
                  placeholder="输入绘图提示词，如：一只可爱的猫咪"
                  value={testDrawPrompt}
                  onChange={(e) => setTestDrawPrompt(e.target.value)}
                  className="flex-1 rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !testDrawing) {
                      testDrawImage();
                    }
                  }}
                />
                <Button
                  onClick={testDrawImage}
                  disabled={testDrawing || !spaceImageApiKey || !spaceImageApiUrl || !testDrawPrompt.trim()}
                  className="px-6 h-12 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 text-white font-medium"
                >
                  {testDrawing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Brush className="w-5 h-5" />
                  )}
                </Button>
              </div>
              
              {/* 绘图结果展示 */}
              {testDrawResult && (
                <div className="mt-4 relative">
                  <img
                    src={testDrawResult}
                    alt="生成的图片"
                    className="w-full rounded-2xl shadow-lg border border-emerald-100"
                    style={{ maxHeight: '300px', objectFit: 'contain', backgroundColor: '#f0fdf4' }}
                  />
                  <button
                    onClick={() => setTestDrawResult(null)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Unsplash 免费配图配置 */}
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-sky-100/50">
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-100 to-blue-100 flex items-center justify-center">
                <Camera className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">Unsplash 免费配图</h2>
                <p className="text-xs text-gray-500">
                  使用免费摄影图库自动配图，无需付费
                </p>
              </div>
            </div>
            {unsplashConfigured && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium">
                <Check className="w-3.5 h-3.5" /> 已配置
              </span>
            )}
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-sky-50/80 to-blue-50/80 rounded-2xl mb-4">
            <div>
              <p className="font-medium text-gray-800">启用 Unsplash 配图</p>
              <p className="text-xs text-gray-500">开启后将自动根据动态内容搜索真实摄影图片</p>
            </div>
            <button
              onClick={async () => {
                const newVal = !unsplashEnabled;
                setUnsplashEnabled(newVal);
                if (user) {
                  await supabase.from('api_keys').delete().eq('user_id', user.id).eq('provider', 'unsplash_enabled');
                  await supabase.from('api_keys').insert({ user_id: user.id, provider: 'unsplash_enabled', api_key: newVal ? 'true' : 'false' });
                }
              }}
              className={`w-14 h-8 rounded-full transition-all ${
                unsplashEnabled ? 'bg-sky-400' : 'bg-gray-300'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                unsplashEnabled ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className={`space-y-4 ${!unsplashEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Access Key */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-sky-600 mb-2">
                <Key className="w-4 h-4" />
                Access Key
              </label>
              <div className="relative">
                <Input
                  type={showUnsplashKey ? 'text' : 'password'}
                  placeholder="你的 Unsplash Access Key"
                  value={unsplashAccessKey}
                  onChange={(e) => setUnsplashAccessKey(e.target.value)}
                  className="rounded-2xl bg-white border-gray-200 h-12 pr-12 text-gray-700 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowUnsplashKey(!showUnsplashKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showUnsplashKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                前往 <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" className="text-sky-500 underline">unsplash.com/developers</a> 免费注册获取
              </p>
            </div>

            {/* Category Selection */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-sky-600 mb-2">
                <ImageIcon className="w-4 h-4" />
                图片风格偏好
              </label>
              <select
                value={unsplashCategory}
                onChange={(e) => setUnsplashCategory(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-300"
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '20px'
                }}
              >
                <option value="auto">🎯 自动匹配 (根据内容智能选择)</option>
                <option value="nature">🌿 自然风景 (山川、森林、海洋)</option>
                <option value="city">🏙️ 城市街景 (建筑、街道、夜景)</option>
                <option value="people">👥 人物生活 (日常、肖像)</option>
                <option value="food">🍜 美食料理 (餐点、饮品)</option>
                <option value="animals">🐾 动物萌宠 (猫狗、野生动物)</option>
                <option value="art">🎨 艺术设计 (插画、抽象)</option>
                <option value="travel">✈️ 旅行度假 (景点、风土人情)</option>
                <option value="minimal">⚪ 极简风格 (简约、留白)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1.5">
                选择后将优先搜索该类别的图片，"自动匹配"会根据动态内容智能选择
              </p>
            </div>

            {/* Test Button */}
            <button
              onClick={testUnsplashApi}
              disabled={testingUnsplash || !unsplashAccessKey}
              className="w-full py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {testingUnsplash ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4 text-sky-500" />
              )}
              测试连接
            </button>

            {/* Save Button */}
            <Button
              onClick={saveUnsplashSettings}
              disabled={!unsplashAccessKey}
              className="w-full py-6 rounded-2xl bg-gradient-to-r from-sky-400 to-blue-400 text-white font-medium shadow-lg hover:shadow-xl transition-all"
            >
              保存 Unsplash 配置
            </Button>
          </div>
        </div>

        {/* VN (视觉小说) 专用 API 配置 */}
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-indigo-100/50">
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <span className="text-lg">📖</span>
              </div>
              <div>
                <h2 className="font-bold text-gray-800">视觉小说专用 API</h2>
                <p className="text-xs text-gray-500">
                  可为视觉小说模式单独配置 API，留空则使用通用对话 API
                </p>
              </div>
            </div>
            {vnConfigured && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium">
                <Check className="w-3.5 h-3.5" /> 已配置
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Base URL */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-indigo-600 mb-2">
                <Globe className="w-4 h-4" />
                Base URL
              </label>
              <Input
                placeholder="https://api.deepseek.com/v1"
                value={vnBaseUrl}
                onChange={(e) => setVnBaseUrl(e.target.value)}
                className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="text-sm font-medium text-indigo-600 mb-2 block">
                API Key
              </label>
              <div className="relative">
                <Input
                  type={showVnKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={vnApiKey}
                  onChange={(e) => setVnApiKey(e.target.value)}
                  className="rounded-2xl bg-white border-gray-200 h-12 pr-12 text-gray-700 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowVnKey(!showVnKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showVnKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Model */}
            <div>
              <label className="text-sm font-medium text-indigo-600 mb-2 block">
                模型名称（可选）
              </label>
              <Input
                placeholder="deepseek-chat"
                value={vnModel}
                onChange={(e) => setVnModel(e.target.value)}
                className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={testVnConnection}
                disabled={testingVn || !vnApiKey || !vnBaseUrl}
                className="flex-1 py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {testingVn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4 text-indigo-500" />
                )}
                测试连接
              </button>
              <Button
                onClick={saveVnSettings}
                disabled={!vnApiKey || !vnBaseUrl}
                className="flex-1 py-6 rounded-2xl bg-gradient-to-r from-indigo-400 to-purple-400 text-white font-medium shadow-lg hover:shadow-xl transition-all"
              >
                保存配置
              </Button>
            </div>
          </div>
        </div>

        {/* Reset All Settings Button */}
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-orange-100/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-yellow-100 flex items-center justify-center">
              <span className="text-lg">🔄</span>
            </div>
            <div>
              <h2 className="font-bold text-gray-800">恢复默认设置</h2>
              <p className="text-xs text-gray-500">一键恢复所有美化和API设置为默认值</p>
            </div>
          </div>
          
          <button
            onClick={async () => {
              if (!user) return;
              if (!window.confirm('确定要恢复所有设置为默认值吗？此操作不可撤销。')) return;
              
              // Reset customization
              await supabase.from('customization').update({
                bubble_color: '#FFB5C5',
                friend_bubble_color: '#B5D8FF',
                bubble_style: 'rounded',
                bubble_opacity: 1,
                bubble_size: 16,
                chat_background_url: null,
                global_background_url: null,
                video_background_url: null,
                theme: 'pink',
                font_family: 'default',
                font_color: '#333333',
                friend_font_color: '#333333',
                global_text_color: '#333333',
                global_text_size: 16,
                avatar_frame_url: null,
                friend_avatar_frame_url: null,
                bubble_frame_url: null,
                friend_bubble_frame_url: null,
              } as any).eq('user_id', user.id);
              
              // Reset API settings
              await supabase.from('api_keys').delete().eq('user_id', user.id);
              
              // Clear localStorage
              localStorage.removeItem('selectedFont');
              localStorage.removeItem('globalTextColor');
              localStorage.removeItem('globalTextSize');
              
              // Remove applied styles
              document.getElementById('global-font-style')?.remove();
              document.getElementById('global-text-color-style')?.remove();
              document.getElementById('global-text-size-style')?.remove();
              
              // Reset theme
              document.documentElement.classList.remove('theme-pink', 'theme-blue', 'theme-orange', 'theme-green', 'theme-purple', 'theme-dark');
              document.documentElement.classList.add('theme-pink');
              
              toast.success('已恢复所有默认设置');
              
              // Reload page to apply changes
              setTimeout(() => window.location.reload(), 500);
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-400 to-yellow-400 text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            一键恢复默认设置
          </button>
        </div>

        {/* Push Notification Settings */}
        <PushNotificationCard />

        {/* Admin Button - Removed from UI, accessible via direct URL /admin */}

        {/* Logout Button */}
        <Button 
          variant="outline" 
          className="w-full rounded-2xl py-5 bg-white/60 backdrop-blur-sm border-red-200 text-red-500 hover:bg-red-50" 
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          退出登录
        </Button>

        {/* Version and Legal Info */}
        <div className="text-center pt-6 pb-4 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <p className="text-xs text-gray-400">版本 v{APP_VERSION}</p>
            <button
              onClick={() => {
                toast.success('已是最新版本', {
                  description: `当前版本 v${APP_VERSION}，更新于 ${BUILD_DATE}`,
                  icon: <Sparkles className="w-4 h-4 text-green-500" />,
                });
              }}
              className="text-xs text-purple-500 hover:text-purple-700 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              检查更新
            </button>
          </div>
          
          {/* Changelog Preview */}
          <details className="text-left bg-white/40 rounded-xl p-3 text-xs">
            <summary className="text-gray-500 cursor-pointer hover:text-purple-600">
              查看更新日志
            </summary>
            <div className="mt-2 space-y-2">
              {CHANGELOG.map((log) => (
                <div key={log.version} className="border-l-2 border-purple-200 pl-2">
                  <p className="font-medium text-purple-600">v{log.version} ({log.date})</p>
                  <ul className="text-gray-500 mt-1 space-y-0.5">
                    {log.changes.map((change, i) => (
                      <li key={i}>• {change}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
          
          <div className="flex items-center justify-center gap-3 text-xs">
            <button 
              onClick={() => navigate('/privacy')}
              className="text-purple-500 hover:text-purple-700 underline"
            >
              隐私政策
            </button>
            <span className="text-gray-300">|</span>
            <button 
              onClick={() => navigate('/terms')}
              className="text-purple-500 hover:text-purple-700 underline"
            >
              用户协议
            </button>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            本应用最终解释权归开发者所有
          </p>
          <p className="text-xs text-gray-300">
            © 2024 All Rights Reserved
          </p>
        </div>
      </div>
      
      {/* Click outside to close dropdown */}
      {showModelDropdown && (
        <div 
          className="fixed inset-0 z-[99]" 
          onClick={() => setShowModelDropdown(false)}
        />
      )}
    </div>
  );
};

export default SettingsPage;