import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nickname, setNickname] = useState('');
  const [persona, setPersona] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user?.id).single();
    if (data) {
      setNickname(data.nickname || '');
      setPersona(data.persona || '');
      setAvatarUrl(data.avatar_url || '');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const filePath = `${user.id}/avatar-${Date.now()}`;
    await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
    setAvatarUrl(publicUrl);
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', user.id);
    toast.success('头像已更新');
  };

  const handleSave = async () => {
    await supabase.from('profiles').update({ nickname, persona }).eq('user_id', user?.id);
    toast.success('资料已保存');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-xl font-bold ml-2">我的资料</h1>
      </div>

      <div className="flex flex-col items-center mb-8">
        <label className="relative cursor-pointer">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-candy-pink to-candy-purple flex items-center justify-center overflow-hidden">
            {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-white" />}
          </div>
          <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </label>
        <p className="text-sm text-muted-foreground mt-2">点击更换头像</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">昵称</label>
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="你的昵称" className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">人设设定</label>
          <Textarea value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="描述你自己，AI好友会了解你..." className="mt-1" rows={4} />
        </div>
        <Button variant="candy" className="w-full" onClick={handleSave}>保存</Button>
      </div>
    </div>
  );
};

export default ProfilePage;
