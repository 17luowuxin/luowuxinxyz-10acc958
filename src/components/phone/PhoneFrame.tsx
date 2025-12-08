import React from 'react';
import { motion } from 'framer-motion';

interface PhoneFrameProps {
  children: React.ReactNode;
}

const PhoneFrame: React.FC<PhoneFrameProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-candy-purple/20 via-background to-candy-pink/20 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md h-[90vh] max-h-[800px] bg-background rounded-[3rem] shadow-2xl overflow-hidden relative border-4 border-foreground/10"
      >
        {/* Dynamic Island / Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-7 bg-foreground/90 rounded-full z-50" />
        
        {/* Content */}
        <div className="h-full overflow-hidden">
          {children}
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-foreground/20 rounded-full" />
      </motion.div>
    </div>
  );
};

export default PhoneFrame;
