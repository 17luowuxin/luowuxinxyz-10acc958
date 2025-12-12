import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Key, LogOut, Check, Loader2, Globe, Eye, EyeOff, TestTube, RefreshCw, ChevronDown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const DEFAULT_MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek', description: '强大的通用对话模型' },
  { id: 'qwen-plus', name: '通义千问', description: '阿里云通义千问模型' },
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
      
      if (useDefault && useDefault.api_key === 'true') {
        setUsingDefaultApi(true);
        setIsConfigured(true);
      } else if (customKey) {
        setApiKey(customKey.api_key);
        setIsConfigured(true);
      }
      if (baseUrl) setCustomBaseUrl(baseUrl.api_key);
      if (model) setCustomModel(model.api_key);
      if (defaultModelSetting) setDefaultModel(defaultModelSetting.api_key);
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
                  支持 OpenAI、Claude、通义千问、智谱、Deepseek 等兼容 OpenAI 格式的 API
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
                <div className="relative">
                  <Input
                    placeholder="deepseek-chat"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    onFocus={() => availableModels.length > 0 && setShowModelDropdown(true)}
                    className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400 pr-10"
                  />
                  {availableModels.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <ChevronDown className={`w-5 h-5 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                
                {/* Model Dropdown */}
                {showModelDropdown && availableModels.length > 0 && (
                  <div className="relative z-[100]">
                    <div className="absolute w-full mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto">
                      {availableModels.map((model, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            selectModel(model);
                          }}
                          className={`w-full px-4 py-3 text-left text-sm hover:bg-purple-50 transition-colors ${
                            model === customModel ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-700'
                          } ${index === 0 ? 'rounded-t-2xl' : ''} ${index === availableModels.length - 1 ? 'rounded-b-2xl' : ''}`}
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {availableModels.length > 0 && !showModelDropdown && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    已获取 {availableModels.length} 个可用模型，点击输入框或下拉按钮选择
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

        {/* Logout Button */}
        <Button 
          variant="outline" 
          className="w-full rounded-2xl py-5 bg-white/60 backdrop-blur-sm border-red-200 text-red-500 hover:bg-red-50" 
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          退出登录
        </Button>
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