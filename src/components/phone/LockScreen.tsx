import React, { useCallback, useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ChevronUp, ImagePlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  getLocalAssetUrl,
  getLocalTable,
  isLocalModeEnabled,
  saveLocalAsset,
  upsertLocalRow,
} from '@/lib/localDataStore';

interface LockScreenProps {
  onUnlock: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localMode, setLocalMode] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [-150, 0], [0, 1]);
  const scale = useTransform(y, [-150, 0], [0.9, 1]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) {
      setLocalMode(false);
      return;
    }
    isLocalModeEnabled(user.id).then(setLocalMode);
  }, [user]);

  const fetchCustomization = useCallback(async () => {
    if (!user) return;
    const result = localMode
      ? { data: (await getLocalTable(user.id, 'customization')).find((row) => row.user_id === user.id), error: null }
      : await supabase
          .from('customization')
          .select('lock_screen_bg_url')
          .eq('user_id', user.id)
          .maybeSingle();
    const { data, error } = result;

    if (error) {
      console.error('Fetch lock screen customization error:', error);
      return;
    }

    const imageUrl = data?.lock_screen_bg_url ? String(data.lock_screen_bg_url) : null;
    setBgUrl(imageUrl && localMode ? await getLocalAssetUrl(user.id, imageUrl) : imageUrl);
  }, [localMode, user]);

  useEffect(() => {
    if (user && localMode !== null) {
      fetchCustomization();
    }
  }, [fetchCustomization, localMode, user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setUploading(true);
    try {
      if (localMode) {
        const sourceUrl = `local-asset://lockscreen-${crypto.randomUUID()}`;
        await saveLocalAsset(user.id, sourceUrl, file);
        await upsertLocalRow(
          user.id,
          'customization',
          (row) => row.user_id === user.id,
          { user_id: user.id, lock_screen_bg_url: sourceUrl },
        );
        setBgUrl(await getLocalAssetUrl(user.id, sourceUrl));
        toast.success('锁屏背景已更新');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/lockscreen-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '0',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const nextUrl = publicUrl + '?t=' + Date.now();

      await supabase
        .from('customization')
        .upsert(
          {
            user_id: user.id,
            lock_screen_bg_url: nextUrl,
          },
          { onConflict: 'user_id' }
        );

      setBgUrl(nextUrl);

      toast.success('锁屏背景已更新');
    } catch (error) {
      console.error('Lock screen upload error:', error);
      toast.error('上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragEnd = (_: any, info: { offset: { y: number }; velocity: { y: number } }) => {
    // 需要用户明确向上滑动超过150px且速度足够快才解锁
    // 提高阈值避免意外触发
    if (info.offset.y < -150 && info.velocity.y < -200) {
      animate(y, -300, { duration: 0.3 });
      setTimeout(onUnlock, 300);
    } else {
      animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  return (
    <motion.div
      style={{ y, opacity, scale }}
      drag="y"
      dragConstraints={{ top: -300, bottom: 0 }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between cursor-grab active:cursor-grabbing"
    >
      {bgUrl ? (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgUrl})` }}
          >
            <div className="absolute inset-0 bg-black/30" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-candy-purple via-candy-pink to-candy-orange" />
        )}

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-float" />
        <div className="absolute top-40 right-10 w-24 h-24 bg-white/15 rounded-full blur-xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-40 left-20 w-20 h-20 bg-white/10 rounded-full blur-xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Upload buttons */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
      
      <div className="absolute top-16 right-4 z-50">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
          title="上传静态壁纸"
        >
          <ImagePlus className="w-5 h-5" />
        </button>
      </div>

      {/* Time display - moved up */}
      <div className="relative z-10 flex flex-col items-center pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="lock-screen-text text-7xl font-bold tracking-tight">
            {formatTime(time)}
          </h1>
          <p className="lock-screen-text text-xl mt-4 opacity-90 font-medium">
            {formatDate(time)}
          </p>
        </motion.div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Unlock hint */}
      <motion.div
        className="relative z-10 pb-16 flex flex-col items-center lock-screen-text/80"
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        <ChevronUp className="w-8 h-8" />
        <p className="text-sm font-medium mt-1 lock-screen-text">上滑解锁</p>
      </motion.div>
    </motion.div>
  );
};

export default LockScreen;
