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
  Users,
  Globe,
  Gamepad2,
  MessageCircle,
  Music,
  Mail,
  Camera,
  LucideIcon,
} from 'lucide-react';

interface AppConfig {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  route: string;
}

const defaultApps: AppConfig[] = [
  { id: 'album', name: '相册', icon: Image, color: 'from-candy-blue to-candy-mint', route: '/album' },
  { id: 'profile', name: '我的', icon: User, color: 'from-candy-pink to-candy-purple', route: '/profile' },
  { id: 'settings', name: '设置', icon: Settings, color: 'from-gray-400 to-gray-600', route: '/settings' },
  { id: 'customize', name: '美化', icon: Palette, color: 'from-candy-purple to-candy-blue', route: '/customize' },
  { id: 'friends', name: '好友', icon: Users, color: 'from-candy-orange to-candy-pink', route: '/friends' },
  { id: 'space', name: '空间', icon: Globe, color: 'from-candy-yellow to-candy-orange', route: '/space' },
  { id: 'games', name: '游戏', icon: Gamepad2, color: 'from-candy-mint to-candy-blue', route: '/games' },
  { id: 'group', name: '群聊', icon: MessageCircle, color: 'from-candy-pink to-candy-orange', route: '/group' },
  { id: 'music', name: '音乐', icon: Music, color: 'from-candy-purple to-candy-pink', route: '/music' },
  { id: 'bottle', name: '漂流瓶', icon: Mail, color: 'from-candy-blue to-candy-purple', route: '/bottle' },
  { id: 'camera', name: '相机', icon: Camera, color: 'from-gray-700 to-gray-900', route: '/camera' },
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
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    show: { opacity: 1, scale: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background p-6 pt-12">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleIconUpload}
      />

      {/* Status bar placeholder */}
      <div className="flex justify-between items-center mb-8 px-2">
        <span className="text-sm font-medium text-muted-foreground">
          {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-2 bg-muted-foreground/50 rounded-sm" />
          <div className="w-6 h-3 bg-candy-mint rounded-sm" />
        </div>
      </div>

      {/* App grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 gap-6"
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
            className="flex flex-col items-center gap-2 group"
          >
            {appIcons[app.id] ? (
              <div className="w-14 h-14 rounded-2xl shadow-soft transition-all duration-300 overflow-hidden">
                <img 
                  src={appIcons[app.id]} 
                  alt={app.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className={`app-icon bg-gradient-to-br ${app.color}`}>
                <app.icon className="w-7 h-7 text-white" />
              </div>
            )}
            <span className="text-xs font-medium text-foreground/80">{app.name}</span>
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              右键换图标
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm">
        <div className="glass rounded-3xl px-6 py-4 flex justify-around items-center shadow-card">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/friends')}
            className="flex flex-col items-center gap-1"
          >
            {appIcons['friends'] ? (
              <div className="w-12 h-12 rounded-2xl shadow-soft overflow-hidden">
                <img src={appIcons['friends']} alt="好友" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-candy-orange to-candy-pink flex items-center justify-center shadow-soft">
                <Users className="w-6 h-6 text-white" />
              </div>
            )}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/album')}
            className="flex flex-col items-center gap-1"
          >
            {appIcons['album'] ? (
              <div className="w-12 h-12 rounded-2xl shadow-soft overflow-hidden">
                <img src={appIcons['album']} alt="相册" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-candy-blue to-candy-mint flex items-center justify-center shadow-soft">
                <Image className="w-6 h-6 text-white" />
              </div>
            )}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/music')}
            className="flex flex-col items-center gap-1"
          >
            {appIcons['music'] ? (
              <div className="w-12 h-12 rounded-2xl shadow-soft overflow-hidden">
                <img src={appIcons['music']} alt="音乐" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-candy-purple to-candy-pink flex items-center justify-center shadow-soft">
                <Music className="w-6 h-6 text-white" />
              </div>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
