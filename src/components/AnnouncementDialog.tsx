import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, Moon, Users, Gift, MessageCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface AnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  wechat_id: string | null;
}

const AnnouncementDialog: React.FC<AnnouncementDialogProps> = ({ open, onOpenChange }) => {
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (open) {
      fetchAnnouncement();
    }
  }, [open]);

  const fetchAnnouncement = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setAnnouncement(data);
    }
  };

  const handleCopyWechat = async () => {
    if (!announcement?.wechat_id) return;
    
    try {
      await navigator.clipboard.writeText(announcement.wechat_id);
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

  const handleClose = () => {
    // Mark as permanently dismissed
    localStorage.setItem('announcement_dismissed', 'true');
    onOpenChange(false);
  };

  if (!announcement) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-[280px] p-0 overflow-hidden border-0 bg-transparent shadow-xl rounded-2xl"
        aria-describedby="announcement-description"
      >
        <VisuallyHidden>
          <DialogTitle>公告</DialogTitle>
          <DialogDescription id="announcement-description">
            {announcement.title}
          </DialogDescription>
        </VisuallyHidden>
        
        <div className="relative">
          {/* Light gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 rounded-2xl" />
          
          {/* Decorative elements */}
          <div className="absolute top-3 right-3 w-12 h-12 bg-pink-200/40 rounded-full blur-lg" />
          <div className="absolute bottom-6 left-3 w-10 h-10 bg-purple-200/40 rounded-full blur-md" />
          
          {/* Stars decoration */}
          <div className="absolute top-4 left-4">
            <Moon className="w-4 h-4 text-purple-400 animate-pulse" />
          </div>
          <div className="absolute top-8 right-8 text-purple-300 text-xs">✨</div>
          <div className="absolute bottom-12 right-4 text-pink-300 text-sm">⭐</div>
          
          {/* Content */}
          <div className="relative z-10 p-4 text-center">
            {/* Title */}
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <Moon className="w-4 h-4 text-purple-500" />
              <h2 className="text-base font-bold text-purple-700">
                {announcement.title}
              </h2>
            </div>
            
            {/* Features */}
            <div className="flex justify-center gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-1 text-purple-600 text-xs">
                <MessageCircle className="w-3 h-3" />
                <span>玩法分享</span>
              </div>
              <div className="flex items-center gap-1 text-purple-600 text-xs">
                <Users className="w-3 h-3" />
                <span>问题求助</span>
              </div>
              <div className="flex items-center gap-1 text-purple-600 text-xs">
                <Gift className="w-3 h-3" />
                <span>干货领取</span>
              </div>
            </div>
            
            {/* Content card */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 mb-3 border border-purple-100">
              <p className="text-purple-700 text-xs mb-2 whitespace-pre-line">
                {announcement.content}
              </p>
              
              {/* WeChat ID with copy button */}
              {announcement.wechat_id && (
                <>
                  <button
                    onClick={handleCopyWechat}
                    className="w-full bg-gradient-to-r from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 transition-all duration-200 rounded-lg p-2 flex items-center justify-center gap-1.5 group border border-purple-200 hover:border-purple-300"
                  >
                    <span className="text-purple-700 font-mono font-bold text-sm tracking-wide">
                      {announcement.wechat_id}
                    </span>
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-purple-500 group-hover:text-purple-700 transition-colors" />
                    )}
                  </button>
                  <p className="text-purple-400 text-[10px] mt-1.5">
                    点击上方复制微信号
                  </p>
                </>
              )}
            </div>
            
            {/* Close button */}
            <Button
              onClick={handleClose}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl py-2 text-sm shadow-md"
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
  // If user has dismissed it before, never show again
  const dismissed = localStorage.getItem('announcement_dismissed');
  if (dismissed === 'true') {
    return false;
  }
  
  // Check if already shown this session
  const shownThisSession = sessionStorage.getItem('announcement_shown_session');
  if (shownThisSession === 'true') {
    return false;
  }
  
  return true;
};

// Utility function to mark announcement as shown for this session
export const markAnnouncementShown = () => {
  sessionStorage.setItem('announcement_shown_session', 'true');
};

export default AnnouncementDialog;
