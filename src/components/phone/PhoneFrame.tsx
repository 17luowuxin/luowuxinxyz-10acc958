import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PhoneFrameProps {
  children: React.ReactNode;
}

const PhoneFrame: React.FC<PhoneFrameProps> = ({ children }) => {
  const { user } = useAuth();
  const [globalBg, setGlobalBg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from('customization')
        .select('global_background_url')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.global_background_url) {
            setGlobalBg(data.global_background_url);
          }
        });
    }
  }, [user]);

  return (
    <div 
      className="min-h-screen"
      style={{
        backgroundImage: globalBg 
          ? `url(${globalBg})` 
          : 'linear-gradient(135deg, hsl(var(--candy-purple)/0.2), hsl(var(--background)), hsl(var(--candy-pink)/0.2))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full min-h-screen overflow-hidden relative"
        style={{ backgroundColor: globalBg ? 'transparent' : undefined }}
      >
        {/* Content */}
        <div className="h-full min-h-screen overflow-hidden">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

export default PhoneFrame;
