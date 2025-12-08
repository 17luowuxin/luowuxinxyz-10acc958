import React from 'react';
import { motion } from 'framer-motion';

interface PhoneFrameProps {
  children: React.ReactNode;
}

const PhoneFrame: React.FC<PhoneFrameProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-candy-purple/20 via-background to-candy-pink/20">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full min-h-screen bg-background overflow-hidden relative"
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
