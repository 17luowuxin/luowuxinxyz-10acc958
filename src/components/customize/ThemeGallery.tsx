import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Download, Check, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Theme {
  id: string;
  name: string;
  description: string | null;
  preview_url: string | null;
  chat_background_url: string | null;
  global_background_url: string | null;
  lock_screen_bg_url: string | null;
  lock_screen_video_url: string | null;
  video_background_url: string | null;
  app_icons: Record<string, string> | null;
  desktop_widgets: string[] | null;
}

interface ThemeGalleryProps {
  onThemeApplied?: () => void;
}

const PREVIEW_COUNT = 4; // 默认只显示4个主题

const ThemeGallery: React.FC<ThemeGalleryProps> = ({ onThemeApplied }) => {
  const { user } = useAuth();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    fetchThemes();
  }, []);

  const fetchThemes = async () => {
    const { data, error } = await supabase
      .from('themes')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching themes:', error);
      setLoading(false);
      return;
    }
    
    setThemes((data || []) as Theme[]);
    setLoading(false);
  };

  const applyTheme = async (theme: Theme) => {
    if (!user) {
      toast.error('请先登录');
      return;
    }

    setApplying(theme.id);

    try {
      // 准备更新数据
      const updateData: Record<string, any> = {};
      
      if (theme.chat_background_url) {
        updateData.chat_background_url = theme.chat_background_url;
      }
      if (theme.global_background_url) {
        updateData.global_background_url = theme.global_background_url;
      }
      if (theme.lock_screen_bg_url) {
        updateData.lock_screen_bg_url = theme.lock_screen_bg_url;
      }
      if (theme.lock_screen_video_url) {
        updateData.lock_screen_video_url = theme.lock_screen_video_url;
      }
      if (theme.video_background_url) {
        updateData.video_background_url = theme.video_background_url;
      }
      
      // 先获取现有的 app_icons
      const { data: existingData } = await supabase
        .from('customization')
        .select('app_icons')
        .eq('user_id', user.id)
        .single();
      
      const existingIcons = (existingData?.app_icons as Record<string, string>) || {};
      
      // 合并主题图标
      let mergedIcons = { ...existingIcons };
      
      if (theme.app_icons && Object.keys(theme.app_icons).length > 0) {
        mergedIcons = {
          ...mergedIcons,
          ...theme.app_icons
        };
      }
      
      // 合并桌面大图 (desktop_widgets -> page_image_top/mid/bottom)
      if (theme.desktop_widgets && theme.desktop_widgets.length > 0) {
        const widgetKeys = ['page_image_top', 'page_image_mid', 'page_image_bottom'];
        theme.desktop_widgets.forEach((url, index) => {
          if (url && widgetKeys[index]) {
            mergedIcons[widgetKeys[index]] = url;
          }
        });
      }
      
      // 只有有变化时才更新 app_icons
      if (Object.keys(mergedIcons).length > 0) {
        updateData.app_icons = mergedIcons;
      }

      const { error } = await supabase
        .from('customization')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error applying theme:', error);
        toast.error('应用主题失败');
        return;
      }

      // 清除缓存
      sessionStorage.removeItem(`bg_${user.id}`);
      
      const iconCount = theme.app_icons ? Object.keys(theme.app_icons).length : 0;
      const widgetCount = theme.desktop_widgets ? theme.desktop_widgets.filter(w => w).length : 0;
      const description = [
        iconCount > 0 ? `${iconCount}个APP图标` : '',
        widgetCount > 0 ? `${widgetCount}张桌面大图` : ''
      ].filter(Boolean).join(' + ');
      
      toast.success(`已应用主题: ${theme.name}`, {
        description: description || undefined
      });
      onThemeApplied?.();
    } catch (err) {
      console.error('Error:', err);
      toast.error('应用主题失败');
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            主题商店
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (themes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            主题商店
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">暂无可用主题</p>
        </CardContent>
      </Card>
    );
  }

  const displayedThemes = showAll ? themes : themes.slice(0, PREVIEW_COUNT);
  const hasMore = themes.length > PREVIEW_COUNT;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="w-4 h-4" />
              主题商店
            </CardTitle>
            {hasMore && !showAll && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary h-7 px-2"
                onClick={() => setShowAll(true)}
              >
                查看更多
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2">
            {displayedThemes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                applying={applying}
                onApply={applyTheme}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full Theme Gallery Modal */}
      <AnimatePresence>
        {showAll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto"
          >
            <div className="min-h-screen p-4">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-background/90 backdrop-blur py-2 -mx-4 px-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  全部主题
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAll(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {themes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    applying={applying}
                    onApply={applyTheme}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// 提取主题卡片组件
interface ThemeCardProps {
  theme: Theme;
  applying: string | null;
  onApply: (theme: Theme) => void;
}

const ThemeCard: React.FC<ThemeCardProps> = ({ theme, applying, onApply }) => {
  const iconCount = theme.app_icons ? Object.keys(theme.app_icons).length : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className="relative rounded-xl overflow-hidden border bg-card"
    >
      {theme.preview_url ? (
        <img
          src={theme.preview_url}
          alt={theme.name}
          className="w-full aspect-[3/4] object-cover"
        />
      ) : (
        <div className="w-full aspect-[3/4] bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          <Palette className="w-10 h-10 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="font-medium text-white text-xs truncate">{theme.name}</p>
        <p className="text-[10px] text-white/70 truncate">
          {iconCount > 0 ? `${iconCount}个图标` : ''} 
          {theme.description && iconCount > 0 ? ' · ' : ''}
          {theme.description || (iconCount === 0 ? '壁纸主题' : '')}
        </p>
        <Button
          size="sm"
          className="w-full mt-1.5 h-7 text-xs"
          onClick={() => onApply(theme)}
          disabled={applying === theme.id}
        >
          {applying === theme.id ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
          ) : (
            <>
              <Download className="w-3 h-3 mr-1" />
              应用
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
};

export default ThemeGallery;
