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
  X,
  BookOpen,
  BarChart3,
  Hammer,
  Wallet,
  LucideIcon,
  Plus,
  Move,
  Check,
  Trash2,
} from 'lucide-react';

interface AppConfig {
  id: string;
  name: string;
  icon: LucideIcon;
  bgColor: string;
  route: string;
}

interface GridItem {
  type: 'app' | 'image' | 'image-part';
  appId?: string;
  imageKey?: string;
  parentKey?: string; // for image-part, reference to main image cell
  span?: { cols: number; rows: number };
}

interface LayoutConfig {
  [key: string]: GridItem; // key format: "row-col"
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
  { id: 'finance', name: '财务', icon: Wallet, bgColor: 'bg-[#FF9800]', route: '/finance' },
];

// 底部Dock固定的APP
const dockApps: AppConfig[] = [
  { id: 'friends', name: '好友', icon: MessageCircle, bgColor: 'bg-[#42A5F5]', route: '/friends' },
  { id: 'group', name: '群聊', icon: Users, bgColor: 'bg-[#26A69A]', route: '/group' },
  { id: 'music', name: '音乐', icon: Music, bgColor: 'bg-[#5C6BC0]', route: '/music' },
  { id: 'settings', name: '设置', icon: Settings, bgColor: 'bg-[#78909C]', route: '/settings' },
];

const GRID_COLS = 5;
const GRID_ROWS = 6;

// 默认布局
const getDefaultLayout = (): LayoutConfig => {
  const layout: LayoutConfig = {};
  
  // 顶部横向大图 (占3列1行)
  layout['0-0'] = { type: 'image', imageKey: 'img_top', span: { cols: 3, rows: 1 } };
  layout['0-1'] = { type: 'image-part', parentKey: '0-0' };
  layout['0-2'] = { type: 'image-part', parentKey: '0-0' };
  
  // 右侧3个APP
  layout['0-3'] = { type: 'app', appId: 'album' };
  layout['0-4'] = { type: 'app', appId: 'camera' };
  layout['1-3'] = { type: 'app', appId: 'profile' };
  layout['1-4'] = { type: 'app', appId: 'customize' };
  
  // 左侧4个APP (2x2)
  layout['1-0'] = { type: 'app', appId: 'space' };
  layout['1-1'] = { type: 'app', appId: 'games' };
  layout['2-0'] = { type: 'app', appId: 'bottle' };
  layout['2-1'] = { type: 'app', appId: 'diary' };
  
  // 中间大图 (2x2)
  layout['1-2'] = { type: 'image', imageKey: 'img_mid', span: { cols: 1, rows: 2 } };
  layout['2-2'] = { type: 'image-part', parentKey: '1-2' };
  
  // 底部区域
  layout['3-0'] = { type: 'image', imageKey: 'img_bottom', span: { cols: 2, rows: 2 } };
  layout['3-1'] = { type: 'image-part', parentKey: '3-0' };
  layout['4-0'] = { type: 'image-part', parentKey: '3-0' };
  layout['4-1'] = { type: 'image-part', parentKey: '3-0' };
  
  layout['3-2'] = { type: 'app', appId: 'stats' };
  layout['3-3'] = { type: 'app', appId: 'workshop' };
  layout['4-2'] = { type: 'app', appId: 'finance' };
  
  return layout;
};

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appIcons, setAppIcons] = useState<Record<string, string>>({});
  const [pageImages, setPageImages] = useState<Record<string, string>>({});
  const [layout, setLayout] = useState<LayoutConfig>(getDefaultLayout());
  const [editMode, setEditMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ type: 'app' | 'image'; key: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadCustomization();
    }
  }, [user]);

  const loadCustomization = async () => {
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
        const icons = data.app_icons as Record<string, unknown>;
        const regularIcons: Record<string, string> = {};
        const images: Record<string, string> = {};
        let savedLayout: LayoutConfig | null = null;
        
        Object.entries(icons).forEach(([key, value]) => {
          if (key === 'desktop_layout' && typeof value === 'object') {
            savedLayout = value as LayoutConfig;
          } else if (key.startsWith('img_')) {
            images[key] = value as string;
          } else if (typeof value === 'string') {
            regularIcons[key] = value;
          }
        });
        
        setAppIcons(regularIcons);
        setPageImages(images);
        if (savedLayout) {
          setLayout(savedLayout);
        }
      }
    } catch (err) {
      console.error('Load customization error:', err);
    }
  };

  const saveLayout = async (newLayout: LayoutConfig) => {
    if (!user) return;
    
    try {
      const allData: Record<string, unknown> = { 
        ...appIcons, 
        ...pageImages,
        desktop_layout: newLayout 
      };
      
      await supabase
        .from('customization')
        .upsert({ user_id: user.id, app_icons: allData as Record<string, unknown> } as any, { onConflict: 'user_id' });
    } catch (err) {
      console.error('Save layout error:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !uploadTarget) {
      setUploadTarget(null);
      return;
    }

    try {
      toast.loading('上传中...');
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${uploadTarget.type}/${uploadTarget.key}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('backgrounds')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        toast.dismiss();
        toast.error('上传失败');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(fileName);

      if (uploadTarget.type === 'app') {
        const newIcons = { ...appIcons, [uploadTarget.key]: publicUrl };
        setAppIcons(newIcons);
        
        const allData: Record<string, unknown> = { ...newIcons, ...pageImages, desktop_layout: layout };
        await supabase
          .from('customization')
          .upsert({ user_id: user.id, app_icons: allData as Record<string, unknown> } as any, { onConflict: 'user_id' });
      } else {
        const newImages = { ...pageImages, [uploadTarget.key]: publicUrl };
        setPageImages(newImages);
        
        const allData: Record<string, unknown> = { ...appIcons, ...newImages, desktop_layout: layout };
        await supabase
          .from('customization')
          .upsert({ user_id: user.id, app_icons: allData as Record<string, unknown> } as any, { onConflict: 'user_id' });
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

  const handleCellClick = (cellKey: string) => {
    const item = layout[cellKey];
    
    if (editMode) {
      if (draggedItem) {
        // 交换位置
        swapItems(draggedItem, cellKey);
        setDraggedItem(null);
      } else if (item) {
        // 选中要移动的项
        if (item.type === 'image-part') {
          setDraggedItem(item.parentKey!);
        } else {
          setDraggedItem(cellKey);
        }
      } else {
        // 点击空格子，如果有选中项则移动到这里
        if (selectedCell) {
          moveItemToCell(selectedCell, cellKey);
          setSelectedCell(null);
        }
      }
    } else {
      // 非编辑模式，执行正常操作
      if (item?.type === 'app' && item.appId) {
        const app = allApps.find(a => a.id === item.appId);
        if (app) navigate(app.route);
      } else if (item?.type === 'image') {
        setUploadTarget({ type: 'image', key: item.imageKey! });
        fileInputRef.current?.click();
      }
    }
  };

  const swapItems = (fromKey: string, toKey: string) => {
    const newLayout = { ...layout };
    const fromItem = newLayout[fromKey];
    const toItem = newLayout[toKey];
    
    // 简单交换单个格子的APP
    if (fromItem?.type === 'app' && (!toItem || toItem.type === 'app')) {
      newLayout[fromKey] = toItem || undefined as any;
      newLayout[toKey] = fromItem;
      
      // 清理undefined
      if (!newLayout[fromKey]) delete newLayout[fromKey];
      
      setLayout(newLayout);
      saveLayout(newLayout);
      toast.success('位置已交换');
    } else {
      toast.error('暂不支持移动大图，请使用添加/删除功能');
    }
  };

  const moveItemToCell = (fromKey: string, toKey: string) => {
    const newLayout = { ...layout };
    const fromItem = newLayout[fromKey];
    
    if (fromItem?.type === 'app' && !newLayout[toKey]) {
      newLayout[toKey] = fromItem;
      delete newLayout[fromKey];
      setLayout(newLayout);
      saveLayout(newLayout);
    }
  };

  const handleLongPress = (appId: string) => {
    setUploadTarget({ type: 'app', key: appId });
    fileInputRef.current?.click();
  };

  const addImageToCell = (cellKey: string) => {
    const newLayout = { ...layout };
    const imageKey = `img_${Date.now()}`;
    newLayout[cellKey] = { type: 'image', imageKey, span: { cols: 1, rows: 1 } };
    setLayout(newLayout);
    saveLayout(newLayout);
    
    // 立即触发上传
    setUploadTarget({ type: 'image', key: imageKey });
    fileInputRef.current?.click();
  };

  const removeItem = (cellKey: string) => {
    const newLayout = { ...layout };
    const item = newLayout[cellKey];
    
    if (item?.type === 'image') {
      // 删除大图及其parts
      Object.keys(newLayout).forEach(key => {
        if (newLayout[key]?.parentKey === cellKey) {
          delete newLayout[key];
        }
      });
      delete newLayout[cellKey];
    } else if (item?.type === 'app') {
      delete newLayout[cellKey];
    }
    
    setLayout(newLayout);
    saveLayout(newLayout);
    toast.success('已删除');
  };

  const getAppConfig = (appId: string) => allApps.find(a => a.id === appId);

  const renderCell = (row: number, col: number) => {
    const cellKey = `${row}-${col}`;
    const item = layout[cellKey];
    const isDragging = draggedItem === cellKey;
    
    // 如果是大图的一部分，不渲染
    if (item?.type === 'image-part') {
      return null;
    }
    
    // 空格子
    if (!item) {
      return (
        <motion.div
          key={cellKey}
          className={`aspect-square rounded-xl flex items-center justify-center transition-all ${
            editMode 
              ? 'bg-muted/30 border-2 border-dashed border-muted-foreground/20 cursor-pointer hover:bg-muted/50' 
              : ''
          }`}
          onClick={() => editMode && addImageToCell(cellKey)}
          whileTap={editMode ? { scale: 0.95 } : {}}
        >
          {editMode && <Plus className="w-4 h-4 text-muted-foreground/50" />}
        </motion.div>
      );
    }
    
    // APP图标
    if (item.type === 'app' && item.appId) {
      const app = getAppConfig(item.appId);
      if (!app) return null;
      
      return (
        <motion.div
          key={cellKey}
          className={`flex flex-col items-center gap-0.5 ${isDragging ? 'opacity-50' : ''}`}
          whileTap={{ scale: 0.9 }}
          animate={editMode ? { 
            rotate: [0, -1, 1, -1, 0],
            transition: { repeat: Infinity, duration: 0.4 }
          } : {}}
        >
          <motion.button
            onClick={() => handleCellClick(cellKey)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (editMode) removeItem(cellKey);
              else handleLongPress(item.appId!);
            }}
            className="relative"
          >
            {appIcons[item.appId] ? (
              <div className="w-14 h-14 rounded-[14px] shadow-soft overflow-hidden ring-1 ring-white/30">
                <img src={appIcons[item.appId]} alt={app.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={`w-14 h-14 rounded-[14px] ${app.bgColor} flex items-center justify-center shadow-soft`}>
                <app.icon className="w-6 h-6 text-white" strokeWidth={1.8} />
              </div>
            )}
            {editMode && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                <X className="w-3 h-3 text-white" />
              </div>
            )}
          </motion.button>
          <span className="text-[10px] font-medium text-foreground/80">{app.name}</span>
        </motion.div>
      );
    }
    
    // 大图
    if (item.type === 'image' && item.imageKey) {
      const span = item.span || { cols: 1, rows: 1 };
      const image = pageImages[item.imageKey];
      
      return (
        <motion.div
          key={cellKey}
          className={`rounded-xl overflow-hidden cursor-pointer bg-muted/40 flex items-center justify-center border border-dashed border-muted-foreground/20 relative`}
          style={{
            gridColumn: `span ${span.cols}`,
            gridRow: `span ${span.rows}`,
          }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleCellClick(cellKey)}
        >
          {image ? (
            <img src={image} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Plus className="w-5 h-5" />
              <span className="text-[10px]">上传图片</span>
            </div>
          )}
          {editMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeItem(cellKey);
              }}
              className="absolute top-1 right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}
        </motion.div>
      );
    }
    
    return null;
  };

  const renderDockIcon = (app: AppConfig) => (
    <motion.div
      key={app.id}
      className="flex flex-col items-center gap-0.5"
      whileTap={{ scale: 0.9 }}
    >
      <button
        onClick={() => navigate(app.route)}
        className="relative"
      >
        {appIcons[app.id] ? (
          <div className="w-14 h-14 rounded-[14px] shadow-soft overflow-hidden ring-1 ring-white/30">
            <img src={appIcons[app.id]} alt={app.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className={`w-14 h-14 rounded-[14px] ${app.bgColor} flex items-center justify-center shadow-soft`}>
            <app.icon className="w-6 h-6 text-white" strokeWidth={1.8} />
          </div>
        )}
      </button>
      <span className="text-[10px] font-medium text-foreground/80">{app.name}</span>
    </motion.div>
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
            setDraggedItem(null);
            if (!editMode) toast.success('编辑模式：点击图标交换位置，点击空格添加图片');
          }}
          className={`p-2 rounded-full transition-colors ${
            editMode ? 'bg-primary text-primary-foreground' : 'bg-muted/50'
          }`}
        >
          {editMode ? <Check className="w-4 h-4" /> : <Move className="w-4 h-4" />}
        </button>
      </div>

      {/* Edit mode hint */}
      <AnimatePresence>
        {editMode && draggedItem && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mb-2 p-2 bg-primary/10 rounded-lg text-center text-xs text-primary"
          >
            点击另一个图标交换位置
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main grid */}
      <div className="flex-1 px-3 overflow-auto">
        <div 
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridAutoRows: '70px',
          }}
        >
          {Array.from({ length: GRID_ROWS }).map((_, row) =>
            Array.from({ length: GRID_COLS }).map((_, col) => renderCell(row, col))
          )}
        </div>
      </div>

      {/* Bottom area */}
      <div className="pb-3 flex flex-col items-center gap-2 mt-2">
        <button
          onClick={() => navigate('/?locked=true')}
          className="text-xs text-foreground/60 hover:text-foreground/80 transition-colors"
        >
          返回锁屏
        </button>

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
