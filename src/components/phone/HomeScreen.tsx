import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  getLocalAssetUrl,
  getLocalTable,
  isLocalModeEnabled,
  saveLocalAsset,
  upsertLocalRow,
} from '@/lib/localDataStore';
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
  Move,
  Check,
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
  { id: 'customize', name: '美化', icon: Palette, bgColor: 'bg-[#FFA726]', route: '/customize' },
  { id: 'space', name: '空间', icon: Star, bgColor: 'bg-[#EC407A]', route: '/space' },
  { id: 'games', name: '游戏', icon: Gamepad2, bgColor: 'bg-[#FFA726]', route: '/games' },
  { id: 'bottle', name: '漂流瓶', icon: Mail, bgColor: 'bg-[#AB47BC]', route: '/bottle' },
  { id: 'diary', name: '日记', icon: BookOpen, bgColor: 'bg-[#FF7043]', route: '/diary' },
  { id: 'stats', name: '统计', icon: BarChart3, bgColor: 'bg-[#66BB6A]', route: '/stats' },
  { id: 'workshop', name: '工坊', icon: Hammer, bgColor: 'bg-[#7E57C2]', route: '/workshop' },
  { id: 'visual-novel', name: '剧场', icon: BookOpen, bgColor: 'bg-gradient-to-br from-pink-500 to-purple-600', route: '/visual-novel' },
  { id: 'finance', name: '财务', icon: Wallet, bgColor: 'bg-[#43A047]', route: '/finance' },
];

// 底部Dock固定的APP
const dockApps: AppConfig[] = [
  { id: 'friends', name: '好友', icon: MessageCircle, bgColor: 'bg-[#42A5F5]', route: '/friends' },
  { id: 'group', name: '群聊', icon: Users, bgColor: 'bg-[#26A69A]', route: '/group' },
  { id: 'music', name: '音乐', icon: Music, bgColor: 'bg-[#5C6BC0]', route: '/music' },
  { id: 'settings', name: '设置', icon: Settings, bgColor: 'bg-[#78909C]', route: '/settings' },
];

// 第一页APP分组 (11个)
const page1Apps = allApps;

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appIcons, setAppIcons] = useState<Record<string, string>>({});
  const [pageImages, setPageImages] = useState<Record<string, string>>({});
  const [storedAppIcons, setStoredAppIcons] = useState<Record<string, string>>({});
  const [storedPageImages, setStoredPageImages] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ type: 'app' | 'image'; key: string } | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [localMode, setLocalMode] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setLocalMode(false);
      return;
    }
    isLocalModeEnabled(user.id).then(setLocalMode);
  }, [user]);

  useEffect(() => {
    if (user && localMode !== null) {
      loadCustomization();
    }
  }, [user, localMode]);

  const loadCustomization = async () => {
    try {
      if (!user) return;
      const result = localMode
        ? { data: (await getLocalTable(user.id, 'customization')).find((row) => row.user_id === user.id), error: null }
        : await supabase
            .from('customization')
            .select('app_icons')
            .eq('user_id', user.id)
            .single();
      const { data, error } = result;
      
      if (error && 'code' in error && error.code === 'PGRST116') {
        await supabase.from('customization').insert({ user_id: user.id, app_icons: {} });
        return;
      }
      
      if (data?.app_icons && typeof data.app_icons === 'object') {
        const icons = data.app_icons as Record<string, unknown>;
        const regularIcons: Record<string, string> = {};
        const images: Record<string, string> = {};
        const rawRegularIcons: Record<string, string> = {};
        const rawImages: Record<string, string> = {};
        
        for (const [key, value] of Object.entries(icons)) {
          const resolvedValue = localMode && typeof value === 'string'
            ? await getLocalAssetUrl(user.id, value)
            : value;
          if (key.startsWith('page_image_')) {
            images[key] = resolvedValue as string;
            rawImages[key] = value as string;
          } else if (typeof value === 'string' && !key.startsWith('desktop_layout')) {
            regularIcons[key] = resolvedValue as string;
            rawRegularIcons[key] = value;
          }
        }
        
        setAppIcons(regularIcons);
        setPageImages(images);
        setStoredAppIcons(rawRegularIcons);
        setStoredPageImages(rawImages);
      }
    } catch (err) {
      console.error('Load customization error:', err);
    }
  };

  // 图片压缩函数
  const compressImage = (file: File, maxWidth = 256, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        let { width, height } = img;
        
        // 计算压缩后的尺寸
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('压缩失败'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !uploadTarget) {
      setUploadTarget(null);
      return;
    }

    try {
      toast.loading('上传中...');
      
      // 根据类型决定压缩尺寸：APP图标用小尺寸，背景图用大尺寸
      const maxWidth = uploadTarget.type === 'app' ? 256 : 800;
      const compressedBlob = await compressImage(file, maxWidth, 0.85);
      let nextUrl: string;
      let storedUrl: string;

      if (localMode) {
        const sourceUrl = `local-asset://home-${crypto.randomUUID()}`;
        await saveLocalAsset(user.id, sourceUrl, compressedBlob);
        storedUrl = sourceUrl;
        nextUrl = await getLocalAssetUrl(user.id, sourceUrl);
      } else {
        const fileName = `${user.id}/${uploadTarget.type}/${uploadTarget.key}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, compressedBlob, { upsert: true, contentType: 'image/jpeg' });

        if (uploadError) {
          toast.dismiss();
          toast.error('上传失败');
          return;
        }
        storedUrl = supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl;
        nextUrl = storedUrl;
      }

      if (uploadTarget.type === 'app') {
        const newIcons = { ...appIcons, [uploadTarget.key]: nextUrl };
        const newStoredIcons = { ...storedAppIcons, [uploadTarget.key]: storedUrl };
        setAppIcons(newIcons);
        setStoredAppIcons(newStoredIcons);
        
        const allData = { ...newStoredIcons, ...storedPageImages };
        if (localMode) {
          await upsertLocalRow(user.id, 'customization', (row) => row.user_id === user.id, { user_id: user.id, app_icons: allData });
        } else {
          await supabase.from('customization').upsert({ user_id: user.id, app_icons: allData } as any, { onConflict: 'user_id' });
        }
      } else {
        const newImages = { ...pageImages, [uploadTarget.key]: nextUrl };
        const newStoredImages = { ...storedPageImages, [uploadTarget.key]: storedUrl };
        setPageImages(newImages);
        setStoredPageImages(newStoredImages);
        
        const allData = { ...storedAppIcons, ...newStoredImages };
        if (localMode) {
          await upsertLocalRow(user.id, 'customization', (row) => row.user_id === user.id, { user_id: user.id, app_icons: allData });
        } else {
          await supabase.from('customization').upsert({ user_id: user.id, app_icons: allData } as any, { onConflict: 'user_id' });
        }
      }
      
      toast.dismiss();
      toast.success('上传成功！');
    } catch (error) {
      toast.dismiss();
      toast.error('上传失败');
    } finally {
      setUploadTarget(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 长按相关状态
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  // 编辑模式下单击选择图片
  const handleIconClick = (app: AppConfig) => {
    if (editMode) {
      // 编辑模式：单击选择图片
      setUploadTarget({ type: 'app', key: app.id });
      fileInputRef.current?.click();
    } else if (!isPressing) {
      // 正常模式：导航
      navigate(app.route);
    }
  };

  // 长按仅进入编辑模式
  const handleLongPress = () => {
    if (!editMode) {
      setEditMode(true);
      toast.success('编辑模式：点击图标更换图片');
    }
  };

  // 移动端长按开始 - 仅用于进入编辑模式
  const handleTouchStartIcon = () => {
    setIsPressing(true);
    longPressTimerRef.current = setTimeout(() => {
      handleLongPress();
      setIsPressing(false);
    }, 500);
  };

  // 移动端触摸结束
  const handleTouchEndIcon = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsPressing(false);
  };

  // 移动端触摸移动 - 取消长按
  const handleTouchMoveIcon = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleImageClick = (imageKey: string) => {
    setUploadTarget({ type: 'image', key: imageKey });
    fileInputRef.current?.click();
  };

  const removeImage = (imageKey: string) => {
    const newImages = { ...pageImages };
    const newStoredImages = { ...storedPageImages };
    delete newImages[imageKey];
    delete newStoredImages[imageKey];
    setPageImages(newImages);
    setStoredPageImages(newStoredImages);
    
    if (user) {
      const allData = { ...storedAppIcons, ...newStoredImages };
      if (localMode) {
        upsertLocalRow(user.id, 'customization', (row) => row.user_id === user.id, { user_id: user.id, app_icons: allData });
      } else {
        supabase.from('customization').upsert({ user_id: user.id, app_icons: allData } as any, { onConflict: 'user_id' });
      }
    }
    toast.success('已删除');
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentPage < 1) {
        setCurrentPage(1);
      } else if (diff < 0 && currentPage > 0) {
        setCurrentPage(0);
      }
    }
    setTouchStart(null);
  };

  const renderAppIcon = (app: AppConfig, size: 'normal' | 'large' = 'normal') => {
    const iconSize = size === 'large' ? 'w-16 h-16' : 'w-14 h-14';
    const innerIconSize = size === 'large' ? 'w-7 h-7' : 'w-6 h-6';
    
    return (
      <motion.div
        key={app.id}
        className="flex flex-col items-center gap-1"
        whileTap={{ scale: 0.9 }}
        animate={editMode ? { 
          rotate: [0, -1, 1, -1, 0],
          transition: { repeat: Infinity, duration: 0.4 }
        } : {}}
      >
        <button
          onClick={() => handleIconClick(app)}
          onContextMenu={(e) => {
            e.preventDefault();
            handleLongPress();
          }}
          onTouchStart={handleTouchStartIcon}
          onTouchEnd={handleTouchEndIcon}
          onTouchMove={handleTouchMoveIcon}
          onTouchCancel={handleTouchEndIcon}
          className="relative select-none touch-manipulation"
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
        >
          {appIcons[app.id] ? (
            <div className={`${iconSize} rounded-[16px] shadow-soft overflow-hidden ring-1 ring-white/30`}>
              <img 
                src={appIcons[app.id]} 
                alt={app.name} 
                className="w-full h-full object-cover pointer-events-none select-none" 
                draggable={false}
              />
            </div>
          ) : (
            <div className={`${iconSize} rounded-[16px] ${app.bgColor} flex items-center justify-center shadow-soft`}>
              <app.icon className={`${innerIconSize} text-white`} strokeWidth={1.8} />
            </div>
          )}
          {editMode && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
              <Plus className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
        </button>
        <span className="text-[11px] font-medium desktop-text opacity-80">{app.name}</span>
      </motion.div>
    );
  };

  const renderImageSlot = (imageKey: string, aspectRatio: string, className?: string) => {
    const image = pageImages[imageKey];
    
    return (
      <motion.div
        className={`rounded-2xl overflow-hidden cursor-pointer bg-muted/40 flex items-center justify-center border-2 border-dashed border-muted-foreground/20 relative ${className}`}
        style={{ aspectRatio }}
        whileTap={{ scale: 0.98 }}
        onClick={() => handleImageClick(imageKey)}
      >
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Plus className="w-6 h-6" />
            <span className="text-xs">上传图片</span>
          </div>
        )}
        {editMode && image && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeImage(imageKey);
            }}
            className="absolute top-2 right-2 w-6 h-6 bg-destructive rounded-full flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        )}
      </motion.div>
    );
  };

  const renderDockIcon = (app: AppConfig) => (
    <motion.div
      key={app.id}
      className="flex flex-col items-center gap-0.5"
      whileTap={{ scale: 0.9 }}
    >
      <button
        onClick={() => handleIconClick(app)}
        onContextMenu={(e) => {
          e.preventDefault();
          handleLongPress();
        }}
        onTouchStart={handleTouchStartIcon}
        onTouchEnd={handleTouchEndIcon}
        onTouchMove={handleTouchMoveIcon}
        onTouchCancel={handleTouchEndIcon}
        className="relative select-none touch-manipulation"
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
      >
        {appIcons[app.id] ? (
          <div className="w-14 h-14 rounded-[14px] shadow-soft overflow-hidden ring-1 ring-white/30">
            <img
              src={appIcons[app.id]}
              alt={app.name}
              className="w-full h-full object-cover pointer-events-none select-none"
              draggable={false}
            />
          </div>
        ) : (
          <div className={`w-14 h-14 rounded-[14px] ${app.bgColor} flex items-center justify-center shadow-soft`}>
            <app.icon className="w-6 h-6 text-white" strokeWidth={1.8} />
          </div>
        )}

        {editMode && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <Plus className="w-3 h-3 text-primary-foreground" />
          </div>
        )}
      </button>
      <span className="text-[10px] font-medium desktop-text opacity-80">{app.name}</span>
    </motion.div>
  );

  // 第一页布局
  const renderPage1 = () => (
    <div className="flex flex-col gap-4 px-4">
      {/* 第一行：3:2大图在左上 + 右侧2x2四宫格(相册、相机、我的、财务) */}
      <div className="flex gap-3">
        <div className="w-[55%]">
          {renderImageSlot('page_image_top', '3/2')}
        </div>
        <div className="grid grid-cols-2 gap-2 items-center justify-items-center flex-1">
          {renderAppIcon(page1Apps[0])}
          {renderAppIcon(page1Apps[1])}
          {renderAppIcon(page1Apps[2])}
          {renderAppIcon(page1Apps[11])}
        </div>
      </div>

      {/* 第二行：四宫格APP + 1:1大图 */}
      <div className="flex gap-3 items-start">
        <div className="grid grid-cols-2 gap-3">
          {renderAppIcon(page1Apps[3])}
          {renderAppIcon(page1Apps[4])}
          {renderAppIcon(page1Apps[5])}
          {renderAppIcon(page1Apps[6])}
        </div>
        <div className="flex-1">
          {renderImageSlot('page_image_mid', '1/1')}
        </div>
      </div>

      {/* 第三行：1:1大图 + 四宫格APP */}
      <div className="flex gap-3 items-start">
        <div className="flex-1">
          {renderImageSlot('page_image_bottom', '1/1')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {renderAppIcon(page1Apps[7])}
          {renderAppIcon(page1Apps[8])}
          {renderAppIcon(page1Apps[9])}
          {renderAppIcon(page1Apps[10])}
        </div>
      </div>
    </div>
  );

  // 第二页布局：梦阁入口
  const renderPage2 = () => (
    <div className="flex flex-col items-center justify-center h-full px-5">
      <motion.div
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/gift-shop')}
        className="flex flex-col items-center gap-4 p-8 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl backdrop-blur-sm border border-white/30"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
          <span className="text-3xl">🎁</span>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            梦阁
          </p>
          <p className="text-xs text-foreground/60 mt-1">用梦境币为角色送礼物</p>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Status bar */}
      <div className="flex justify-between items-center px-4 pt-4 pb-2">
        <span className="text-sm font-semibold text-foreground/80">
          {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
        
        {/* 编辑模式切换 */}
        <button
          onClick={() => {
            setEditMode(!editMode);
            if (!editMode) toast.success('编辑模式：点击图标更换图片');
          }}
          className={`p-2 rounded-full transition-colors ${
            editMode ? 'bg-primary text-primary-foreground' : 'bg-muted/50'
          }`}
        >
          {editMode ? <Check className="w-4 h-4" /> : <Move className="w-4 h-4" />}
        </button>
      </div>

      {/* Main content with swipe */}
      <div 
        className="flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: currentPage === 0 ? -100 : 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: currentPage === 0 ? 100 : -100 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {currentPage === 0 ? renderPage1() : renderPage2()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom area */}
      <div className="pb-3 flex flex-col items-center gap-2 mt-4">
        {/* Lock screen button */}
        <button
          onClick={() => navigate('/?locked=true')}
          className="w-10 h-1.5 rounded-full bg-foreground/30 hover:bg-foreground/50 transition-colors"
          title="锁屏"
        />

        {/* Page dots */}
        <div className="flex gap-2">
          {[0, 1].map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-2 h-2 rounded-full transition-colors ${
                currentPage === page ? 'bg-foreground/60' : 'bg-foreground/20'
              }`}
            />
          ))}
        </div>

        {/* Dock */}
        <div className="bg-background/30 backdrop-blur-xl rounded-2xl px-4 py-2 mx-3">
          <div className="flex gap-4 justify-center">
            {dockApps.map(app => renderDockIcon(app))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
