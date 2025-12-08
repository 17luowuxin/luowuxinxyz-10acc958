import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Key, LogOut, Check, X, Loader2, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ApiProvider {
  id: string;
  name: string;
  placeholder: string;
  baseUrl: string;
  testModel: string;
}

const API_PROVIDERS: ApiProvider[] = [
  { 
    id: 'deepseek', 
    name: 'DeepSeek', 
    placeholder: 'sk-...', 
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    testModel: 'deepseek-chat'
  },
  { 
    id: 'openai', 
    name: 'OpenAI', 
    placeholder: 'sk-...', 
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    testModel: 'gpt-3.5-turbo'
  },
  { 
    id: 'anthropic', 
    name: 'Anthropic Claude', 
    placeholder: 'sk-ant-...', 
    baseUrl: 'https://api.anthropic.com/v1/messages',
    testModel: 'claude-3-haiku-20240307'
  },
  { 
    id: 'custom', 
    name: '自定义 API', 
    placeholder: '输入API密钥', 
    baseUrl: '',
    testModel: ''
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
      
      // Load custom settings
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
      toast.error('请先输入API密钥');
      return;
    }

    setTestingProvider(provider.id);
    setTestResults(prev => ({ ...prev, [provider.id]: null }));

    try {
      let response: Response;
      
      if (provider.id === 'anthropic') {
        response = await fetch(provider.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: provider.testModel,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
      } else if (provider.id === 'custom') {
        const baseUrl = customBaseUrl || 'https://api.openai.com/v1/chat/completions';
        const model = customModel || 'gpt-3.5-turbo';
        
        response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
      } else {
        response = await fetch(provider.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: provider.testModel,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
      }

      if (response.ok || response.status === 200) {
        setTestResults(prev => ({ ...prev, [provider.id]: 'success' }));
        toast.success(`${provider.name} 连接成功！`);
      } else {
        const error = await response.text();
        console.error('API test error:', error);
        setTestResults(prev => ({ ...prev, [provider.id]: 'failed' }));
        toast.error(`${provider.name} 连接失败`);
      }
    } catch (error) {
      console.error('Connection test error:', error);
      setTestResults(prev => ({ ...prev, [provider.id]: 'failed' }));
      toast.error(`${provider.name} 连接失败，请检查网络或API密钥`);
    } finally {
      setTestingProvider(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold ml-2">设置</h1>
      </div>

      <div className="space-y-4">
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">AI模型配置</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            配置您的API密钥后，所有AI功能将使用您的模型。不填写则使用内置模型。
          </p>

          <div className="space-y-4">
            {API_PROVIDERS.map((provider) => (
              <div key={provider.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{provider.name}</label>
                  {testResults[provider.id] === 'success' && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <Check className="w-3 h-3" /> 已连接
                    </span>
                  )}
                  {testResults[provider.id] === 'failed' && (
                    <span className="flex items-center gap-1 text-xs text-red-500">
                      <X className="w-3 h-3" /> 连接失败
                    </span>
                  )}
                </div>
                
                {provider.id === 'custom' && (
                  <div className="space-y-2 mb-2">
                    <Input
                      placeholder="API Base URL (如: https://api.xxx.com/v1/chat/completions)"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      onBlur={() => customBaseUrl && saveApiKey('custom_base_url', customBaseUrl)}
                      className="text-sm"
                    />
                    <Input
                      placeholder="模型名称 (如: gpt-4)"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      onBlur={() => customModel && saveApiKey('custom_model', customModel)}
                      className="text-sm"
                    />
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={provider.placeholder}
                    value={apiKeys[provider.id] || ''}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveApiKey(provider.id, apiKeys[provider.id] || '')}
                    disabled={!apiKeys[provider.id]}
                  >
                    保存
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => testConnection(provider)}
                    disabled={!apiKeys[provider.id] || testingProvider === provider.id}
                  >
                    {testingProvider === provider.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Server className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button variant="outline" className="w-full text-destructive" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          退出登录
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
