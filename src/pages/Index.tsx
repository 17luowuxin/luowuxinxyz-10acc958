import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LockScreen from '@/components/phone/LockScreen';
import HomeScreen from '@/components/phone/HomeScreen';
import PhoneFrame from '@/components/phone/PhoneFrame';

const Index: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
    <PhoneFrame>
      {isLocked ? (
        <LockScreen onUnlock={() => setIsLocked(false)} />
      ) : (
        <HomeScreen />
      )}
    </PhoneFrame>
  );
};

export default Index;
