import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LockScreen from '@/components/phone/LockScreen';
import HomeScreen from '@/components/phone/HomeScreen';
import PhoneFrame from '@/components/phone/PhoneFrame';
import AnnouncementDialog, { shouldShowAnnouncement, markAnnouncementShown } from '@/components/AnnouncementDialog';

// 检查本次会话是否已经解锁过
const hasUnlockedThisSession = (): boolean => {
  return sessionStorage.getItem('phone_unlocked') === 'true';
};

const markUnlocked = () => {
  sessionStorage.setItem('phone_unlocked', 'true');
};

const markLocked = () => {
  sessionStorage.removeItem('phone_unlocked');
};

const Index: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // 只有首次加载且未解锁过才显示锁屏
  const [isLocked, setIsLocked] = useState(() => !hasUnlockedThisSession());
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // Show announcement after login (with frequency control)
  useEffect(() => {
    if (user && !loading && shouldShowAnnouncement()) {
      // Delay slightly to let the UI settle
      const timer = setTimeout(() => {
        setShowAnnouncement(true);
        markAnnouncementShown();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Handle explicit lock via URL parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('locked') === 'true') {
      // 明确请求锁屏
      markLocked();
      setIsLocked(true);
      navigate('/', { replace: true });
    } else if (location.pathname === '/lock') {
      markLocked();
      setIsLocked(true);
      navigate('/', { replace: true });
    }
    // 不再自动根据 /home 解锁，避免导航时意外状态变化
  }, [location.pathname, location.search, navigate]);

  // 解锁处理函数
  const handleUnlock = () => {
    markUnlocked();
    setIsLocked(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-candy-purple via-candy-pink to-candy-orange flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <PhoneFrame>
        {isLocked ? (
          <LockScreen onUnlock={handleUnlock} />
        ) : (
          <HomeScreen />
        )}
      </PhoneFrame>
      
      <AnnouncementDialog 
        open={showAnnouncement} 
        onOpenChange={setShowAnnouncement} 
      />
    </>
  );
};

export default Index;
