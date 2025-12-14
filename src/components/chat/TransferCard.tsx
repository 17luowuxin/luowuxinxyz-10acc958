import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import transferBg from '@/assets/transfer-card-bg.jpg';

interface TransferCardProps {
  amount: number;
  characterName: string;
  message?: string;
  isReceived: boolean;
  onReceive?: () => void;
}

const TransferCard: React.FC<TransferCardProps> = ({
  amount,
  characterName,
  message,
  isReceived,
  onReceive
}) => {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="w-full max-w-[260px] rounded-xl overflow-hidden shadow-lg"
    >
      {/* Orange header with lightning icon */}
      <div 
        className="relative p-4 pb-6"
        style={{
          backgroundImage: `url(${transferBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-white/80 flex items-center justify-center bg-transparent">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <div className="flex-1">
            <p className="text-white/90 text-sm">{characterName} 向你转账</p>
            <p className="text-white font-bold text-2xl mt-1">¥{amount.toFixed(2)}</p>
            {message && (
              <p className="text-white/80 text-xs mt-1">{message}</p>
            )}
          </div>
        </div>
      </div>
      
      {/* White footer */}
      <div className="bg-white p-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">梦境转账</span>
        {!isReceived ? (
          <button
            onClick={onReceive}
            className="px-4 py-1.5 bg-gradient-to-r from-orange-400 to-orange-500 text-white text-sm rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            收款
          </button>
        ) : (
          <span className="text-xs text-green-500 flex items-center gap-1">
            ✓ 已收款
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default TransferCard;
