import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ChevronUp } from 'lucide-react';

interface LockScreenProps {
  onUnlock: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [time, setTime] = useState(new Date());
  const y = useMotionValue(0);
  const opacity = useTransform(y, [-150, 0], [0, 1]);
  const scale = useTransform(y, [-150, 0], [0.9, 1]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-br from-candy-purple via-candy-pink to-candy-orange cursor-grab active:cursor-grabbing"
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-float" />
        <div className="absolute top-40 right-10 w-24 h-24 bg-white/15 rounded-full blur-xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-40 left-20 w-20 h-20 bg-white/10 rounded-full blur-xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Time display */}
      <div className="flex-1 flex flex-col items-center justify-center text-white pt-20">
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

      {/* Unlock hint */}
      <motion.div
        className="pb-16 flex flex-col items-center text-white/80"
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
