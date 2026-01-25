import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, Moon, Users, Gift, MessageCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WECHAT_ID = 'XxyLxs9201314';

const AnnouncementDialog: React.FC<AnnouncementDialogProps> = ({ open, onOpenChange }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyWechat = async () => {
    try {
      await navigator.clipboard.writeText(WECHAT_ID);
      setCopied(true);
      toast({
        title: "复制成功",
        description: "微信号已复制到剪贴板",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "复制失败",
        description: "请手动复制微信号",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-2xl">
        <div className="relative">
          {/* Background with gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl" />
          
          {/* Decorative elements */}
          <div className="absolute top-4 right-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="absolute bottom-8 left-4 w-16 h-16 bg-pink-300/20 rounded-full blur-lg" />
          <div className="absolute top-1/2 right-8 w-12 h-12 bg-yellow-300/20 rounded-full blur-md" />
          
          {/* Stars decoration */}
          <div className="absolute top-6 left-6">
            <Moon className="w-6 h-6 text-yellow-300 animate-pulse" />
          </div>
          <div className="absolute top-12 right-12 text-yellow-200 text-xs">✨</div>
          <div className="absolute bottom-16 right-6 text-yellow-200 text-sm">⭐</div>
          
          {/* Content */}
          <div className="relative z-10 p-6 text-center">
            {/* Title */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <Moon className="w-5 h-5 text-yellow-300" />
              <h2 className="text-xl font-bold text-white drop-shadow-lg">
                梦境小手机交流群
              </h2>
            </div>
            
            {/* Features */}
            <div className="flex justify-center gap-4 mb-6">
              <div className="flex items-center gap-1 text-white/90 text-sm">
                <MessageCircle className="w-4 h-4" />
                <span>玩法分享</span>
              </div>
              <div className="flex items-center gap-1 text-white/90 text-sm">
                <Users className="w-4 h-4" />
                <span>问题求助</span>
              </div>
              <div className="flex items-center gap-1 text-white/90 text-sm">
                <Gift className="w-4 h-4" />
                <span>干货领取</span>
              </div>
            </div>
            
            {/* WeChat info card */}
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 mb-4 border border-white/20">
              <p className="text-white/90 text-sm mb-3">
                🔥 已购宝宝 带付款记录加微信拉你进群！
              </p>
              
              {/* WeChat ID with copy button */}
              <button
                onClick={handleCopyWechat}
                className="w-full bg-white/20 hover:bg-white/30 transition-all duration-200 rounded-lg p-3 flex items-center justify-center gap-2 group border border-white/30 hover:border-white/50"
              >
                <span className="text-white font-mono font-bold text-lg tracking-wide">
                  {WECHAT_ID}
                </span>
                {copied ? (
                  <Check className="w-5 h-5 text-green-300" />
                ) : (
                  <Copy className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" />
                )}
              </button>
              <p className="text-white/60 text-xs mt-2">
                点击上方复制微信号
              </p>
            </div>
            
            {/* Close button */}
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full bg-white text-purple-600 hover:bg-white/90 font-semibold rounded-xl py-3 shadow-lg"
            >
              我知道了
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Utility function to check if announcement should be shown
export const shouldShowAnnouncement = (): boolean => {
  const lastShownTime = localStorage.getItem('announcement_last_shown');
  
  if (!lastShownTime) {
    return true;
  }
  
  const lastShown = new Date(lastShownTime);
  const now = new Date();
  
  // Show once every 3 days
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
  return (now.getTime() - lastShown.getTime()) > threeDaysInMs;
};

// Utility function to mark announcement as shown
export const markAnnouncementShown = () => {
  localStorage.setItem('announcement_last_shown', new Date().toISOString());
};

export default AnnouncementDialog;
