import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Key, LogOut, Check, Loader2, Globe, Eye, EyeOff, TestTube, RefreshCw, ChevronDown, Zap, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { APP_VERSION, BUILD_DATE, CHANGELOG } from '@/config/version';

const DEFAULT_MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek', description: '强大的通用对话模型' },
];

// 默认使用V4 Full模型，不再显示选择器

const NOVELAI_STYLES = [
  { id: 'selfie', name: '自拍', prompt: 'selfie, close-up, looking at viewer, front view' },
  { id: 'portrait', name: '半身', prompt: 'upper body, portrait, looking at viewer' },
  { id: 'fullbody', name: '全身', prompt: 'full body, standing, from front' },
  { id: 'scene', name: '场景', prompt: 'scenic, background, detailed environment' },
  { id: 'custom', name: '自定义', prompt: '' },
];

const NOVELAI_GENDERS = [
  { id: 'female', name: '女性', tag: '1girl' },
  { id: 'male', name: '男性', tag: '1boy' },
  { id: 'couple', name: '情侣', tag: '1girl, 1boy, couple' },
  { id: 'auto', name: '根据角色设定', tag: '' },
  { id: 'custom', name: '自定义', tag: '' },
];

const NOVELAI_ACTIONS = [
  { id: 'none', name: '无', prompt: '' },
  { id: 'standing', name: '站立', prompt: 'standing' },
  { id: 'sitting', name: '坐着', prompt: 'sitting' },
  { id: 'lying', name: '躺着', prompt: 'lying down, on bed' },
  { id: 'kneeling', name: '跪着', prompt: 'kneeling' },
  { id: 'walking', name: '走路', prompt: 'walking' },
  { id: 'running', name: '跑步', prompt: 'running' },
  { id: 'hugging', name: '拥抱', prompt: 'hugging, embrace' },
  { id: 'kissing', name: '亲吻', prompt: 'kissing' },
  { id: 'holding_hands', name: '牵手', prompt: 'holding hands' },
  { id: 'sleeping', name: '睡觉', prompt: 'sleeping, eyes closed' },
  { id: 'stretching', name: '伸懒腰', prompt: 'stretching, arms up' },
  { id: 'custom', name: '自定义', prompt: '' },
];

const NOVELAI_EXPRESSIONS = [
  { id: 'none', name: '无', prompt: '' },
  { id: 'smile', name: '微笑', prompt: 'smile, happy' },
  { id: 'blush', name: '害羞', prompt: 'blush, shy, embarrassed' },
  { id: 'laugh', name: '大笑', prompt: 'laughing, open mouth' },
  { id: 'cry', name: '哭泣', prompt: 'crying, tears' },
  { id: 'angry', name: '生气', prompt: 'angry, frown' },
  { id: 'surprised', name: '惊讶', prompt: 'surprised, wide eyes, open mouth' },
  { id: 'seductive', name: '魅惑', prompt: 'seductive, bedroom eyes, parted lips' },
  { id: 'sleepy', name: '困倦', prompt: 'sleepy, drowsy, half-closed eyes' },
  { id: 'pout', name: '嘟嘴', prompt: 'pout, pouting' },
  { id: 'wink', name: '眨眼', prompt: 'wink, one eye closed' },
  { id: 'custom', name: '自定义', prompt: '' },
];

const NOVELAI_SAMPLERS = [
  { id: 'k_euler_ancestral', name: 'Euler Ancestral (推荐)' },
  { id: 'k_euler', name: 'Euler' },
  { id: 'k_dpmpp_2s_ancestral', name: 'DPM++ 2S Ancestral' },
  { id: 'k_dpmpp_2m', name: 'DPM++ 2M' },
  { id: 'k_dpmpp_sde', name: 'DPM++ SDE' },
  { id: 'ddim', name: 'DDIM' },
];

const NOVELAI_RESOLUTIONS = [
  { id: '832x1216', name: '竖版 (832×1216)', width: 832, height: 1216 },
  { id: '1216x832', name: '横版 (1216×832)', width: 1216, height: 832 },
  { id: '1024x1024', name: '正方形 (1024×1024)', width: 1024, height: 1024 },
  { id: '640x640', name: '小正方形 (640×640)', width: 640, height: 640 },
  { id: '512x768', name: 'V3竖版 (512×768)', width: 512, height: 768 },
  { id: '768x512', name: 'V3横版 (768×512)', width: 768, height: 512 },
  { id: 'custom', name: '自定义尺寸', width: 0, height: 0 },
];

const DEFAULT_TRIGGER_KEYWORDS = `画图,画一张,画一幅,画个,生成图,来一张图,发张图,发图,发个图,照片,自拍,看看你,你的样子`;

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
  const [novelaiModel, setNovelaiModel] = useState('nai-diffusion-4-full');
  const [novelaiCustomModel, setNovelaiCustomModel] = useState('');
  const [showNovelaiKey, setShowNovelaiKey] = useState(false);
  const [novelaiConfigured, setNovelaiConfigured] = useState(false);
  const [testingNovelai, setTestingNovelai] = useState(false);
  const [novelaiAutoGenerate, setNovelaiAutoGenerate] = useState(false);
  const [novelaiStyle, setNovelaiStyle] = useState('selfie');
  const [novelaiCustomStylePrompt, setNovelaiCustomStylePrompt] = useState('');
  const [novelaiTriggerKeywords, setNovelaiTriggerKeywords] = useState(DEFAULT_TRIGGER_KEYWORDS);
  const [triggerTestInput, setTriggerTestInput] = useState('');
  const [triggerTestResult, setTriggerTestResult] = useState<{ triggered: boolean; keyword?: string } | null>(null);
  
  // NovelAI advanced parameters
  const [novelaiSteps, setNovelaiSteps] = useState(28);
  const [novelaiScale, setNovelaiScale] = useState(6.0);
  const [novelaiSampler, setNovelaiSampler] = useState('k_euler_ancestral');
  const [novelaiResolution, setNovelaiResolution] = useState('832x1216');
  const [novelaiCustomWidth, setNovelaiCustomWidth] = useState(832);
  const [novelaiCustomHeight, setNovelaiCustomHeight] = useState(1216);
  const [novelaiNegativePrompt, setNovelaiNegativePrompt] = useState('');
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  
  // NovelAI character customization
  const [novelaiGender, setNovelaiGender] = useState('auto');
  const [novelaiCustomGender, setNovelaiCustomGender] = useState('');
  const [novelaiAction, setNovelaiAction] = useState('none');
  const [novelaiCustomAction, setNovelaiCustomAction] = useState('');
  const [novelaiExpression, setNovelaiExpression] = useState('none');
  const [novelaiCustomExpression, setNovelaiCustomExpression] = useState('');
  const [novelaiNsfwMode, setNovelaiNsfwMode] = useState(false);
  const [novelaiCharacterPrompt, setNovelaiCharacterPrompt] = useState('');
  const [showCharacterParams, setShowCharacterParams] = useState(false);
  
  // NovelAI img2img and LoRA settings
  const [novelaiReferenceImage, setNovelaiReferenceImage] = useState('');
  const [novelaiReferenceStrength, setNovelaiReferenceStrength] = useState(0.6);
  const [novelaiVibeTransfer, setNovelaiVibeTransfer] = useState(false);
  const [novelaiVibeImage, setNovelaiVibeImage] = useState('');
  const [novelaiVibeStrength, setNovelaiVibeStrength] = useState(0.6);
  const [showImg2ImgParams, setShowImg2ImgParams] = useState(false);

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
      
      // New NovelAI settings
      const novelaiStyleSetting = data.find(k => k.provider === 'novelai_style');
      const novelaiCustomPromptSetting = data.find(k => k.provider === 'novelai_custom_style_prompt');
      const novelaiTriggerSetting = data.find(k => k.provider === 'novelai_trigger_keywords');
      const novelaiStepsSetting = data.find(k => k.provider === 'novelai_steps');
      const novelaiScaleSetting = data.find(k => k.provider === 'novelai_scale');
      const novelaiSamplerSetting = data.find(k => k.provider === 'novelai_sampler');
      const novelaiWidthSetting = data.find(k => k.provider === 'novelai_width');
      const novelaiHeightSetting = data.find(k => k.provider === 'novelai_height');
      const novelaiNegativeSetting = data.find(k => k.provider === 'novelai_negative_prompt');
      
      if (novelaiStyleSetting) {
        setNovelaiStyle(novelaiStyleSetting.api_key);
      }
      if (novelaiCustomPromptSetting) {
        setNovelaiCustomStylePrompt(novelaiCustomPromptSetting.api_key);
      }
      if (novelaiTriggerSetting) {
        setNovelaiTriggerKeywords(novelaiTriggerSetting.api_key);
      }
      if (novelaiStepsSetting) {
        setNovelaiSteps(parseInt(novelaiStepsSetting.api_key) || 28);
      }
      if (novelaiScaleSetting) {
        setNovelaiScale(parseFloat(novelaiScaleSetting.api_key) || 6.0);
      }
      if (novelaiSamplerSetting) {
        setNovelaiSampler(novelaiSamplerSetting.api_key);
      }
      if (novelaiWidthSetting && novelaiHeightSetting) {
        const w = parseInt(novelaiWidthSetting.api_key);
        const h = parseInt(novelaiHeightSetting.api_key);
        setNovelaiCustomWidth(w);
        setNovelaiCustomHeight(h);
        // Try to match a preset resolution
        const preset = NOVELAI_RESOLUTIONS.find(r => r.width === w && r.height === h);
        if (preset) {
          setNovelaiResolution(preset.id);
        } else {
          setNovelaiResolution('custom');
        }
      }
      if (novelaiNegativeSetting) {
        setNovelaiNegativePrompt(novelaiNegativeSetting.api_key);
      }
      
      // Character customization settings
      const genderSetting = data.find(k => k.provider === 'novelai_gender');
      const customGenderSetting = data.find(k => k.provider === 'novelai_custom_gender');
      const actionSetting = data.find(k => k.provider === 'novelai_action');
      const customActionSetting = data.find(k => k.provider === 'novelai_custom_action');
      const expressionSetting = data.find(k => k.provider === 'novelai_expression');
      const customExpressionSetting = data.find(k => k.provider === 'novelai_custom_expression');
      const nsfwSetting = data.find(k => k.provider === 'novelai_nsfw');
      const characterPromptSetting = data.find(k => k.provider === 'novelai_character_prompt');
      
      if (genderSetting) setNovelaiGender(genderSetting.api_key);
      if (customGenderSetting) setNovelaiCustomGender(customGenderSetting.api_key);
      if (actionSetting) setNovelaiAction(actionSetting.api_key);
      if (customActionSetting) setNovelaiCustomAction(customActionSetting.api_key);
      if (expressionSetting) setNovelaiExpression(expressionSetting.api_key);
      if (customExpressionSetting) setNovelaiCustomExpression(customExpressionSetting.api_key);
      if (nsfwSetting) setNovelaiNsfwMode(nsfwSetting.api_key === 'true');
      if (characterPromptSetting) setNovelaiCharacterPrompt(characterPromptSetting.api_key);
      
      // Img2Img and Vibe Transfer settings
      const refImageSetting = data.find(k => k.provider === 'novelai_reference_image');
      const refStrengthSetting = data.find(k => k.provider === 'novelai_reference_strength');
      const vibeTransferSetting = data.find(k => k.provider === 'novelai_vibe_transfer');
      const vibeImageSetting = data.find(k => k.provider === 'novelai_vibe_image');
      const vibeStrengthSetting = data.find(k => k.provider === 'novelai_vibe_strength');
      
      if (refImageSetting) setNovelaiReferenceImage(refImageSetting.api_key);
      if (refStrengthSetting) setNovelaiReferenceStrength(parseFloat(refStrengthSetting.api_key) || 0.6);
      if (vibeTransferSetting) setNovelaiVibeTransfer(vibeTransferSetting.api_key === 'true');
      if (vibeImageSetting) setNovelaiVibeImage(vibeImageSetting.api_key);
      if (vibeStrengthSetting) setNovelaiVibeStrength(parseFloat(vibeStrengthSetting.api_key) || 0.6);
      
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
    if (!user || !novelaiKey.trim()) {
      toast.error('请输入NovelAI API密钥');
      return;
    }

    // 固定使用V4 Full模型
    const modelToSave = novelaiModel || 'nai-diffusion-4-full';

    const selectedRes =
      novelaiResolution === 'custom'
        ? { width: novelaiCustomWidth, height: novelaiCustomHeight }
        : (NOVELAI_RESOLUTIONS.find(r => r.id === novelaiResolution) || { width: 832, height: 1216 });

    // 关键修复：避免 .single() 在存在重复记录时直接报错，从而越存越多
    // 这里对 NovelAI 相关 provider 统一：先删后插，确保每个 provider 只保留一条记录。
    const providersToReplace = [
      'novelai',
      'novelai_enabled',
      'novelai_model',
      'novelai_auto_generate',
      'novelai_style',
      'novelai_custom_style_prompt',
      'novelai_trigger_keywords',
      'novelai_steps',
      'novelai_scale',
      'novelai_sampler',
      'novelai_width',
      'novelai_height',
      'novelai_negative_prompt',
      'novelai_gender',
      'novelai_custom_gender',
      'novelai_action',
      'novelai_custom_action',
      'novelai_expression',
      'novelai_custom_expression',
      'novelai_nsfw',
      'novelai_character_prompt',
      'novelai_reference_image',
      'novelai_reference_strength',
      'novelai_vibe_transfer',
      'novelai_vibe_image',
      'novelai_vibe_strength',
    ];

    const { error: delErr } = await supabase
      .from('api_keys')
      .delete()
      .eq('user_id', user.id)
      .in('provider', providersToReplace);

    if (delErr) {
      toast.error('保存失败: ' + delErr.message);
      return;
    }

    const rows: Array<{ user_id: string; provider: string; api_key: string }> = [
      { user_id: user.id, provider: 'novelai', api_key: novelaiKey.trim() },
      { user_id: user.id, provider: 'novelai_enabled', api_key: novelaiEnabled ? 'true' : 'false' },
      { user_id: user.id, provider: 'novelai_model', api_key: modelToSave },
      { user_id: user.id, provider: 'novelai_auto_generate', api_key: novelaiAutoGenerate ? 'true' : 'false' },
      { user_id: user.id, provider: 'novelai_style', api_key: novelaiStyle },
      { user_id: user.id, provider: 'novelai_trigger_keywords', api_key: novelaiTriggerKeywords },
      { user_id: user.id, provider: 'novelai_steps', api_key: novelaiSteps.toString() },
      { user_id: user.id, provider: 'novelai_scale', api_key: novelaiScale.toString() },
      { user_id: user.id, provider: 'novelai_sampler', api_key: novelaiSampler },
      { user_id: user.id, provider: 'novelai_width', api_key: selectedRes.width.toString() },
      { user_id: user.id, provider: 'novelai_height', api_key: selectedRes.height.toString() },
      { user_id: user.id, provider: 'novelai_gender', api_key: novelaiGender },
      { user_id: user.id, provider: 'novelai_action', api_key: novelaiAction },
      { user_id: user.id, provider: 'novelai_expression', api_key: novelaiExpression },
      { user_id: user.id, provider: 'novelai_nsfw', api_key: novelaiNsfwMode ? 'true' : 'false' },
    ];

    if (novelaiCustomStylePrompt.trim()) {
      rows.push({ user_id: user.id, provider: 'novelai_custom_style_prompt', api_key: novelaiCustomStylePrompt.trim() });
    }
    if (novelaiNegativePrompt.trim()) {
      rows.push({ user_id: user.id, provider: 'novelai_negative_prompt', api_key: novelaiNegativePrompt.trim() });
    }
    if (novelaiCustomGender.trim()) {
      rows.push({ user_id: user.id, provider: 'novelai_custom_gender', api_key: novelaiCustomGender.trim() });
    }
    if (novelaiCustomAction.trim()) {
      rows.push({ user_id: user.id, provider: 'novelai_custom_action', api_key: novelaiCustomAction.trim() });
    }
    if (novelaiCustomExpression.trim()) {
      rows.push({ user_id: user.id, provider: 'novelai_custom_expression', api_key: novelaiCustomExpression.trim() });
    }
    if (novelaiCharacterPrompt.trim()) {
      rows.push({ user_id: user.id, provider: 'novelai_character_prompt', api_key: novelaiCharacterPrompt.trim() });
    }
    if (novelaiReferenceImage.trim()) {
      rows.push({ user_id: user.id, provider: 'novelai_reference_image', api_key: novelaiReferenceImage.trim() });
    }
    rows.push({ user_id: user.id, provider: 'novelai_reference_strength', api_key: novelaiReferenceStrength.toString() });
    rows.push({ user_id: user.id, provider: 'novelai_vibe_transfer', api_key: novelaiVibeTransfer ? 'true' : 'false' });
    if (novelaiVibeImage.trim()) {
      rows.push({ user_id: user.id, provider: 'novelai_vibe_image', api_key: novelaiVibeImage.trim() });
    }
    rows.push({ user_id: user.id, provider: 'novelai_vibe_strength', api_key: novelaiVibeStrength.toString() });

    const { error: insErr } = await supabase.from('api_keys').insert(rows);
    if (insErr) {
      toast.error('保存失败: ' + insErr.message);
      return;
    }

    setNovelaiConfigured(true);
    toast.success('NovelAI配置已保存');
  };

  const testTrigger = () => {
    if (!triggerTestInput.trim()) {
      setTriggerTestResult(null);
      return;
    }
    
    const keywords = novelaiTriggerKeywords.split(',').map(k => k.trim()).filter(k => k);
    const input = triggerTestInput.toLowerCase();
    
    for (const kw of keywords) {
      if (input.includes(kw.toLowerCase())) {
        setTriggerTestResult({ triggered: true, keyword: kw });
        return;
      }
    }
    
    // Also check regex pattern
    if (/(画|发|来|给).*?(图|图片|照片|自拍)/.test(triggerTestInput)) {
      setTriggerTestResult({ triggered: true, keyword: '(正则匹配)' });
      return;
    }
    
    setTriggerTestResult({ triggered: false });
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

  const useCustomApiHandler = () => {
    setUsingDefaultApi(false);
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
              onClick={() => setNovelaiEnabled(!novelaiEnabled)}
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

            {/* 模型固定使用V4 Full，不再显示选择器 */}

            {/* Style Template Selection */}
            <div>
              <label className="text-sm font-medium text-pink-600 mb-2 block">
                风格模板
              </label>
              <select
                value={novelaiStyle}
                onChange={(e) => setNovelaiStyle(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-300"
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '20px'
                }}
              >
                {NOVELAI_STYLES.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1.5">
                {NOVELAI_STYLES.find(s => s.id === novelaiStyle)?.prompt || '自定义提示词'}
              </p>
            </div>

            {/* Custom Style Prompt (only show when custom is selected) */}
            {novelaiStyle === 'custom' && (
              <div>
                <label className="text-sm font-medium text-pink-600 mb-2 block">
                  自定义风格提示词
                </label>
                <Input
                  placeholder="例如: close-up, side view, dramatic lighting"
                  value={novelaiCustomStylePrompt}
                  onChange={(e) => setNovelaiCustomStylePrompt(e.target.value)}
                  className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
                />
              </div>
            )}

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

            {/* Trigger Keywords Configuration */}
            <div className="p-4 bg-purple-50/50 rounded-2xl space-y-3">
              <div>
                <label className="text-sm font-medium text-purple-600 mb-2 block">
                  触发关键词（用逗号分隔）
                </label>
                <textarea
                  value={novelaiTriggerKeywords}
                  onChange={(e) => setNovelaiTriggerKeywords(e.target.value)}
                  placeholder="画图,发张图,自拍...（填 * 表示每条消息都触发）"
                  className="w-full h-24 px-4 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <p className="text-xs text-gray-400 mt-1">
                  当用户消息包含这些词时会触发画图。填写 <span className="text-purple-500 font-medium">*</span> 或 <span className="text-purple-500 font-medium">任意</span> 表示每条消息都自动画图
                </p>
              </div>

              {/* Test Trigger */}
              <div className="pt-2 border-t border-purple-100">
                <label className="text-sm font-medium text-purple-600 mb-2 block">
                  测试触发
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入测试句子..."
                    value={triggerTestInput}
                    onChange={(e) => {
                      setTriggerTestInput(e.target.value);
                      setTriggerTestResult(null);
                    }}
                    className="flex-1 rounded-2xl bg-white border-gray-200 h-10 text-gray-700 placeholder:text-gray-400"
                  />
                  <Button
                    onClick={testTrigger}
                    variant="outline"
                    className="rounded-2xl h-10 px-4"
                  >
                    测试
                  </Button>
                </div>
                {triggerTestResult !== null && (
                  <div className={`mt-2 text-sm p-2 rounded-xl ${
                    triggerTestResult.triggered 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {triggerTestResult.triggered 
                      ? `✓ 会触发画图！匹配: "${triggerTestResult.keyword}"` 
                      : '✗ 不会触发画图'}
                  </div>
                )}
              </div>
            </div>

            {/* Character Customization Section */}
            <div className="p-4 bg-rose-50/50 rounded-2xl space-y-4">
              <button
                onClick={() => setShowCharacterParams(!showCharacterParams)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <p className="font-medium text-gray-800">角色生成设置</p>
                  <p className="text-xs text-gray-500">性别、动作、表情、无限制模式</p>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showCharacterParams ? 'rotate-180' : ''}`} />
              </button>

              {showCharacterParams && (
                <div className="space-y-4 pt-3 border-t border-rose-100">
                  {/* Gender Selection */}
                  <div>
                    <label className="text-sm font-medium text-rose-600 mb-2 block">
                      性别
                    </label>
                    <select
                      value={novelaiGender}
                      onChange={(e) => setNovelaiGender(e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-300"
                      style={{ 
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '20px'
                      }}
                    >
                      {NOVELAI_GENDERS.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    {novelaiGender !== 'auto' && novelaiGender !== 'custom' && (
                      <p className="text-xs text-gray-400 mt-1">
                        标签: {NOVELAI_GENDERS.find(g => g.id === novelaiGender)?.tag}
                      </p>
                    )}
                  </div>

                  {/* Custom Gender */}
                  {novelaiGender === 'custom' && (
                    <div>
                      <label className="text-sm font-medium text-rose-600 mb-2 block">
                        自定义性别标签
                      </label>
                      <Input
                        placeholder="例如: 2girls, yuri, 或 3boys"
                        value={novelaiCustomGender}
                        onChange={(e) => setNovelaiCustomGender(e.target.value)}
                        className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
                      />
                    </div>
                  )}

                  {/* Action Selection */}
                  <div>
                    <label className="text-sm font-medium text-rose-600 mb-2 block">
                      动作/姿态
                    </label>
                    <select
                      value={novelaiAction}
                      onChange={(e) => setNovelaiAction(e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-300"
                      style={{ 
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '20px'
                      }}
                    >
                      {NOVELAI_ACTIONS.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    {novelaiAction !== 'none' && novelaiAction !== 'custom' && (
                      <p className="text-xs text-gray-400 mt-1">
                        标签: {NOVELAI_ACTIONS.find(a => a.id === novelaiAction)?.prompt}
                      </p>
                    )}
                  </div>

                  {/* Custom Action */}
                  {novelaiAction === 'custom' && (
                    <div>
                      <label className="text-sm font-medium text-rose-600 mb-2 block">
                        自定义动作提示词
                      </label>
                      <Input
                        placeholder="例如: straddling, cowgirl position, riding"
                        value={novelaiCustomAction}
                        onChange={(e) => setNovelaiCustomAction(e.target.value)}
                        className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
                      />
                    </div>
                  )}

                  {/* Expression Selection */}
                  <div>
                    <label className="text-sm font-medium text-rose-600 mb-2 block">
                      表情/神态
                    </label>
                    <select
                      value={novelaiExpression}
                      onChange={(e) => setNovelaiExpression(e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-300"
                      style={{ 
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '20px'
                      }}
                    >
                      {NOVELAI_EXPRESSIONS.map((e) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                    {novelaiExpression !== 'none' && novelaiExpression !== 'custom' && (
                      <p className="text-xs text-gray-400 mt-1">
                        标签: {NOVELAI_EXPRESSIONS.find(e => e.id === novelaiExpression)?.prompt}
                      </p>
                    )}
                  </div>

                  {/* Custom Expression */}
                  {novelaiExpression === 'custom' && (
                    <div>
                      <label className="text-sm font-medium text-rose-600 mb-2 block">
                        自定义表情提示词
                      </label>
                      <Input
                        placeholder="例如: ahegao, tongue out, rolling eyes"
                        value={novelaiCustomExpression}
                        onChange={(e) => setNovelaiCustomExpression(e.target.value)}
                        className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
                      />
                    </div>
                  )}

                  {/* Character Appearance Prompt */}
                  <div>
                    <label className="text-sm font-medium text-rose-600 mb-2 block">
                      角色外观提示词
                    </label>
                    <textarea
                      value={novelaiCharacterPrompt}
                      onChange={(e) => setNovelaiCharacterPrompt(e.target.value)}
                      placeholder="描述角色外观，如：long pink hair, blue eyes, cat ears, maid outfit..."
                      className="w-full h-24 px-4 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      每次画图会自动加上这些外观描述
                    </p>
                  </div>

                  {/* NSFW Mode Toggle */}
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-200">
                    <div>
                      <p className="font-medium text-red-700">🔞 无限制模式</p>
                      <p className="text-xs text-red-500">移除安全词限制，允许成人内容</p>
                    </div>
                    <button
                      onClick={() => setNovelaiNsfwMode(!novelaiNsfwMode)}
                      className={`w-14 h-8 rounded-full transition-all ${
                        novelaiNsfwMode ? 'bg-red-500' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        novelaiNsfwMode ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Parameters Section */}
            <div className="p-4 bg-blue-50/50 rounded-2xl space-y-4">
              <button
                onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <p className="font-medium text-gray-800">高级参数设置</p>
                  <p className="text-xs text-gray-500">自定义 Steps、Scale、Sampler 等参数</p>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showAdvancedParams ? 'rotate-180' : ''}`} />
              </button>

              {showAdvancedParams && (
                <div className="space-y-4 pt-3 border-t border-blue-100">
                  {/* Steps */}
                  <div>
                    <label className="text-sm font-medium text-blue-600 mb-2 block">
                      Steps (步数): {novelaiSteps}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={novelaiSteps}
                      onChange={(e) => setNovelaiSteps(parseInt(e.target.value))}
                      className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>10 (快速)</span>
                      <span>50 (精细)</span>
                    </div>
                  </div>

                  {/* Scale */}
                  <div>
                    <label className="text-sm font-medium text-blue-600 mb-2 block">
                      Scale (引导强度): {novelaiScale.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="0.5"
                      value={novelaiScale}
                      onChange={(e) => setNovelaiScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>1 (自由)</span>
                      <span>V4推荐: 5-7</span>
                      <span>15 (强)</span>
                    </div>
                  </div>

                  {/* Sampler */}
                  <div>
                    <label className="text-sm font-medium text-blue-600 mb-2 block">
                      Sampler (采样器)
                    </label>
                    <select
                      value={novelaiSampler}
                      onChange={(e) => setNovelaiSampler(e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300"
                      style={{ 
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '20px'
                      }}
                    >
                      {NOVELAI_SAMPLERS.map((sampler) => (
                        <option key={sampler.id} value={sampler.id}>
                          {sampler.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Resolution */}
                  <div>
                    <label className="text-sm font-medium text-blue-600 mb-2 block">
                      分辨率
                    </label>
                    <select
                      value={novelaiResolution}
                      onChange={(e) => {
                        setNovelaiResolution(e.target.value);
                        const preset = NOVELAI_RESOLUTIONS.find(r => r.id === e.target.value);
                        if (preset && preset.id !== 'custom') {
                          setNovelaiCustomWidth(preset.width);
                          setNovelaiCustomHeight(preset.height);
                        }
                      }}
                      className="w-full h-12 px-4 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300"
                      style={{ 
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '20px'
                      }}
                    >
                      {NOVELAI_RESOLUTIONS.map((res) => (
                        <option key={res.id} value={res.id}>
                          {res.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Resolution */}
                  {novelaiResolution === 'custom' && (
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">宽度</label>
                        <Input
                          type="number"
                          min="512"
                          max="1536"
                          step="64"
                          value={novelaiCustomWidth}
                          onChange={(e) => setNovelaiCustomWidth(parseInt(e.target.value) || 832)}
                          className="rounded-2xl bg-white border-gray-200 h-10 text-gray-700"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">高度</label>
                        <Input
                          type="number"
                          min="512"
                          max="1536"
                          step="64"
                          value={novelaiCustomHeight}
                          onChange={(e) => setNovelaiCustomHeight(parseInt(e.target.value) || 1216)}
                          className="rounded-2xl bg-white border-gray-200 h-10 text-gray-700"
                        />
                      </div>
                    </div>
                  )}

                  {/* Negative Prompt */}
                  <div>
                    <label className="text-sm font-medium text-blue-600 mb-2 block">
                      负面提示词 (可选)
                    </label>
                    <textarea
                      value={novelaiNegativePrompt}
                      onChange={(e) => setNovelaiNegativePrompt(e.target.value)}
                      placeholder="留空使用默认值：lowres, bad anatomy, bad hands..."
                      className="w-full h-20 px-4 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      用于排除不想要的内容，留空使用默认负面提示词
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Img2Img and LoRA Section */}
            <div className="p-4 bg-indigo-50/50 rounded-2xl space-y-4">
              <button
                onClick={() => setShowImg2ImgParams(!showImg2ImgParams)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <p className="font-medium text-gray-800">🎨 图生图 & 风格迁移</p>
                  <p className="text-xs text-gray-500">参考图生成、Vibe Transfer等高级功能</p>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showImg2ImgParams ? 'rotate-180' : ''}`} />
              </button>

              {showImg2ImgParams && (
                <div className="space-y-4 pt-3 border-t border-indigo-100">
                  {/* Reference Image (Img2Img) */}
                  <div className="p-3 bg-white rounded-xl border border-indigo-200">
                    <p className="font-medium text-indigo-700 mb-2">📷 参考图 (Img2Img)</p>
                    <p className="text-xs text-gray-500 mb-3">上传一张参考图，AI会基于它生成新图</p>
                    
                    <div className="space-y-3">
                      <Input
                        type="text"
                        value={novelaiReferenceImage}
                        onChange={(e) => setNovelaiReferenceImage(e.target.value)}
                        placeholder="粘贴图片URL，或留空不使用"
                        className="rounded-xl bg-gray-50 border-gray-200 h-10 text-gray-700 text-sm"
                      />
                      
                      {novelaiReferenceImage && (
                        <div className="relative">
                          <img 
                            src={novelaiReferenceImage} 
                            alt="参考图预览"
                            className="w-20 h-20 object-cover rounded-lg border"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                          <button
                            onClick={() => setNovelaiReferenceImage('')}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      
                      <div>
                        <label className="text-xs text-indigo-600 mb-1 block">
                          参考强度: {novelaiReferenceStrength.toFixed(2)}
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="0.99"
                          step="0.05"
                          value={novelaiReferenceStrength}
                          onChange={(e) => setNovelaiReferenceStrength(parseFloat(e.target.value))}
                          className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0.1 (几乎原图)</span>
                          <span>0.99 (完全重绘)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vibe Transfer */}
                  <div className="p-3 bg-white rounded-xl border border-indigo-200">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-indigo-700">✨ Vibe Transfer (风格迁移)</p>
                        <p className="text-xs text-gray-500">使用参考图的风格来生成新图</p>
                      </div>
                      <button
                        onClick={() => setNovelaiVibeTransfer(!novelaiVibeTransfer)}
                        className={`w-12 h-6 rounded-full transition-all ${
                          novelaiVibeTransfer ? 'bg-indigo-500' : 'bg-gray-300'
                        }`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          novelaiVibeTransfer ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                    
                    {novelaiVibeTransfer && (
                      <div className="space-y-3 mt-3 pt-3 border-t border-indigo-100">
                        <Input
                          type="text"
                          value={novelaiVibeImage}
                          onChange={(e) => setNovelaiVibeImage(e.target.value)}
                          placeholder="粘贴风格参考图URL"
                          className="rounded-xl bg-gray-50 border-gray-200 h-10 text-gray-700 text-sm"
                        />
                        
                        {novelaiVibeImage && (
                          <div className="relative inline-block">
                            <img 
                              src={novelaiVibeImage} 
                              alt="风格参考图预览"
                              className="w-20 h-20 object-cover rounded-lg border"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                            <button
                              onClick={() => setNovelaiVibeImage('')}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs"
                            >
                              ×
                            </button>
                          </div>
                        )}
                        
                        <div>
                          <label className="text-xs text-indigo-600 mb-1 block">
                            风格强度: {novelaiVibeStrength.toFixed(2)}
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.05"
                            value={novelaiVibeStrength}
                            onChange={(e) => setNovelaiVibeStrength(parseFloat(e.target.value))}
                            className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        <p className="text-xs text-gray-400">
                          💡 Vibe Transfer会提取参考图的风格特征应用到新生成的图片
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 text-center">
                    💡 这些功能需要NovelAI订阅支持，图片URL可以使用图床或base64
                  </p>
                </div>
              )}
            </div>

            {/* Test Button */}
            <button
              onClick={testNovelaiConnection}
              disabled={testingNovelai || !novelaiKey}
              className="w-full py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {testingNovelai ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4 text-pink-500" />
              )}
              测试NovelAI连接
            </button>

            {/* Save Button */}
            <Button
              onClick={saveNovelaiSettings}
              disabled={!novelaiKey}
              className="w-full py-6 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 text-white font-medium shadow-lg hover:shadow-xl transition-all"
            >
              保存NovelAI配置
            </Button>
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