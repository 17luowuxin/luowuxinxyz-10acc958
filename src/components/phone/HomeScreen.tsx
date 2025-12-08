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
  LucideIcon,
} from 'lucide-react';

interface AppConfig {
  id: string;
  name: string;
  icon: LucideIcon;
  bgColor: string;
  route: string;
}

// Macaron color palette matching the reference image
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchAppIcons();
    }
  }, [user]);

  const fetchAppIcons = async () => {
    const { data } = await supabase
      .from('customization')
      .select('app_icons')
      .eq('user_id', user!.id)
      .single();
    
    if (data?.app_icons) {
      setAppIcons(data.app_icons as Record<string, string>);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !editingApp) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/icons/${editingApp}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('backgrounds')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(fileName);

      const newIcons = { ...appIcons, [editingApp]: publicUrl };
      
      await supabase
        .from('customization')
        .update({ app_icons: newIcons })
        .eq('user_id', user.id);

      setAppIcons(newIcons);
      toast.success('图标已更新');
    } catch (error) {
      toast.error('上传失败');
    } finally {
      setEditingApp(null);
    }
  };

  const handleLongPress = (appId: string) => {
    setEditingApp(appId);
    fileInputRef.current?.click();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
      },
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

      {/* App grid - 4 columns with smaller icons */}
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
            onContextMenu={(e) => {
              e.preventDefault();
              handleLongPress(app.id);
            }}
            className="flex flex-col items-center gap-1.5"
          >
            {appIcons[app.id] ? (
              <div className="w-[52px] h-[52px] rounded-[16px] shadow-soft overflow-hidden">
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

      {/* Bottom lock indicator */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2">
        <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center">
          <div className="w-4 h-5 border-2 border-foreground/30 rounded-sm relative">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 border-2 border-foreground/30 rounded-full" />
          </div>
        </div>
      </div>

      {/* Home indicator */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-28 h-1 bg-foreground/15 rounded-full" />
    </div>
  );
};

export default HomeScreen;
