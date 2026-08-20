import React, { useEffect, useState, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalAssetUrl, getLocalTable, isLocalModeEnabled } from '@/lib/localDataStore';

interface PhoneFrameProps {
  children: React.ReactNode;
}

// 使用 memo 优化，避免不必要的重渲染
const PhoneFrame: React.FC<PhoneFrameProps> = memo(({ children }) => {
  const { user } = useAuth();
  const [globalBg, setGlobalBg] = useState<string | null>(null);
  const [videoBg, setVideoBg] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localMode, setLocalMode] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setLocalMode(false);
      return;
    }
    isLocalModeEnabled(user.id).then(setLocalMode);
  }, [user]);

  useEffect(() => {
    if (user && localMode !== null) {
      // 使用缓存优先策略
      const cacheKey = `bg_${user.id}_${localMode ? 'local' : 'cloud'}`;
      const cached = sessionStorage.getItem(cacheKey);
      
      if (cached) {
        try {
          const data = JSON.parse(cached);
          setGlobalBg(data.global_background_url || null);
          setVideoBg(data.video_background_url || null);
          return;
        } catch {
          sessionStorage.removeItem(cacheKey);
        }
      }
      
      const loadLatest = async () => {
        const data = localMode
          ? (await getLocalTable(user.id, 'customization')).find((row) => row.user_id === user.id)
          : (await supabase
              .from('customization')
              .select('global_background_url, video_background_url')
              .eq('user_id', user.id)
              .maybeSingle()).data;
        if (!data) return;
        const typedData = data as { global_background_url?: string; video_background_url?: string };
        const resolvedData = localMode
          ? {
              global_background_url: typedData.global_background_url
                ? await getLocalAssetUrl(user.id, typedData.global_background_url)
                : undefined,
              video_background_url: typedData.video_background_url
                ? await getLocalAssetUrl(user.id, typedData.video_background_url)
                : undefined,
            }
          : typedData;
        sessionStorage.setItem(cacheKey, JSON.stringify(resolvedData));
        setGlobalBg(resolvedData.global_background_url || null);
        setVideoBg(resolvedData.video_background_url || null);
      };
      loadLatest();
    }
  }, [user, localMode]);

  // 优化视频播放 - 仅在视频URL变化时加载
  useEffect(() => {
    if (videoBg && videoRef.current) {
      setVideoError(false);
      setVideoLoaded(false);
      
      const video = videoRef.current;
      
      // 重置视频
      video.load();
      
      // 尝试播放
      const playVideo = async () => {
        try {
          await video.play();
        } catch (err) {
          console.log('Video autoplay failed, will play on interaction');
        }
      };
      
      playVideo();
    }
  }, [videoBg]);

  // 处理视频错误
  const handleVideoError = () => {
    console.error('Video playback error');
    setVideoError(true);
    setVideoLoaded(false);
  };

  // 处理视频加载成功
  const handleVideoLoaded = () => {
    setVideoLoaded(true);
    setVideoError(false);
  };

  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{
        // 适配 PWA 安全区域
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* 视频背景 - 优先显示，添加硬件加速 */}
      {videoBg && !videoError && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          onLoadedData={handleVideoLoaded}
          onError={handleVideoError}
          onCanPlay={handleVideoLoaded}
          className={`fixed inset-0 w-full h-full object-cover -z-10 transition-opacity duration-300 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ 
            transform: 'translateZ(0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden'
          }}
        >
          <source src={videoBg} type="video/mp4" />
          <source src={videoBg} type="video/webm" />
        </video>
      )}
      
      {/* 图片背景 - 视频不存在、未加载或出错时显示 */}
      {(!videoBg || !videoLoaded || videoError) && (
        <div 
          className="fixed inset-0 -z-10 transition-opacity duration-300"
          style={{
            backgroundImage: globalBg 
              ? `url(${globalBg})` 
              : 'linear-gradient(135deg, hsl(var(--candy-purple)/0.2), hsl(var(--background)), hsl(var(--candy-pink)/0.2))',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: 'translateZ(0)',
            willChange: 'transform'
          }}
        />
      )}
      
      {/* 内容区域 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full min-h-screen overflow-hidden relative"
        style={{
          minHeight: 'calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="h-full min-h-screen overflow-hidden">
          {children}
        </div>
      </motion.div>
    </div>
  );
});

PhoneFrame.displayName = 'PhoneFrame';

export default PhoneFrame;
