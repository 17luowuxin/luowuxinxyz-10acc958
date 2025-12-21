import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
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
  X,
  BookOpen,
  BarChart3,
  Hammer,
  Wallet,
  LucideIcon,
  Plus,
} from 'lucide-react';

interface AppConfig {
  id: string;
  name: string;
  icon: LucideIcon;
  bgColor: string;
  route: string;
}

// 所有可用的APP
const allApps: AppConfig[] = [
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
  { id: 'diary', name: '日记', icon: BookOpen, bgColor: 'bg-[#FF7043]', route: '/diary' },
  { id: 'stats', name: '统计', icon: BarChart3, bgColor: 'bg-[#66BB6A]', route: '/stats' },
  { id: 'workshop', name: '工坊', icon: Hammer, bgColor: 'bg-[#7E57C2]', route: '/workshop' },
  { id: 'finance', name: '财务', icon: Wallet, bgColor: 'bg-[#FF9800]', route: '/finance' },
];

// 底部Dock固定的APP
const dockApps = ['friends', 'group', 'music', 'settings'];

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appIcons, setAppIcons] = useState<Record<string, string>>({});
  const [pageImages, setPageImages] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [selectedAppForUpload, setSelectedAppForUpload] = useState<string | null>(null);
  const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageImageInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // 排除Dock的APP
  const pageApps = allApps.filter(app => !dockApps.includes(app.id));
  const dockAppConfigs = allApps.filter(app => dockApps.includes(app.id));
  
  const totalPages = 2;

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
        const icons = data.app_icons as Record<string, string>;
        const regularIcons: Record<string, string> = {};
        const images: Record<string, string> = {};
        
        Object.entries(icons).forEach(([key, value]) => {
          if (key.startsWith('page_image_')) {
            images[key] = value;
          } else {
            regularIcons[key] = value;
          }
        });
        
        setAppIcons(regularIcons);
        setPageImages(images);
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
        toast.dismiss();
        toast.error('上传失败: ' + uploadError.message);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(fileName);

      const allIcons = { ...appIcons, ...pageImages };
      allIcons[selectedAppForUpload] = publicUrl;
      
      const { error: upsertError } = await supabase
        .from('customization')
        .upsert({ user_id: user.id, app_icons: allIcons }, { onConflict: 'user_id' });
      
      if (upsertError) {
        toast.dismiss();
        toast.error('保存失败');
        return;
      }

      setAppIcons(prev => ({ ...prev, [selectedAppForUpload]: publicUrl }));
      toast.dismiss();
      toast.success('图标已更新！');
    } catch (error) {
      toast.dismiss();
      toast.error('上传失败，请重试');
    } finally {
      setSelectedAppForUpload(null);
      setEditMode(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePageImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !uploadingImageKey) {
      setUploadingImageKey(null);
      return;
    }

    try {
      toast.loading('正在上传图片...');
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/page-images/${uploadingImageKey}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('backgrounds')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        toast.dismiss();
        toast.error('上传失败: ' + uploadError.message);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(fileName);

      const allIcons = { ...appIcons, ...pageImages };
      allIcons[uploadingImageKey] = publicUrl;
      
      const { error: upsertError } = await supabase
        .from('customization')
        .upsert({ user_id: user.id, app_icons: allIcons }, { onConflict: 'user_id' });
      
      if (upsertError) {
        toast.dismiss();
        toast.error('保存失败');
        return;
      }

      setPageImages(prev => ({ ...prev, [uploadingImageKey]: publicUrl }));
      toast.dismiss();
      toast.success('图片已更新！');
    } catch (error) {
      toast.dismiss();
      toast.error('上传失败，请重试');
    } finally {
      setUploadingImageKey(null);
      if (pageImageInputRef.current) pageImageInputRef.current.value = '';
    }
  };

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
      setSelectedAppForUpload(appId);
      fileInputRef.current?.click();
    } else {
      navigate(route);
    }
  };

  const handlePageImageClick = (imageKey: string) => {
    setUploadingImageKey(imageKey);
    pageImageInputRef.current?.click();
  };

  const exitEditMode = () => {
    setEditMode(false);
    setSelectedAppForUpload(null);
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold && currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    } else if (info.offset.x > threshold && currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // 渲染单个APP图标
  const renderAppIcon = (app: AppConfig, size: 'normal' | 'dock' = 'normal') => {
    const iconSize = size === 'dock' ? 'w-14 h-14' : 'w-14 h-14';
    const innerIconSize = size === 'dock' ? 'w-6 h-6' : 'w-6 h-6';
    
    return (
      <motion.div
        key={app.id}
        className="flex flex-col items-center gap-0.5"
        whileTap={{ scale: 0.9 }}
      >
        <motion.button
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
            <div className={`${iconSize} rounded-[14px] shadow-soft overflow-hidden ring-1 ring-white/30`}>
              <img 
                src={appIcons[app.id]} 
                alt={app.name}
                loading="eager"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className={`${iconSize} rounded-[14px] ${app.bgColor} flex items-center justify-center shadow-soft`}>
              <app.icon className={`${innerIconSize} text-white`} strokeWidth={1.8} />
            </div>
          )}
        </motion.button>
        <span className="text-[10px] font-medium text-foreground/80">{app.name}</span>
      </motion.div>
    );
  };

  // 渲染大图上传区域
  const renderLargeImageArea = (imageKey: string, className: string) => {
    const image = pageImages[imageKey];
    
    return (
      <motion.div
        className={`${className} rounded-xl overflow-hidden cursor-pointer bg-muted/40 flex items-center justify-center border border-dashed border-muted-foreground/20`}
        whileTap={{ scale: 0.98 }}
        onClick={() => handlePageImageClick(imageKey)}
      >
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Plus className="w-5 h-5" />
            <span className="text-[10px]">上传图片</span>
          </div>
        )}
      </motion.div>
    );
  };

  // 第一页布局 - 严格按照参考图
  const renderPage1 = () => {
    const apps = pageApps.slice(0, 11);
    
    return (
      <div className="flex flex-col gap-2 px-3">
        {/* 第一行: 横向大图 + 右侧3个APP横排 */}
        <div className="flex gap-2 items-start">
          {renderLargeImageArea('page_image_top', 'flex-1 h-16')}
          <div className="flex gap-2">
            {apps.slice(0, 3).map(app => renderAppIcon(app))}
          </div>
        </div>
        
        {/* 第二区块: 左侧2x2 APP + 右侧方形大图 */}
        <div className="flex gap-2 items-start">
          <div className="grid grid-cols-2 gap-2">
            {apps.slice(3, 7).map(app => renderAppIcon(app))}
          </div>
          {renderLargeImageArea('page_image_mid', 'w-[120px] h-[152px]')}
        </div>
        
        {/* 第三区块: 左侧方形大图 + 右侧2x2 APP */}
        <div className="flex gap-2 items-start">
          {renderLargeImageArea('page_image_bottom', 'w-[120px] h-[152px]')}
          <div className="grid grid-cols-2 gap-2">
            {apps.slice(7, 11).map(app => renderAppIcon(app))}
          </div>
        </div>
      </div>
    );
  };

  // 第二页 - 纯APP图标网格
  const renderPage2 = () => {
    const apps = pageApps.slice(11);
    
    return (
      <div className="px-3">
        <div className="grid grid-cols-4 gap-3">
          {apps.map(app => renderAppIcon(app))}
        </div>
        {apps.length === 0 && (
          <p className="text-center text-muted-foreground text-sm mt-8">暂无更多应用</p>
        )}
      </div>
    );
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 0: return renderPage1();
      case 1: return renderPage2();
      default: return renderPage1();
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleIconUpload}
      />
      <input
        ref={pageImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePageImageUpload}
      />

      {/* Status bar */}
      <div className="flex justify-between items-center px-4 pt-4 pb-2">
        <span className="text-sm font-semibold text-foreground/80">
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
            className="fixed top-14 right-3 z-20 bg-background/90 rounded-full p-2 shadow-lg"
          >
            <X className="w-4 h-4 text-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main content area with swipe */}
      <div className="flex-1 overflow-hidden relative">
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          className="h-full"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.2 }}
              className="relative z-20"
            >
              {renderCurrentPage()}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Bottom area */}
      <div className="pb-3 flex flex-col items-center gap-2">
        {/* Return to lock screen */}
        <button
          onClick={() => navigate('/?locked=true')}
          className="text-xs text-foreground/60 hover:text-foreground/80 transition-colors"
        >
          返回锁屏
        </button>

        {/* Page indicators */}
        <div className="flex gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === currentPage 
                  ? 'bg-foreground/70 w-3' 
                  : 'bg-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Dock */}
        <div className="bg-background/30 backdrop-blur-xl rounded-2xl px-4 py-2 mx-3">
          <div className="flex gap-4 justify-center">
            {dockAppConfigs.map(app => renderAppIcon(app, 'dock'))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
