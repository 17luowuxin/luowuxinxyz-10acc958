import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Image,
  User,
  Settings,
  Palette,
  MessageCircle,
  Star,
  Music,
  Mail,
  Camera,
  Gamepad2,
  Users,
  Lock,
  X,
  LucideIcon,
} from 'lucide-react';

interface AppConfig {
  id: string;
  name: string;
  icon: LucideIcon;
  bgColor: string;
  route: string;
}

const defaultApps: AppConfig[] = [
  { id: 'album', name: '相册', icon: Image, bgColor: 'bg-[#F06292]', route: '/album' },
  { id: 'camera', name: '相机', icon: Camera, bgColor: 'bg-[#42A5F5]', route: '/camera' },
  { id: 'profile', name: '我的', icon: User, bgColor: 'bg-[#26A69A]', route: '/profile' },
  { id: 'settings', name: '设置', icon: Settings, bgColor: 'bg-[#78909C]', route: '/settings' },
  { id: 'customize', name: '美化', icon: Palette, bgColor: 'bg-[#FFA726]', route: '/customize' },
  { id: 'friends', name: '好友', icon: MessageCircle, bgColor: 'bg-[#42A5F5]', route: '/friends' },
  { id: 'group', name: '群聊', icon: Users, bgColor: 'bg-[#26A69A]', route: '/group' },
  { id: 'space', name: '空间', icon: Star, bgColor: 'bg-[#EC407A]', route: '/space' },
  { id: 'music', name: '音乐', icon: Music, bgColor: 'bg-[#5C6BC0]', route: '/music' },
  { id: 'games', name: '游戏', icon: Gamepad2, bgColor: 'bg-[#FFA726]', route: '/games' },
  { id: 'bottle', name: '漂流瓶', icon: Mail, bgColor: 'bg-[#AB47BC]', route: '/bottle' },
];

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appIcons, setAppIcons] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [selectedAppForUpload, setSelectedAppForUpload] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user) {
      initializeCustomization();
    }
  }, [user]);

  const initializeCustomization = async () => {
    try {
      const { data, error } = await supabase
        .from('customization')
        .select('app_icons')
        .eq('user_id', user!.id)
        .single();
      
      if (error && error.code === 'PGRST116') {
        await supabase.from('customization').insert({ user_id: user!.id, app_icons: {} });
        return;
      }
      
      if (data?.app_icons && typeof data.app_icons === 'object') {
        setAppIcons(data.app_icons as Record<string, string>);
      }
    } catch (err) {
      console.error('Fetch icons error:', err);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedAppForUpload) {
      setSelectedAppForUpload(null);
      return;
    }

    try {
      toast.loading('正在上传图标...');
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/icons/${selectedAppForUpload}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('backgrounds')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.dismiss();
        toast.error('上传失败: ' + uploadError.message);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(fileName);

      const newIcons = { ...appIcons, [selectedAppForUpload]: publicUrl };
      
      const { error: upsertError } = await supabase
        .from('customization')
        .upsert({ user_id: user.id, app_icons: newIcons }, { onConflict: 'user_id' });
      
      if (upsertError) {
        console.error('Upsert error:', upsertError);
        toast.dismiss();
        toast.error('保存失败');
        return;
      }

      setAppIcons(newIcons);
      toast.dismiss();
      toast.success('图标已更新！');
    } catch (error) {
      console.error('Icon upload error:', error);
      toast.dismiss();
      toast.error('上传失败，请重试');
    } finally {
      setSelectedAppForUpload(null);
      setEditMode(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Long press to enter edit mode (like iOS)
  const handleTouchStart = (appId: string) => {
    longPressTimer.current = setTimeout(() => {
      setEditMode(true);
      toast.success('编辑模式：点击图标更换图片');
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleIconClick = (appId: string, route: string) => {
    if (editMode) {
      // In edit mode, click to change icon
      setSelectedAppForUpload(appId);
      fileInputRef.current?.click();
    } else {
      // Normal mode, navigate
      navigate(route);
    }
  };

  const exitEditMode = () => {
    setEditMode(false);
    setSelectedAppForUpload(null);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.03 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1 },
  };

  return (
    <div className="min-h-screen bg-background p-5 pt-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleIconUpload}
      />

      {/* Status bar */}
      <div className="flex justify-between items-center mb-6 px-1">
        <span className="text-lg font-semibold text-foreground/80">
          {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Edit mode overlay */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-10"
            onClick={exitEditMode}
          />
        )}
      </AnimatePresence>

      {/* Exit edit mode button */}
      <AnimatePresence>
        {editMode && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={exitEditMode}
            className="fixed top-12 right-4 z-20 w-8 h-8 bg-foreground/80 rounded-full flex items-center justify-center"
          >
            <X className="w-5 h-5 text-background" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* App grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 gap-5 relative z-10"
      >
        {defaultApps.map((app) => (
          <motion.div
            key={app.id}
            variants={itemVariants}
            className="flex flex-col items-center gap-1.5 relative"
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              animate={editMode ? { 
                rotate: [0, -2, 2, -2, 0],
                transition: { repeat: Infinity, duration: 0.3 }
              } : {}}
              onClick={() => handleIconClick(app.id, app.route)}
              onTouchStart={() => handleTouchStart(app.id)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(app.id)}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
              className="relative"
            >
              {appIcons[app.id] ? (
                <div className="w-[52px] h-[52px] rounded-[16px] shadow-soft overflow-hidden ring-2 ring-white/50">
                  <img 
                    src={appIcons[app.id]} 
                    alt={app.name}
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={`app-icon ${app.bgColor}`}>
                  <app.icon className="w-6 h-6 text-white" strokeWidth={1.8} />
                </div>
              )}
            </motion.button>
            <span className="text-xs font-medium text-foreground/70">{app.name}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Return to lock screen button */}
      <motion.button
        onClick={() => navigate('/lock')}
        className="fixed bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/10 backdrop-blur-sm text-foreground/70 text-sm"
        whileTap={{ scale: 0.95 }}
      >
        <Lock className="w-4 h-4" />
        <span>返回锁屏</span>
      </motion.button>

      {/* Home indicator */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-28 h-1 bg-foreground/15 rounded-full" />
    </div>
  );
};

export default HomeScreen;
