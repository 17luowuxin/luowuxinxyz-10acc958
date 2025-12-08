import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
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
  const [editingApp, setEditingApp] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      initializeCustomization();
    }
  }, [user]);

  const initializeCustomization = async () => {
    try {
      // First try to fetch existing customization
      const { data, error } = await supabase
        .from('customization')
        .select('app_icons')
        .eq('user_id', user!.id)
        .single();
      
      if (error && error.code === 'PGRST116') {
        // No record exists, create one
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
    if (!file || !user || !editingApp) {
      setEditingApp(null);
      return;
    }

    try {
      toast.loading('正在上传图标...');
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/icons/${editingApp}-${Date.now()}.${fileExt}`;
      
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

      const newIcons = { ...appIcons, [editingApp]: publicUrl };
      
      // First try update, if no rows affected then upsert
      const { error: updateError, count } = await supabase
        .from('customization')
        .update({ app_icons: newIcons })
        .eq('user_id', user.id);

      if (updateError) {
        // Try upsert instead
        const { error: upsertError } = await supabase
          .from('customization')
          .upsert({ user_id: user.id, app_icons: newIcons }, { onConflict: 'user_id' });
        
        if (upsertError) {
          console.error('Upsert error:', upsertError);
          toast.dismiss();
          toast.error('保存失败');
          return;
        }
      }

      setAppIcons(newIcons);
      toast.dismiss();
      toast.success('图标已更新！');
    } catch (error) {
      console.error('Icon upload error:', error);
      toast.dismiss();
      toast.error('上传失败，请重试');
    } finally {
      setEditingApp(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTouchStart = (appId: string) => {
    const timer = setTimeout(() => {
      setEditingApp(appId);
      fileInputRef.current?.click();
    }, 600);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, appId: string) => {
    e.preventDefault();
    setEditingApp(appId);
    setTimeout(() => fileInputRef.current?.click(), 100);
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

      {/* App grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 gap-5"
      >
        {defaultApps.map((app) => (
          <motion.button
            key={app.id}
            variants={itemVariants}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(app.route)}
            onTouchStart={() => handleTouchStart(app.id)}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onContextMenu={(e) => handleContextMenu(e, app.id)}
            className="flex flex-col items-center gap-1.5"
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
            <span className="text-xs font-medium text-foreground/70">{app.name}</span>
          </motion.button>
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
