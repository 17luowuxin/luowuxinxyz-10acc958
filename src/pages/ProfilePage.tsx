import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
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
    
    try {
      const { compressImage, blobToFile } = await import('@/utils/imageCompressor');
      const compressedBlob = await compressImage(file, 512, 0.85);
      const compressedFile = blobToFile(compressedBlob, file.name);
      
      const filePath = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, compressedFile, { upsert: true });
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        toast.error('头像上传失败: ' + uploadError.message);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(publicUrl);
      
      // 更新 profile 头像
      await saveProfile({ avatar_url: publicUrl });
      toast.success('头像已更新');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('头像上传失败');
    }
  };

  const saveProfile = async (extraFields: Record<string, string> = {}) => {
    if (!user) return false;
    
    // 先查是否存在
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    const payload = { nickname, persona, ...extraFields };
    
    let error;
    if (existing) {
      ({ error } = await supabase.from('profiles').update(payload).eq('user_id', user.id));
    } else {
      ({ error } = await supabase.from('profiles').insert({ user_id: user.id, ...payload }));
    }
    
    if (error) {
      console.error('Profile save error:', error);
      toast.error('保存失败: ' + error.message);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    const ok = await saveProfile();
    if (ok) toast.success('资料已保存');
  };

  return (
    <div className="min-h-screen bg-background/80 backdrop-blur-sm p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/home')}><ChevronLeft className="w-6 h-6" /></Button>
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
