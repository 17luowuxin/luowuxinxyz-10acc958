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
  Lock,
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

// 页面布局配置 - 每页的布局模式
interface PageLayout {
  // 大图位置: 'top-left' | 'top-right' | 'bottom-left' 等
  largeImagePosition: 'top-left' | 'top-right' | 'bottom-left';
  // 这一页显示的APP数量（不含大图区域）
  appCount: number;
}

const pageLayouts: PageLayout[] = [
  { largeImagePosition: 'top-left', appCount: 7 },
  { largeImagePosition: 'top-right', appCount: 8 },
  { largeImagePosition: 'bottom-left', appCount: 8 },
];

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appIcons, setAppIcons] = useState<Record<string, string>>({});
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [selectedAppForUpload, setSelectedAppForUpload] = useState<string | null>(null);
  const [uploadingPageImage, setUploadingPageImage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageImageInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 排除Dock的APP，剩余的分配到各页
  const pageApps = allApps.filter(app => !dockApps.includes(app.id));
  const dockAppConfigs = allApps.filter(app => dockApps.includes(app.id));
  
  // 计算总页数
  const totalPages = pageLayouts.length;

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
        // 分离普通图标和页面大图
        const regularIcons: Record<string, string> = {};
        const images: Record<number, string> = {};
        
        Object.entries(icons).forEach(([key, value]) => {
          if (key.startsWith('page_image_')) {
            const pageIndex = parseInt(key.replace('page_image_', ''));
            images[pageIndex] = value;
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

      // 合并普通图标和页面大图
      const allIcons = { ...appIcons };
      Object.entries(pageImages).forEach(([key, value]) => {
        allIcons[`page_image_${key}`] = value;
      });
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
    if (!file || !user || uploadingPageImage === null) {
      setUploadingPageImage(null);
      return;
    }

    try {
      toast.loading('正在上传图片...');
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/page-images/page-${uploadingPageImage}-${Date.now()}.${fileExt}`;
      
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

      // 合并保存
      const allIcons = { ...appIcons };
      Object.entries(pageImages).forEach(([key, value]) => {
        allIcons[`page_image_${key}`] = value;
      });
      allIcons[`page_image_${uploadingPageImage}`] = publicUrl;
      
      const { error: upsertError } = await supabase
        .from('customization')
        .upsert({ user_id: user.id, app_icons: allIcons }, { onConflict: 'user_id' });
      
      if (upsertError) {
        toast.dismiss();
        toast.error('保存失败');
        return;
      }

      setPageImages(prev => ({ ...prev, [uploadingPageImage]: publicUrl }));
      toast.dismiss();
      toast.success('图片已更新！');
    } catch (error) {
      toast.dismiss();
      toast.error('上传失败，请重试');
    } finally {
      setUploadingPageImage(null);
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

  const handlePageImageClick = (pageIndex: number) => {
    setUploadingPageImage(pageIndex);
    pageImageInputRef.current?.click();
  };

  const exitEditMode = () => {
    setEditMode(false);
    setSelectedAppForUpload(null);
  };

  // 滑动切换页面
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold && currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    } else if (info.offset.x > threshold && currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // 获取当前页面的APP列表
  const getPageApps = (pageIndex: number) => {
    let startIndex = 0;
    for (let i = 0; i < pageIndex; i++) {
      startIndex += pageLayouts[i].appCount;
    }
    return pageApps.slice(startIndex, startIndex + pageLayouts[pageIndex].appCount);
  };

  // 渲染单个APP图标
  const renderAppIcon = (app: AppConfig, size: 'small' | 'dock' = 'small') => {
    const iconSize = size === 'dock' ? 'w-12 h-12' : 'w-[52px] h-[52px]';
    const innerIconSize = size === 'dock' ? 'w-5 h-5' : 'w-6 h-6';
    
    return (
      <motion.div
        key={app.id}
        className="flex flex-col items-center gap-1"
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
  const renderLargeImageArea = (pageIndex: number, position: string) => {
    const image = pageImages[pageIndex];
    
    // 根据位置决定大小
    const sizeClass = position === 'top-left' 
      ? 'col-span-2 row-span-2' 
      : position === 'top-right' 
        ? 'col-span-1 row-span-2'
        : 'col-span-2 row-span-2';
    
    return (
      <motion.div
        className={`${sizeClass} rounded-2xl overflow-hidden cursor-pointer bg-muted/50 flex items-center justify-center border border-dashed border-muted-foreground/30`}
        whileTap={{ scale: 0.98 }}
        onClick={() => handlePageImageClick(pageIndex)}
      >
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Plus className="w-8 h-8" />
            <span className="text-xs">上传图片</span>
          </div>
        )}
      </motion.div>
    );
  };

  // 渲染单个页面
  const renderPage = (pageIndex: number) => {
    const layout = pageLayouts[pageIndex];
    const apps = getPageApps(pageIndex);
    
    if (layout.largeImagePosition === 'top-left') {
      // 布局1: 大图左上，右侧3个APP，下方4个APP
      return (
        <div className="grid grid-cols-4 gap-3 auto-rows-[80px]">
          {/* 大图区域 - 左上角，占2列2行 */}
          {renderLargeImageArea(pageIndex, 'top-left')}
          
          {/* 右侧3个APP */}
          <div className="col-span-2 row-span-2 grid grid-cols-2 gap-3 content-start">
            {apps.slice(0, 3).map(app => (
              <div key={app.id} className="flex justify-center">
                {renderAppIcon(app)}
              </div>
            ))}
          </div>
          
          {/* 下方4个APP */}
          {apps.slice(3, 7).map(app => (
            <div key={app.id} className="flex justify-center items-start">
              {renderAppIcon(app)}
            </div>
          ))}
        </div>
      );
    } else if (layout.largeImagePosition === 'top-right') {
      // 布局2: 左侧4个APP，大图右上
      return (
        <div className="grid grid-cols-4 gap-3 auto-rows-[80px]">
          {/* 左侧4个APP - 2列2行 */}
          <div className="col-span-2 row-span-2 grid grid-cols-2 gap-3">
            {apps.slice(0, 4).map(app => (
              <div key={app.id} className="flex justify-center items-start">
                {renderAppIcon(app)}
              </div>
            ))}
          </div>
          
          {/* 大图区域 - 右上角 */}
          <div className="col-span-2 row-span-2">
            {renderLargeImageArea(pageIndex, 'top-right')}
          </div>
          
          {/* 下方4个APP */}
          {apps.slice(4, 8).map(app => (
            <div key={app.id} className="flex justify-center items-start">
              {renderAppIcon(app)}
            </div>
          ))}
        </div>
      );
    } else {
      // 布局3: 大图左下，右侧4个APP，上方4个APP
      return (
        <div className="grid grid-cols-4 gap-3 auto-rows-[80px]">
          {/* 上方4个APP */}
          {apps.slice(0, 4).map(app => (
            <div key={app.id} className="flex justify-center items-start">
              {renderAppIcon(app)}
            </div>
          ))}
          
          {/* 大图区域 - 左下角 */}
          {renderLargeImageArea(pageIndex, 'bottom-left')}
          
          {/* 右侧4个APP */}
          <div className="col-span-2 row-span-2 grid grid-cols-2 gap-3">
            {apps.slice(4, 8).map(app => (
              <div key={app.id} className="flex justify-center items-start">
                {renderAppIcon(app)}
              </div>
            ))}
          </div>
        </div>
      );
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
      <div className="flex justify-between items-center px-5 pt-6 pb-3">
        <span className="text-base font-semibold text-foreground/80">
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
            className="fixed top-10 right-4 z-20 w-8 h-8 bg-foreground/80 rounded-full flex items-center justify-center"
          >
            <X className="w-5 h-5 text-background" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Pages container with swipe */}
      <div className="flex-1 overflow-hidden relative z-10" ref={containerRef}>
        <motion.div
          className="flex h-full"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          animate={{ x: -currentPage * (containerRef.current?.offsetWidth || 300) }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ width: `${totalPages * 100}%` }}
        >
          {pageLayouts.map((_, pageIndex) => (
            <div 
              key={pageIndex} 
              className="px-4 pt-2"
              style={{ width: `${100 / totalPages}%` }}
            >
              {renderPage(pageIndex)}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Return to lock screen + Page indicators */}
      <div className="flex flex-col items-center gap-2 pb-3">
        <motion.button
          onClick={() => navigate('/lock')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/10 backdrop-blur-sm text-foreground/70 text-xs"
          whileTap={{ scale: 0.95 }}
        >
          <Lock className="w-3 h-3" />
          <span>返回锁屏</span>
        </motion.button>
        
        {/* Page indicators */}
        <div className="flex gap-1.5">
          {pageLayouts.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                currentPage === index 
                  ? 'bg-foreground/70 w-3' 
                  : 'bg-foreground/30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bottom Dock */}
      <div className="px-4 pb-6">
        <div className="bg-background/60 backdrop-blur-xl rounded-2xl p-3 flex justify-around items-center border border-white/20 shadow-lg">
          {dockAppConfigs.map(app => renderAppIcon(app, 'dock'))}
        </div>
      </div>

      {/* Home indicator */}
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-foreground/15 rounded-full" />
    </div>
  );
};

export default HomeScreen;
