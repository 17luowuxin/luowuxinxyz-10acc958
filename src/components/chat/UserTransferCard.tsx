import React from 'react';
import { motion } from 'framer-motion';
import { Gift, Check } from 'lucide-react';
import transferBg from '@/assets/transfer-card-bg.jpg';

interface UserTransferCardProps {
  amount: number;
  giftName: string;
  characterName: string;
  message?: string;
}

const UserTransferCard: React.FC<UserTransferCardProps> = ({
  amount,
  giftName,
  characterName,
  message
}) => {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="w-full max-w-[220px] rounded-lg overflow-hidden shadow-md relative"
    >
      {/* Header with background */}
      <div 
        className="relative px-3 py-2.5"
        style={{
          backgroundImage: `url(${transferBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="relative z-10 flex items-start gap-2">
          <div className="w-7 h-7 rounded-full border border-white/70 flex items-center justify-center bg-white/20 backdrop-blur-sm flex-shrink-0">
            <Gift className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/95 text-xs font-medium truncate">你向 {characterName} 转账</p>
            {giftName && (
              <p className="text-white/90 text-[10px] mt-0.5 truncate">礼物: {giftName}</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Content area - always show as received */}
      <div className="bg-[#FFA940] px-3 py-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-1"
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <Check className="w-3 h-3 text-white" />
            <span className="text-white text-[10px]">已收款</span>
          </div>
          <p className="text-white font-bold text-lg">¥{amount.toFixed(2)}</p>
          {message && (
            <p className="text-white/80 text-[10px] mt-0.5">{message}</p>
          )}
        </motion.div>
      </div>
      
      {/* Footer */}
      <div className="bg-white px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">梦境转账</span>
        <span className="text-[10px] text-green-500 flex items-center gap-0.5">
          <Check className="w-2.5 h-2.5" />
          已收款
        </span>
      </div>
    </motion.div>
  );
};

export default UserTransferCard;
