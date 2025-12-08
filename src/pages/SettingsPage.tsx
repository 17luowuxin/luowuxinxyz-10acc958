import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Key, LogOut, Check, X, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ApiProvider {
  id: string;
  name: string;
  placeholder: string;
  color: string;
  icon: string;
}

const API_PROVIDERS: ApiProvider[] = [
  { 
    id: 'deepseek', 
    name: 'DeepSeek', 
    placeholder: 'sk-...', 
    color: 'from-blue-400 to-blue-600',
    icon: '🔮'
  },
  { 
    id: 'openai', 
    name: 'OpenAI', 
    placeholder: 'sk-...', 
    color: 'from-emerald-400 to-teal-500',
    icon: '🤖'
  },
  { 
    id: 'anthropic', 
    name: 'Claude', 
    placeholder: 'sk-ant-...', 
    color: 'from-orange-400 to-rose-500',
    icon: '🧠'
  },
  { 
    id: 'custom', 
    name: '自定义API', 
    placeholder: '输入API密钥', 
    color: 'from-purple-400 to-pink-500',
    icon: '⚡'
  },
];

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'failed' | null>>({});

  useEffect(() => {
    if (user) fetchApiKeys();
  }, [user]);

  const fetchApiKeys = async () => {
    const { data } = await supabase.from('api_keys').select('*').eq('user_id', user?.id);
    if (data) {
      const keys: Record<string, string> = {};
      data.forEach(k => {
        keys[k.provider] = k.api_key;
      });
      setApiKeys(keys);
      
      const custom = data.find(k => k.provider === 'custom_base_url');
      if (custom) setCustomBaseUrl(custom.api_key);
      const customM = data.find(k => k.provider === 'custom_model');
      if (customM) setCustomModel(customM.api_key);
    }
  };

  const saveApiKey = async (provider: string, key: string) => {
    if (!user || !key.trim()) return;
    
    const { data: existing } = await supabase
      .from('api_keys')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();
    
    if (existing) {
      await supabase.from('api_keys').update({ api_key: key }).eq('id', existing.id);
    } else {
      await supabase.from('api_keys').insert({ user_id: user.id, provider, api_key: key });
    }
    
    setApiKeys(prev => ({ ...prev, [provider]: key }));
    toast.success(`${provider} API密钥已保存`);
  };

  const testConnection = async (provider: ApiProvider) => {
    const key = apiKeys[provider.id];
    if (!key) {
      toast.error('请先输入并保存API密钥');
      return;
    }

    setTestingProvider(provider.id);
    setTestResults(prev => ({ ...prev, [provider.id]: null }));

    try {
      const { data, error } = await supabase.functions.invoke('test-api-connection', {
        body: {
          provider: provider.id,
          apiKey: key,
          baseUrl: customBaseUrl,
          model: customModel,
        },
      });

      if (error) {
        console.error('Test connection error:', error);
        setTestResults(prev => ({ ...prev, [provider.id]: 'failed' }));
        toast.error(`连接失败: ${error.message}`);
        return;
      }

      if (data.success) {
        setTestResults(prev => ({ ...prev, [provider.id]: 'success' }));
        toast.success(`${provider.name} 连接成功！`);
      } else {
        setTestResults(prev => ({ ...prev, [provider.id]: 'failed' }));
        toast.error(`连接失败: ${data.error}`);
      }
    } catch (error) {
      console.error('Connection test error:', error);
      setTestResults(prev => ({ ...prev, [provider.id]: 'failed' }));
      toast.error('连接测试失败，请稍后重试');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 via-purple-50 to-pink-100 p-4">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/')}
          className="rounded-full bg-white/60 backdrop-blur-sm shadow-sm"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </Button>
        <h1 className="text-xl font-bold ml-3 text-gray-700">设置</h1>
      </div>

      <div className="space-y-4">
        {/* AI模型配置卡片 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-white/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-700">AI模型配置</h2>
              <p className="text-xs text-gray-400">配置您的API密钥连接AI服务</p>
            </div>
          </div>

          <div className="space-y-4">
            {API_PROVIDERS.map((provider) => (
              <div 
                key={provider.id} 
                className="bg-white/80 rounded-2xl p-4 border border-gray-100 shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{provider.icon}</span>
                    <span className="font-medium text-gray-700">{provider.name}</span>
                  </div>
                  {testResults[provider.id] === 'success' && (
                    <span className="flex items-center gap-1 text-xs text-green-500 bg-green-50 px-2 py-1 rounded-full">
                      <Check className="w-3 h-3" /> 已连接
                    </span>
                  )}
                  {testResults[provider.id] === 'failed' && (
                    <span className="flex items-center gap-1 text-xs text-red-500 bg-red-50 px-2 py-1 rounded-full">
                      <X className="w-3 h-3" /> 连接失败
                    </span>
                  )}
                </div>
                
                {provider.id === 'custom' && (
                  <div className="space-y-2 mb-3">
                    <Input
                      placeholder="API Base URL"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      onBlur={() => customBaseUrl && saveApiKey('custom_base_url', customBaseUrl)}
                      className="text-sm rounded-xl bg-gray-50 border-gray-200"
                    />
                    <Input
                      placeholder="模型名称 (如: gpt-4)"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      onBlur={() => customModel && saveApiKey('custom_model', customModel)}
                      className="text-sm rounded-xl bg-gray-50 border-gray-200"
                    />
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={provider.placeholder}
                    value={apiKeys[provider.id] || ''}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                    className="flex-1 rounded-xl bg-gray-50 border-gray-200"
                  />
                  <Button
                    size="sm"
                    onClick={() => saveApiKey(provider.id, apiKeys[provider.id] || '')}
                    disabled={!apiKeys[provider.id]}
                    className={`rounded-xl bg-gradient-to-r ${provider.color} text-white border-0 shadow-md px-4`}
                  >
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testConnection(provider)}
                    disabled={!apiKeys[provider.id] || testingProvider === provider.id}
                    className="rounded-xl border-gray-200 px-3"
                  >
                    {testingProvider === provider.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      '测试'
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 退出登录按钮 */}
        <Button 
          variant="outline" 
          className="w-full rounded-2xl py-6 bg-white/70 backdrop-blur-sm border-red-200 text-red-500 hover:bg-red-50 shadow-sm" 
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          退出登录
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
