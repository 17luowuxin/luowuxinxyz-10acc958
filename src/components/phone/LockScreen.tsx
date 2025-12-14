import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ChevronUp, ImagePlus, Film } from 'lucide-react';
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
  const [videoBgUrl, setVideoBgUrl] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'image' | 'video'>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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

  // 优化视频播放
  useEffect(() => {
    if (videoBgUrl && videoRef.current) {
      setVideoError(false);
      setVideoLoaded(false);
      
      const video = videoRef.current;
      video.load();
      
      const playVideo = async () => {
        try {
          await video.play();
        } catch (err) {
          console.log('Lock screen video autoplay failed');
        }
      };
      
      playVideo();
    }
  }, [videoBgUrl]);

  const fetchCustomization = async () => {
    const { data } = await supabase
      .from('customization')
      .select('lock_screen_bg_url, lock_screen_video_url')
      .eq('user_id', user!.id)
      .single();
    
    if (data?.lock_screen_bg_url) {
      setBgUrl(data.lock_screen_bg_url);
    }
    if ((data as any)?.lock_screen_video_url) {
      setVideoBgUrl((data as any).lock_screen_video_url);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/lockscreen-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('backgrounds')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(fileName);

      await supabase
        .from('customization')
        .upsert({ 
          user_id: user.id,
          lock_screen_bg_url: publicUrl + '?t=' + Date.now()
        }, { onConflict: 'user_id' });

      setBgUrl(publicUrl + '?t=' + Date.now());
      toast.success('锁屏背景已更新');
    } catch (error) {
      console.error('Lock screen upload error:', error);
      toast.error('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('video/')) {
      toast.error('请选择视频文件 (MP4/WebM)');
      return;
    }

    // 限制文件大小 8MB
    if (file.size > 8 * 1024 * 1024) {
      toast.error('视频文件需小于8MB以保证流畅播放');
      return;
    }

    setUploading(true);
    toast.loading('上传中...');
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/lockscreen-video-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('backgrounds')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(fileName);

      await supabase
        .from('customization')
        .upsert({ 
          user_id: user.id,
          lock_screen_video_url: publicUrl + '?t=' + Date.now()
        } as any, { onConflict: 'user_id' });

      setVideoBgUrl(publicUrl + '?t=' + Date.now());
      toast.dismiss();
      toast.success('锁屏动态壁纸已更新');
    } catch (error) {
      console.error('Lock screen video upload error:', error);
      toast.dismiss();
      toast.error('上传失败，请重试');
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

  const handleVideoError = () => {
    setVideoError(true);
    setVideoLoaded(false);
  };

  const handleVideoLoaded = () => {
    setVideoLoaded(true);
    setVideoError(false);
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
      {/* Video Background - 优先显示动态壁纸 */}
      {videoBgUrl && !videoError && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          onLoadedData={handleVideoLoaded}
          onCanPlay={handleVideoLoaded}
          onError={handleVideoError}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ 
            transform: 'translateZ(0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden'
          }}
        >
          <source src={videoBgUrl} type="video/mp4" />
          <source src={videoBgUrl} type="video/webm" />
        </video>
      )}

      {/* Image Background - 视频不存在或加载失败时显示 */}
      {(!videoBgUrl || !videoLoaded || videoError) && (
        bgUrl ? (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgUrl})` }}
          >
            <div className="absolute inset-0 bg-black/30" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-candy-purple via-candy-pink to-candy-orange" />
        )
      )}

      {/* 遮罩层 - 让文字更清晰 */}
      {(videoBgUrl && videoLoaded) && (
        <div className="absolute inset-0 bg-black/20" />
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
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={handleVideoUpload}
      />
      
      <div className="absolute top-16 right-4 z-50 flex gap-2">
        <button
          onClick={() => videoInputRef.current?.click()}
          disabled={uploading}
          className="p-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
          title="上传动态壁纸"
        >
          <Film className="w-5 h-5" />
        </button>
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
