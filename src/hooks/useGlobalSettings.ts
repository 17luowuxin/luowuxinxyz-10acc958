import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Font options mapping
const fontFamilyMap: Record<string, string> = {
  'default': 'Nunito, sans-serif',
  'kuaile': '"ZCOOL KuaiLe", cursive',
  'mashan': '"Ma Shan Zheng", cursive',
  'xiaowei': '"ZCOOL XiaoWei", serif',
  'liujian': '"Liu Jian Mao Cao", cursive',
  'longcang': '"Long Cang", cursive',
};

const applyFont = (fontId: string) => {
  const fontFamily = fontFamilyMap[fontId] || fontFamilyMap['default'];
  document.documentElement.style.fontFamily = fontFamily;
  document.body.style.fontFamily = fontFamily;
  
  // Apply to all elements using style tag
  const style = document.createElement('style');
  style.id = 'global-font-style';
  style.textContent = `* { font-family: ${fontFamily} !important; }`;
  
  // Remove old style if exists
  const oldStyle = document.getElementById('global-font-style');
  if (oldStyle) oldStyle.remove();
  
  document.head.appendChild(style);
  
  // Save to localStorage for persistence
  localStorage.setItem('selectedFont', fontId);
};

export const useGlobalSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Apply saved font from localStorage on mount (before user loads)
  useEffect(() => {
    const savedFont = localStorage.getItem('selectedFont');
    if (savedFont) {
      applyFont(savedFont);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const { data } = await supabase
        .from('customization')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setSettings(data);
        
        // Apply font globally
        const fontId = (data as any).font_family || 'default';
        applyFont(fontId);
        
        // Apply theme
        if (data.theme) {
          document.documentElement.classList.remove('theme-pink', 'theme-blue', 'theme-orange', 'theme-green', 'theme-purple', 'theme-dark');
          document.documentElement.classList.add(`theme-${data.theme}`);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return { settings, loading, reloadSettings: loadSettings };
};

export default useGlobalSettings;