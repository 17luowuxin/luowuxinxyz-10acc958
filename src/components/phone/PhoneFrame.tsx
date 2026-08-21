import React, { useEffect, useState, memo } from 'react';
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
              .select('global_background_url')
              .eq('user_id', user.id)
              .maybeSingle()).data;
        if (!data) return;
        const typedData = data as { global_background_url?: string };
        const resolvedData = localMode
          ? {
              global_background_url: typedData.global_background_url
                ? await getLocalAssetUrl(user.id, typedData.global_background_url)
                : undefined,
            }
          : typedData;
        sessionStorage.setItem(cacheKey, JSON.stringify(resolvedData));
        setGlobalBg(resolvedData.global_background_url || null);
      };
      loadLatest();
    }
  }, [user, localMode]);

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
