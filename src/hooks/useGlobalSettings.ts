import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalTable, isLocalModeEnabled } from '@/lib/localDataStore';
import { applyStoredFont, BUILT_IN_FONTS } from '@/lib/customFonts';

export const applyGlobalTextColor = (color: string) => {
  const style = document.getElementById('global-text-color-style') || document.createElement('style');
  style.id = 'global-text-color-style';
  style.textContent = `
    .desktop-text, .lock-screen-text { color: ${color} !important; }
  `;
  if (!document.getElementById('global-text-color-style')) {
    document.head.appendChild(style);
  }
  localStorage.setItem('globalTextColor', color);
};

export const applyGlobalTextSize = (size: number) => {
  const style = document.getElementById('global-text-size-style') || document.createElement('style');
  style.id = 'global-text-size-style';
  style.textContent = `
    .desktop-text { font-size: ${size}px !important; }
  `;
  if (!document.getElementById('global-text-size-style')) {
    document.head.appendChild(style);
  }
  localStorage.setItem('globalTextSize', String(size));
};

export const useGlobalSettings = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [localMode, setLocalMode] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) {
      setLocalMode(false);
      return;
    }
    isLocalModeEnabled(userId).then(setLocalMode);
  }, [userId]);

  // Apply saved settings from localStorage on mount (before user loads)
  useEffect(() => {
    const savedFont = localStorage.getItem('selectedFont');
    if (savedFont && BUILT_IN_FONTS.some((font) => font.id === savedFont)) void applyStoredFont(savedFont);
    applyGlobalTextColor('#000000');
    applyGlobalTextSize(12);
  }, []);

  const loadSettings = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (localMode === null) return;
    
    try {
      const data = localMode
        ? (await getLocalTable(userId, 'customization')).find((row) => row.user_id === userId)
        : (await supabase
            .from('customization')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle()).data;

      if (data) {
        setSettings(data);
        
        // Apply font globally
        const fontId = localStorage.getItem('selectedFont') || (data as any).font_family || 'default';
        await applyStoredFont(fontId, userId);

        // 桌面文字固定使用小号黑色，避免旧设置继续覆盖。
        applyGlobalTextColor('#000000');
        applyGlobalTextSize(12);
        
        // Apply theme
        if (data.theme) {
          document.documentElement.classList.remove('theme-pink', 'theme-blue', 'theme-orange', 'theme-green', 'theme-purple', 'theme-dark');
          document.documentElement.classList.add(`theme-${data.theme}`);
        }
      } else {
        await applyStoredFont(localStorage.getItem('selectedFont') || 'default', userId);
        applyGlobalTextColor('#000000');
        applyGlobalTextSize(12);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, localMode]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return { settings, loading, reloadSettings: loadSettings };
};

export default useGlobalSettings;
