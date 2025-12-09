import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PhoneFrameProps {
  children: React.ReactNode;
}

const PhoneFrame: React.FC<PhoneFrameProps> = ({ children }) => {
  const { user } = useAuth();
  const [globalBg, setGlobalBg] = useState<string | null>(null);
  const [videoBg, setVideoBg] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (user) {
      // 使用缓存优先策略
      const cacheKey = `bg_${user.id}`;
      const cached = sessionStorage.getItem(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached);
        if (data.global_background_url) setGlobalBg(data.global_background_url);
        if (data.video_background_url) setVideoBg(data.video_background_url);
      }
      
      // 同时从数据库获取最新数据
      supabase
        .from('customization')
        .select('global_background_url, video_background_url')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            sessionStorage.setItem(cacheKey, JSON.stringify(data));
            if (data.global_background_url) setGlobalBg(data.global_background_url);
            if (data.video_background_url) setVideoBg(data.video_background_url);
          }
        });
    }
  }, [user]);

  // 预加载视频
  useEffect(() => {
    if (videoBg && videoRef.current) {
      videoRef.current.load();
    }
  }, [videoBg]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 视频背景 - 优先显示 */}
      {videoBg && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedData={() => setVideoLoaded(true)}
          className={`fixed inset-0 w-full h-full object-cover -z-10 transition-opacity duration-300 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
        >
          <source src={videoBg} type="video/mp4" />
          <source src={videoBg} type="video/webm" />
        </video>
      )}
      
      {/* 图片背景 - 视频不存在或未加载时显示 */}
      {(!videoBg || !videoLoaded) && (
        <div 
          className="fixed inset-0 -z-10 transition-opacity duration-300"
          style={{
            backgroundImage: globalBg 
              ? `url(${globalBg})` 
              : 'linear-gradient(135deg, hsl(var(--candy-purple)/0.2), hsl(var(--background)), hsl(var(--candy-pink)/0.2))',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      
      {/* 内容区域 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full min-h-screen overflow-hidden relative"
      >
        <div className="h-full min-h-screen overflow-hidden">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

export default PhoneFrame;