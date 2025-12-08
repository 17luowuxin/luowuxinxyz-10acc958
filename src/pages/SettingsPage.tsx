import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Key, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [deepseekKey, setDeepseekKey] = useState('');

  useEffect(() => {
    if (user) fetchApiKeys();
  }, [user]);

  const fetchApiKeys = async () => {
    const { data } = await supabase.from('api_keys').select('*').eq('user_id', user?.id);
    const dk = data?.find(k => k.provider === 'deepseek');
    if (dk) setDeepseekKey(dk.api_key);
  };

  const saveApiKey = async (provider: string, key: string) => {
    if (!user) return;
    const { data: existing } = await supabase.from('api_keys').select('id').eq('user_id', user.id).eq('provider', provider).single();
    if (existing) {
      await supabase.from('api_keys').update({ api_key: key }).eq('id', existing.id);
    } else {
      await supabase.from('api_keys').insert({ user_id: user.id, provider, api_key: key });
    }
    toast.success('API密钥已保存');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-xl font-bold ml-2">设置</h1>
      </div>

      <div className="space-y-6">
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">API密钥管理</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">DeepSeek API</label>
              <div className="flex gap-2 mt-1">
                <Input type="password" value={deepseekKey} onChange={(e) => setDeepseekKey(e.target.value)} placeholder="sk-..." />
                <Button onClick={() => saveApiKey('deepseek', deepseekKey)}>保存</Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">不填写则使用内置AI模型</p>
        </div>

        <Button variant="outline" className="w-full text-destructive" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />退出登录
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
