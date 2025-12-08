import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Key, LogOut, Check, X, Loader2, Globe, Eye, EyeOff, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('https://api.deepseek.com/v1');
  const [customModel, setCustomModel] = useState('deepseek-chat');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    if (user) fetchApiKeys();
  }, [user]);

  const fetchApiKeys = async () => {
    const { data } = await supabase.from('api_keys').select('*').eq('user_id', user?.id);
    if (data) {
      const customKey = data.find(k => k.provider === 'custom');
      const baseUrl = data.find(k => k.provider === 'custom_base_url');
      const model = data.find(k => k.provider === 'custom_model');
      
      if (customKey) {
        setApiKey(customKey.api_key);
        setIsConfigured(true);
      }
      if (baseUrl) setCustomBaseUrl(baseUrl.api_key);
      if (model) setCustomModel(model.api_key);
    }
  };

  const saveSettings = async () => {
    if (!user || !apiKey.trim()) {
      toast.error('请输入API密钥');
      return;
    }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50/50 to-pink-100/30">
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

          {/* Form Fields */}
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

            {/* Model Name */}
            <div>
              <label className="text-sm font-medium text-purple-600 mb-2 block">
                Model Name
              </label>
              <Input
                placeholder="deepseek-chat"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                className="rounded-2xl bg-white border-gray-200 h-12 text-gray-700 placeholder:text-gray-400"
              />
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
    </div>
  );
};

export default SettingsPage;