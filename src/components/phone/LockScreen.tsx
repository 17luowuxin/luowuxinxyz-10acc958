import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ChevronUp, ImagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LockScreenProps {
  onUnlock: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [-150, 0], [0, 1]);
  const scale = useTransform(y, [-150, 0], [0.9, 1]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      fetchCustomization();
    }
  }, [user]);

  const fetchCustomization = async () => {
    const { data } = await supabase
      .from('customization')
      .select('lock_screen_bg_url')
      .eq('user_id', user!.id)
      .single();
    
    if (data?.lock_screen_bg_url) {
      setBgUrl(data.lock_screen_bg_url);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/lockscreen.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('backgrounds')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(fileName);

      await supabase
        .from('customization')
        .update({ lock_screen_bg_url: publicUrl })
        .eq('user_id', user.id);

      setBgUrl(publicUrl);
      toast.success('锁屏背景已更新');
    } catch (error) {
      toast.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDragEnd = (_: any, info: { offset: { y: number } }) => {
    if (info.offset.y < -100) {
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
      {/* Background */}
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

      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="absolute top-16 right-6 z-50 p-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
      >
        <ImagePlus className="w-5 h-5" />
      </button>

      {/* Time display - moved up */}
      <div className="relative z-10 flex flex-col items-center pt-24 text-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-7xl font-bold tracking-tight drop-shadow-lg">
            {formatTime(time)}
          </h1>
          <p className="text-xl mt-4 opacity-90 font-medium">
            {formatDate(time)}
          </p>
        </motion.div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Unlock hint */}
      <motion.div
        className="relative z-10 pb-16 flex flex-col items-center text-white/80"
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        <ChevronUp className="w-8 h-8" />
        <p className="text-sm font-medium mt-1">上滑解锁</p>
      </motion.div>
    </motion.div>
  );
};

export default LockScreen;
