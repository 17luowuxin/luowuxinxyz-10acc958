import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getLocalTable, isLocalModeEnabled, upsertLocalRow } from '@/lib/localDataStore';

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsDataURL(blob);
  });

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nickname, setNickname] = useState('');
  const [persona, setPersona] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [localMode, setLocalMode] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setLocalMode(false);
      return;
    }
    isLocalModeEnabled(user.id).then(setLocalMode);
  }, [user]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const data = localMode
      ? (await getLocalTable(user.id, 'profiles')).find((row) => row.user_id === user.id)
      : (await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle()).data;
    if (data) {
      setNickname(String(data.nickname || ''));
      setPersona(String(data.persona || ''));
      setAvatarUrl(String(data.avatar_url || ''));
    }
  }, [localMode, user]);

  useEffect(() => {
    if (user && localMode !== null) fetchProfile();
  }, [fetchProfile, localMode, user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    try {
      const { compressImage, blobToFile } = await import('@/utils/imageCompressor');
      const compressedBlob = await compressImage(file, 512, 0.85);
      let nextAvatarUrl: string;

      if (localMode) {
        nextAvatarUrl = await blobToDataUrl(compressedBlob);
      } else {
        const compressedFile = blobToFile(compressedBlob, file.name);
        const filePath = `${user.id}/avatar-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, compressedFile, { upsert: true });
        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          toast.error('头像上传失败: ' + uploadError.message);
          return;
        }
        nextAvatarUrl = supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl;
      }

      setAvatarUrl(nextAvatarUrl);
      
      // 更新 profile 头像
      await saveProfile({ avatar_url: nextAvatarUrl });
      toast.success('头像已更新');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('头像上传失败');
    }
  };

  const saveProfile = async (extraFields: Record<string, string> = {}) => {
    if (!user) return false;
    const payload = { nickname, persona, ...extraFields };

    if (localMode) {
      await upsertLocalRow(
        user.id,
        'profiles',
        (row) => row.user_id === user.id,
        { id: user.id, user_id: user.id, ...payload },
      );
      return true;
    }
    
    // 先查是否存在
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    let error;
    if (existing) {
      ({ error } = await supabase.from('profiles').update(payload).eq('user_id', user.id));
    } else {
      ({ error } = await supabase.from('profiles').insert({ id: user.id, user_id: user.id, ...payload }));
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
