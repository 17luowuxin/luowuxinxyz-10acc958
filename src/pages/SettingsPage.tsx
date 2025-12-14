import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Key, LogOut, Check, Loader2, Globe, Eye, EyeOff, TestTube, RefreshCw, ChevronDown, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { APP_VERSION, BUILD_DATE, CHANGELOG } from '@/config/version';

const DEFAULT_MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek', description: '强大的通用对话模型' },
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
  const [historyLimit, setHistoryLimit] = useState(10);

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
      const historyLimitSetting = data.find(k => k.provider === 'history_limit');
      
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
      if (historyLimitSetting) {
        setHistoryLimit(Number(historyLimitSetting.api_key) || 10);
      }
      
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

        {/* History Limit Setting */}
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-blue-100/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
              <span className="text-lg">💬</span>
            </div>
            <div>
              <h2 className="font-bold text-gray-800">历史消息数量</h2>
              <p className="text-xs text-gray-500">限制发送给AI的历史消息数量，越少回复越快</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">当前设置: <span className="font-bold text-purple-600">{historyLimit}条</span></span>
              <span className="text-xs text-gray-400">推荐: 5-10条</span>
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              {[3, 5, 10, 15, 20].map((limit) => (
                <button
                  key={limit}
                  onClick={async () => {
                    if (!user) return;
                    setHistoryLimit(limit);
                    
                    const { data: existing } = await supabase
                      .from('api_keys')
                      .select('id')
                      .eq('user_id', user.id)
                      .eq('provider', 'history_limit')
                      .single();
                    
                    if (existing) {
                      await supabase.from('api_keys').update({ api_key: String(limit) }).eq('id', existing.id);
                    } else {
                      await supabase.from('api_keys').insert({ user_id: user.id, provider: 'history_limit', api_key: String(limit) });
                    }
                    
                    toast.success(`已设置历史消息为 ${limit} 条`);
                  }}
                  className={`py-3 rounded-xl font-medium transition-all ${
                    historyLimit === limit
                      ? 'bg-gradient-to-r from-blue-400 to-cyan-400 text-white shadow-lg'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {limit}
                </button>
              ))}
            </div>
            
            <p className="text-xs text-gray-400 text-center">
              💡 消息越少，AI回复越快，但可能记不住之前的对话内容
            </p>
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