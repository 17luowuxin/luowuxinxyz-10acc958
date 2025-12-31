import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Palette, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
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
}

interface ThemeGalleryProps {
  onThemeApplied?: () => void;
}

const ThemeGallery: React.FC<ThemeGalleryProps> = ({ onThemeApplied }) => {
  const { user } = useAuth();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
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
      
      // 合并 APP 图标
      if (theme.app_icons && Object.keys(theme.app_icons).length > 0) {
        // 先获取现有的 app_icons
        const { data: existingData } = await supabase
          .from('customization')
          .select('app_icons')
          .eq('user_id', user.id)
          .single();
        
        const existingIcons = (existingData?.app_icons as Record<string, string>) || {};
        
        // 合并主题图标（主题图标覆盖现有的）
        updateData.app_icons = {
          ...existingIcons,
          ...theme.app_icons
        };
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
      toast.success(`已应用主题: ${theme.name}`, {
        description: iconCount > 0 ? `包含 ${iconCount} 个APP图标` : undefined
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5" />
          主题商店
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {themes.map((theme) => {
            const iconCount = theme.app_icons ? Object.keys(theme.app_icons).length : 0;
            
            return (
              <motion.div
                key={theme.id}
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
                    <Palette className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="font-medium text-white text-sm truncate">{theme.name}</p>
                  <p className="text-xs text-white/70 truncate">
                    {iconCount > 0 ? `${iconCount}个图标` : ''} 
                    {theme.description && iconCount > 0 ? ' · ' : ''}
                    {theme.description || (iconCount === 0 ? '壁纸主题' : '')}
                  </p>
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => applyTheme(theme)}
                    disabled={applying === theme.id}
                  >
                    {applying === theme.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" />
                        一键应用
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ThemeGallery;
