import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Upload, Sparkles, Globe, Palette, Check, X, Type, User, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { applyFontChoice, BUILT_IN_FONTS, FontChoice, loadCustomFonts } from '@/lib/customFonts';
import {
  getLocalAssetUrl,
  getLocalTable,
  insertLocalRow,
  isLocalModeEnabled,
  saveLocalAsset,
  upsertLocalRow,
} from '@/lib/localDataStore';

// 预设头像框
import dreamFrame from '@/assets/avatar-frames/dream-frame.png';
// 头像装饰图片
import animeHeadDecor from '@/assets/bubble-frames/anime-head-decor.png';
import cuteBoyHead from '@/assets/bubble-frames/cute-boy-head.png';

const ThemeGallery = React.lazy(() => import('@/components/customize/ThemeGallery'));

const avatarFramePresets = [
  { id: 'none', name: '无', url: '' },
  { id: 'dream', name: '梦幻', url: dreamFrame },
];

// CSS实现的可爱气泡样式 - 带三丽鸥装饰 + 头像装饰
const bubbleFramePresets = [
  { id: 'none', name: '无', type: 'css', gradient: '', borderColor: '', decorColor: '', decorIcon: '', decorImage: '' },
  { id: 'cute-pink', name: '樱花粉', type: 'css', gradient: 'linear-gradient(135deg, #FFE4EC 0%, #FFB5C5 100%)', borderColor: '#FFB5C5', decorColor: '#FF9EAE', decorIcon: '🎀', decorImage: '' },
  { id: 'cute-blue', name: '天空蓝', type: 'css', gradient: 'linear-gradient(135deg, #E4F4FF 0%, #B5D8FF 100%)', borderColor: '#B5D8FF', decorColor: '#7DD8FF', decorIcon: '☁️', decorImage: '' },
  { id: 'cute-yellow', name: '柠檬黄', type: 'css', gradient: 'linear-gradient(135deg, #FFF9E4 0%, #FFFAB5 100%)', borderColor: '#FFE066', decorColor: '#FFD93D', decorIcon: '⭐', decorImage: '' },
  { id: 'cute-green', name: '薄荷绿', type: 'css', gradient: 'linear-gradient(135deg, #E4FFF4 0%, #B5FFD8 100%)', borderColor: '#B5FFD8', decorColor: '#6BCB77', decorIcon: '🍀', decorImage: '' },
  { id: 'cute-purple', name: '梦幻紫', type: 'css', gradient: 'linear-gradient(135deg, #F4E4FF 0%, #E5B5FF 100%)', borderColor: '#E5B5FF', decorColor: '#C77DFF', decorIcon: '💜', decorImage: '' },
  // 水滴透明磨砂气泡框 - 高光立体效果
  { id: 'water-drop', name: '水滴磨砂', type: 'css', gradient: 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.4) 15%, rgba(200,230,255,0.35) 40%, rgba(170,210,255,0.25) 70%, rgba(255,255,255,0.5) 100%)', borderColor: 'rgba(255,255,255,0.8)', decorColor: '#87CEEB', decorIcon: '', decorImage: '', boxShadow: 'inset 0 4px 12px rgba(255,255,255,0.9), inset 0 -3px 8px rgba(100,180,255,0.25), inset 3px 0 8px rgba(255,255,255,0.5), inset -3px 0 8px rgba(255,255,255,0.5), 0 6px 20px rgba(80,140,200,0.3), 0 2px 6px rgba(255,255,255,0.6)', highlight: 'radial-gradient(ellipse 70% 50% at 25% 15%, rgba(255,255,255,0.8) 0%, transparent 60%)' },
  // 带卡通头像装饰的黑红渐变气泡框
  { id: 'anime-head', name: '动漫头像', type: 'css', gradient: 'linear-gradient(180deg, #1a1a1a 0%, #2a0000 50%, #8b0000 100%)', borderColor: '#8b0000', decorColor: '', decorIcon: '', decorImage: animeHeadDecor },
  // 可爱男孩气泡框 - 白底黑边+边缘贴卡通小人
  { id: 'cute-boy', name: '可爱男孩', type: 'css', gradient: '#FFFFFF', borderColor: '#000000', decorColor: '', decorIcon: '', decorImage: cuteBoyHead },
];

// Pastel macaron colors
const macaronColors = [
  '#FFB5C5', // pastel pink
  '#B5D8FF', // pastel blue  
  '#FFDAB5', // pastel orange
  '#B5FFD8', // pastel green
  '#E5B5FF', // pastel purple
  '#FFFAB5', // pastel yellow
  '#B5FFF5', // pastel teal
  '#FFD5E5', // light pink
];

const bubbleStyles = [
  { id: 'rounded', label: '圆润' },
  { id: 'cloud', label: '云朵' },
  { id: 'square', label: '方正' },
  { id: 'glass', label: '玻璃' },
];

// Theme options
const themeOptions = [
  { id: 'pink', name: '可爱粉', colors: ['#FF9EAE', '#FFB5D8'] },
  { id: 'blue', name: '酷炫蓝', colors: ['#5CC8FF', '#7DD8FF'] },
  { id: 'orange', name: '温暖橙', colors: ['#FFB347', '#FFCC80'] },
  { id: 'green', name: '自然绿', colors: ['#77DD77', '#98FB98'] },
  { id: 'purple', name: '神秘紫', colors: ['#C77DFF', '#E0AAFF'] },
  { id: 'dark', name: '暗夜黑', colors: ['#444444', '#666666'] },
];

type AppearanceSectionId = 'theme' | 'wallpaper' | 'chat' | 'novel';

const AppearanceSectionButton = ({
  id,
  openSection,
  onToggle,
  icon,
  title,
  subtitle,
  orderClass,
}: {
  id: AppearanceSectionId;
  openSection: AppearanceSectionId | null;
  onToggle: (id: AppearanceSectionId) => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  orderClass: string;
}) => {
  const isOpen = openSection === id;
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      aria-expanded={isOpen}
      className={`${orderClass} w-full rounded-2xl border px-4 py-3.5 text-left transition-all ${isOpen ? 'border-primary/25 bg-card shadow-sm' : 'border-white/70 bg-card/65 hover:bg-card'}`}
    >
      <span className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 text-primary">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </span>
    </button>
  );
};

const CustomizePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bubbleColor, setBubbleColor] = useState('#FFB5C5');
  const [friendBubbleColor, setFriendBubbleColor] = useState('#B5D8FF');
  const [bubbleStyle, setBubbleStyle] = useState('rounded');
  const [opacity, setOpacity] = useState([1]);
  const [bubbleSize, setBubbleSize] = useState([16]);
  const [chatBackgroundUrl, setChatBackgroundUrl] = useState('');
  const [globalBackgroundUrl, setGlobalBackgroundUrl] = useState('');
  const [storedChatBackgroundUrl, setStoredChatBackgroundUrl] = useState('');
  const [storedGlobalBackgroundUrl, setStoredGlobalBackgroundUrl] = useState('');
  const [currentTheme, setCurrentTheme] = useState('pink');
  const [currentFont, setCurrentFont] = useState('default');
  const [customFonts, setCustomFonts] = useState<FontChoice[]>([]);
  const [openSection, setOpenSection] = useState<AppearanceSectionId | null>(null);
  const [fontColor, setFontColor] = useState('#333333');
  const [friendFontColor, setFriendFontColor] = useState('#333333');
  const [uploading, setUploading] = useState(false);
  const [globalUploading, setGlobalUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const globalFileInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const [avatarFrame, setAvatarFrame] = useState('');
  const [friendAvatarFrame, setFriendAvatarFrame] = useState('');
  const [bubbleFrame, setBubbleFrame] = useState('');
  const [friendBubbleFrame, setFriendBubbleFrame] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [characterPreview, setCharacterPreview] = useState<any>(null);
  // 小说模式颜色
  const [novelDialogueColor, setNovelDialogueColor] = useState('#e91e63');
  const [novelNarrationColor, setNovelNarrationColor] = useState('#666666');
  const [novelActionColor, setNovelActionColor] = useState('#9c27b0');
  const [novelThoughtColor, setNovelThoughtColor] = useState('#607d8b');
  const [localMode, setLocalMode] = useState<boolean | null>(null);
  const fetchSettingsRef = useRef<() => Promise<void>>(async () => undefined);
  const fetchUserProfileRef = useRef<() => Promise<void>>(async () => undefined);
  const fetchFirstCharacterRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    if (!user) {
      setLocalMode(false);
      return;
    }
    isLocalModeEnabled(user.id).then(setLocalMode);
  }, [user]);

  useEffect(() => {
    if (user && localMode !== null) {
      void fetchSettingsRef.current();
    }
  }, [user, localMode]);

  useEffect(() => {
    if (openSection === 'chat' && user && localMode !== null) {
      void fetchUserProfileRef.current();
      void fetchFirstCharacterRef.current();
    }
  }, [openSection, user, localMode]);

  useEffect(() => {
    if (!user) return;
    void loadCustomFonts(user.id).then(setCustomFonts);
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const data = localMode
      ? (await getLocalTable(user.id, 'profiles')).find((row) => row.user_id === user.id)
      : (await supabase.from('profiles').select('nickname, avatar_url').eq('user_id', user.id).single()).data;
    if (data) {
      const avatarUrl = data.avatar_url ? String(data.avatar_url) : '';
      setUserProfile({
        ...data,
        avatar_url: avatarUrl && localMode ? await getLocalAssetUrl(user.id, avatarUrl) : avatarUrl,
      });
    }
  };
  fetchUserProfileRef.current = fetchUserProfile;

  const fetchFirstCharacter = async () => {
    if (!user) return;
    const data = localMode
      ? (await getLocalTable(user.id, 'characters')).find((row) => row.user_id === user.id)
      : (await supabase.from('characters').select('name, avatar_url').eq('user_id', user.id).limit(1).single()).data;
    if (data) {
      const avatarUrl = data.avatar_url ? String(data.avatar_url) : '';
      setCharacterPreview({
        ...data,
        avatar_url: avatarUrl && localMode ? await getLocalAssetUrl(user.id, avatarUrl) : avatarUrl,
      });
    }
  };
  fetchFirstCharacterRef.current = fetchFirstCharacter;

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.remove('theme-pink', 'theme-blue', 'theme-orange', 'theme-green', 'theme-purple', 'theme-dark');
    document.documentElement.classList.add(`theme-${currentTheme}`);
  }, [currentTheme]);

  // Apply font to document
  useEffect(() => {
    const font = [...BUILT_IN_FONTS, ...customFonts].find((item) => item.id === currentFont);
    if (font) applyFontChoice(font);
  }, [currentFont, customFonts]);

  const fetchSettings = async () => {
    if (!user) return;
    const data = localMode
      ? (await getLocalTable(user.id, 'customization')).find((row) => row.user_id === user.id)
      : (await supabase.from('customization').select('*').eq('user_id', user.id).maybeSingle()).data;
    if (data) {
      setBubbleColor(data.bubble_color || '#FFB5C5');
      setFriendBubbleColor(data.friend_bubble_color || '#B5D8FF');
      setBubbleStyle(data.bubble_style || 'rounded');
      setOpacity([Number(data.bubble_opacity) || 1]);
      setBubbleSize([(data as any).bubble_size || 16]);
      const chatUrl = String(data.chat_background_url || '');
      const globalUrl = String(data.global_background_url || '');
      setStoredChatBackgroundUrl(chatUrl);
      setStoredGlobalBackgroundUrl(globalUrl);
      setChatBackgroundUrl(chatUrl && localMode ? await getLocalAssetUrl(user.id, chatUrl) : chatUrl);
      setGlobalBackgroundUrl(globalUrl && localMode ? await getLocalAssetUrl(user.id, globalUrl) : globalUrl);
      if (data.theme) setCurrentTheme(data.theme);
      if ((data as any).font_family) setCurrentFont((data as any).font_family);
      if ((data as any).font_color) setFontColor((data as any).font_color);
      if ((data as any).friend_font_color) setFriendFontColor((data as any).friend_font_color);
      if ((data as any).avatar_frame_url) setAvatarFrame((data as any).avatar_frame_url);
      if ((data as any).friend_avatar_frame_url) setFriendAvatarFrame((data as any).friend_avatar_frame_url);
      if ((data as any).bubble_frame_url) setBubbleFrame((data as any).bubble_frame_url);
      if ((data as any).friend_bubble_frame_url) setFriendBubbleFrame((data as any).friend_bubble_frame_url);
      // 小说模式颜色
      if ((data as any).novel_dialogue_color) setNovelDialogueColor((data as any).novel_dialogue_color);
      if ((data as any).novel_narration_color) setNovelNarrationColor((data as any).novel_narration_color);
      if ((data as any).novel_action_color) setNovelActionColor((data as any).novel_action_color);
      if ((data as any).novel_thought_color) setNovelThoughtColor((data as any).novel_thought_color);
    }
  };
  fetchSettingsRef.current = fetchSettings;

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setUploading(true);
    toast.loading('正在压缩图片...');
    
    try {
      // 压缩背景图（最大宽度1920px，质量0.8）
      const { compressImage, blobToFile } = await import('@/utils/imageCompressor');
      const compressedBlob = await compressImage(file, 1920, 0.8);
      if (localMode) {
        const sourceUrl = `local-asset://chat-bg-${crypto.randomUUID()}`;
        await saveLocalAsset(user.id, sourceUrl, compressedBlob);
        setStoredChatBackgroundUrl(sourceUrl);
        setChatBackgroundUrl(await getLocalAssetUrl(user.id, sourceUrl));
        setUploading(false);
        toast.dismiss();
        toast.success('背景图已保存到本机');
        return;
      }
      const compressedFile = blobToFile(compressedBlob, file.name);
      
      const fileName = `${user.id}/chat-bg-${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, compressedFile, {
        cacheControl: '3600',
        upsert: true
      });
      
      if (uploadError) {
        toast.dismiss();
        toast.error('上传失败');
        setUploading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const nextUrl = publicUrl + '?t=' + Date.now();
      setStoredChatBackgroundUrl(nextUrl);
      setChatBackgroundUrl(nextUrl);
      toast.dismiss();
      toast.success('背景图上传成功');
    } catch (error) {
      console.error('Background upload error:', error);
      toast.dismiss();
      toast.error('上传失败');
    }
    setUploading(false);
  };

  const handleGlobalBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setGlobalUploading(true);
    toast.loading('正在压缩图片...');
    
    try {
      // 压缩全局背景（最大宽度1920px，质量0.8）
      const { compressImage, blobToFile } = await import('@/utils/imageCompressor');
      const compressedBlob = await compressImage(file, 1920, 0.8);
      if (localMode) {
        const sourceUrl = `local-asset://global-bg-${crypto.randomUUID()}`;
        await saveLocalAsset(user.id, sourceUrl, compressedBlob);
        setStoredGlobalBackgroundUrl(sourceUrl);
        setGlobalBackgroundUrl(await getLocalAssetUrl(user.id, sourceUrl));
        setGlobalUploading(false);
        toast.dismiss();
        toast.success('全局背景已保存到本机');
        return;
      }
      const compressedFile = blobToFile(compressedBlob, file.name);
      
      const fileName = `${user.id}/global-bg-${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, compressedFile, {
        cacheControl: '3600',
        upsert: true
      });
      
      if (uploadError) {
        toast.dismiss();
        toast.error('上传失败');
        setGlobalUploading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const nextUrl = publicUrl + '?t=' + Date.now();
      setStoredGlobalBackgroundUrl(nextUrl);
      setGlobalBackgroundUrl(nextUrl);
      toast.dismiss();
      toast.success('全局背景图上传成功');
    } catch (error) {
      console.error('Global background upload error:', error);
      toast.dismiss();
      toast.error('上传失败');
    }
    setGlobalUploading(false);
  };

  const handleFontUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['ttf', 'otf', 'woff', 'woff2'].includes(extension)) {
      toast.error('请选择 TTF、OTF、WOFF 或 WOFF2 字体文件');
      event.target.value = '';
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error('字体文件请小于 12MB');
      event.target.value = '';
      return;
    }

    const id = crypto.randomUUID();
    const sourceUrl = `local-asset://font-${id}`;
    const name = file.name.replace(/\.[^.]+$/, '') || '自定义字体';
    await saveLocalAsset(user.id, sourceUrl, file);
    await insertLocalRow(user.id, 'custom_fonts', { id, user_id: user.id, name, source_url: sourceUrl });
    const fonts = await loadCustomFonts(user.id);
    setCustomFonts(fonts);
    setCurrentFont(id);
    toast.success('字体已导入并保存在本机');
    event.target.value = '';
  };

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId);
    toast.success(`已切换到${themeOptions.find(t => t.id === themeId)?.name}主题`);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('未登录，无法保存');
      return;
    }

    // Clear session cache to force reload
    sessionStorage.removeItem(`bg_${user.id}_local`);
    sessionStorage.removeItem(`bg_${user.id}_cloud`);

    // Full payload with all fields
    const fullPayload: Record<string, any> = {
      user_id: user.id,
      bubble_color: bubbleColor,
      friend_bubble_color: friendBubbleColor,
      bubble_style: bubbleStyle,
      bubble_opacity: opacity[0],
      bubble_size: bubbleSize[0],
      chat_background_url: storedChatBackgroundUrl || null,
      global_background_url: storedGlobalBackgroundUrl || null,
      theme: currentTheme,
      font_family: currentFont,
      font_color: fontColor,
      friend_font_color: friendFontColor,
      avatar_frame_url: avatarFrame || null,
      friend_avatar_frame_url: friendAvatarFrame || null,
      bubble_frame_url: bubbleFrame || null,
      friend_bubble_frame_url: friendBubbleFrame || null,
      global_text_color: '#000000',
      global_text_size: 12,
      novel_dialogue_color: novelDialogueColor,
      novel_narration_color: novelNarrationColor,
      novel_action_color: novelActionColor,
      novel_thought_color: novelThoughtColor,
    };

    console.log('[Save] Attempting upsert with full payload');

    if (localMode) {
      await upsertLocalRow(
        user.id,
        'customization',
        (row) => row.user_id === user.id,
        fullPayload,
      );
      toast.success('美化设置已保存到本机');
      return;
    }

    const { data, error } = await supabase
      .from('customization')
      .upsert(fullPayload as any, { onConflict: 'user_id' })
      .select();

    if (error) {
      console.warn('[Save] Full payload failed, trying minimal payload:', error.message);
      
      // Fallback: remove fields that might not exist in external DB schema cache
      const minimalPayload: Record<string, any> = {
        user_id: user.id,
        bubble_color: bubbleColor,
        friend_bubble_color: friendBubbleColor,
        bubble_style: bubbleStyle,
        bubble_opacity: opacity[0],
        chat_background_url: storedChatBackgroundUrl || null,
        theme: currentTheme,
        font_color: fontColor,
        friend_font_color: friendFontColor,
        global_text_color: '#000000',
      };

      // Try adding optional fields one concept at a time
      const optionalFields: Record<string, any> = {
        bubble_size: bubbleSize[0],
        global_background_url: storedGlobalBackgroundUrl || null,
        font_family: currentFont,
        avatar_frame_url: avatarFrame || null,
        friend_avatar_frame_url: friendAvatarFrame || null,
        bubble_frame_url: bubbleFrame || null,
        friend_bubble_frame_url: friendBubbleFrame || null,
        global_text_size: 12,
        novel_dialogue_color: novelDialogueColor,
        novel_narration_color: novelNarrationColor,
        novel_action_color: novelActionColor,
        novel_thought_color: novelThoughtColor,
      };

      // Try with all optional fields first
      const retryPayload = { ...minimalPayload, ...optionalFields };
      const { data: d2, error: e2 } = await supabase
        .from('customization')
        .upsert(retryPayload as any, { onConflict: 'user_id' })
        .select();

      if (e2) {
        // Last resort: strip the problematic field mentioned in error
        const problemField = e2.message?.match(/column '(\w+)'/)?.[1];
        if (problemField && retryPayload[problemField] !== undefined) {
          console.warn(`[Save] Removing problematic field: ${problemField}`);
          delete retryPayload[problemField];
          const { data: d3, error: e3 } = await supabase
            .from('customization')
            .upsert(retryPayload as any, { onConflict: 'user_id' })
            .select();
          if (e3) {
            console.error('[Save] Final fallback failed:', JSON.stringify(e3, null, 2));
            toast.error(`保存失败 [${e3.code}]: ${e3.message}`, { duration: 10000 });
            return;
          }
          console.log('[Save] Saved with fallback (missing field:', problemField, ')');
          toast.success(`美化已保存（${problemField} 字段暂不支持，请在外部数据库添加后重试）`);
        } else {
          console.error('[Save] Retry failed:', JSON.stringify(e2, null, 2));
          toast.error(`保存失败 [${e2.code}]: ${e2.message}`, { duration: 10000 });
          return;
        }
      } else {
        console.log('[Save] Retry success:', d2);
        toast.success('美化设置已保存！');
      }
    } else {
      console.log('[Save] Success, returned data:', data);
      toast.success('美化设置已保存！返回桌面查看效果');
    }
    
  };

  const getBubblePreviewClass = (style: string, isUser: boolean) => {
    const base = 'px-4 py-2';
    switch (style) {
      case 'cloud':
        return `${base} rounded-3xl ${isUser ? 'rounded-br-lg' : 'rounded-bl-lg'}`;
      case 'square':
        return `${base} rounded-lg ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`;
      default:
        return `${base} rounded-2xl ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`;
    }
  };

  return (
    <div className="min-h-screen bg-background/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold ml-2 text-primary">美化</h1>
        </div>
        <Button variant="candy" onClick={handleSave} className="rounded-full px-6">
          保存
        </Button>
      </div>

      <div className="flex flex-col gap-3 p-4 pb-24">
        <AppearanceSectionButton orderClass="order-[10]" id="theme" openSection={openSection} onToggle={(id) => setOpenSection((current) => current === id ? null : id)} icon={<Palette className="h-5 w-5" />} title="主题与字体" subtitle="主题商店、配色与全局字体" />
        <AppearanceSectionButton orderClass="order-[20]" id="wallpaper" openSection={openSection} onToggle={(id) => setOpenSection((current) => current === id ? null : id)} icon={<Globe className="h-5 w-5" />} title="壁纸与背景" subtitle="全局背景和聊天背景" />
        <AppearanceSectionButton orderClass="order-[30]" id="chat" openSection={openSection} onToggle={(id) => setOpenSection((current) => current === id ? null : id)} icon={<MessageCircle className="h-5 w-5" />} title="聊天外观" subtitle="头像框、气泡样式与预览" />
        <AppearanceSectionButton orderClass="order-[40]" id="novel" openSection={openSection} onToggle={(id) => setOpenSection((current) => current === id ? null : id)} icon={<Sparkles className="h-5 w-5" />} title="小说模式" subtitle="对话、旁白、动作和心理颜色" />

        {openSection === 'theme' && (
          <div className="order-[11] space-y-3">
            <React.Suspense fallback={<div className="rounded-2xl bg-card/70 p-4 text-center text-xs text-muted-foreground">正在加载主题...</div>}>
              <ThemeGallery onThemeApplied={fetchSettings} />
            </React.Suspense>

        {/* Theme Colors */}
        <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">主题颜色</h3>
          </div>
          <p className="text-muted-foreground text-sm mb-4">选择主题会改变整个应用的配色</p>
          
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className={`relative p-4 rounded-2xl transition-all ${
                  currentTheme === theme.id 
                    ? 'ring-2 ring-primary ring-offset-2' 
                    : 'bg-muted/50 hover:bg-muted'
                }`}
              >
                <div className="flex justify-center gap-1 mb-2">
                  <div 
                    className="w-6 h-6 rounded-full" 
                    style={{ backgroundColor: theme.colors[0] }}
                  />
                  <div 
                    className="w-6 h-6 rounded-full" 
                    style={{ backgroundColor: theme.colors[1] }}
                  />
                </div>
                <p className="text-sm font-medium text-center">{theme.name}</p>
                {currentTheme === theme.id && (
                  <Check className="absolute bottom-2 right-2 w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Font Selection */}
        <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <div className="flex items-center gap-2 mb-2">
            <Type className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">全局字体</h3>
          </div>
          <p className="text-muted-foreground text-sm mb-4">选择可爱的字体应用到全局</p>
          
          <div className="grid grid-cols-2 gap-3">
            {[...BUILT_IN_FONTS, ...customFonts].map((font) => (
              <button
                key={font.id}
                onClick={() => setCurrentFont(font.id)}
                className={`relative p-4 rounded-2xl transition-all text-left ${
                  currentFont === font.id 
                    ? 'ring-2 ring-primary ring-offset-2 bg-primary/5' 
                    : 'bg-muted/50 hover:bg-muted'
                }`}
              >
                <p className="text-lg mb-1" data-font-preview style={{ fontFamily: font.family }}>{font.preview}</p>
                <p className="text-xs text-muted-foreground">{font.name}</p>
                {currentFont === font.id && (
                  <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>
          <Button variant="outline" className="mt-3 w-full rounded-xl" onClick={() => fontInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />导入本机字体
          </Button>
          <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" className="hidden" onChange={handleFontUpload} />
        </div>
          </div>
        )}

        {/* Novel Mode Colors */}
        {openSection === 'novel' && (
        <div className="order-[41] bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">小说模式颜色</h3>
          </div>
          <p className="text-muted-foreground text-sm mb-4">自定义小说模式下各类文本的颜色</p>
          
          <div className="space-y-4">
            {/* Dialogue Color */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={novelDialogueColor}
                  onChange={(e) => setNovelDialogueColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-2 border-muted overflow-hidden"
                  style={{ padding: 0 }}
                />
                <div>
                  <p className="text-sm font-medium">对话颜色</p>
                  <p className="text-xs text-muted-foreground">「对话内容」的颜色</p>
                </div>
              </div>
              <span style={{ color: novelDialogueColor, fontWeight: 500 }}>「示例对话」</span>
            </div>

            {/* Narration Color */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={novelNarrationColor}
                  onChange={(e) => setNovelNarrationColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-2 border-muted overflow-hidden"
                  style={{ padding: 0 }}
                />
                <div>
                  <p className="text-sm font-medium">旁白颜色</p>
                  <p className="text-xs text-muted-foreground">叙述性文字的颜色</p>
                </div>
              </div>
              <span style={{ color: novelNarrationColor }}>这是旁白文字</span>
            </div>

            {/* Action Color */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={novelActionColor}
                  onChange={(e) => setNovelActionColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-2 border-muted overflow-hidden"
                  style={{ padding: 0 }}
                />
                <div>
                  <p className="text-sm font-medium">动作颜色</p>
                  <p className="text-xs text-muted-foreground">*动作描写* 的颜色</p>
                </div>
              </div>
              <span style={{ color: novelActionColor, fontStyle: 'italic' }}>*轻轻点头*</span>
            </div>

            {/* Thought Color */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={novelThoughtColor}
                  onChange={(e) => setNovelThoughtColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-2 border-muted overflow-hidden"
                  style={{ padding: 0 }}
                />
                <div>
                  <p className="text-sm font-medium">心理颜色</p>
                  <p className="text-xs text-muted-foreground">（心理活动）的颜色</p>
                </div>
              </div>
              <span style={{ color: novelThoughtColor, fontStyle: 'italic' }}>（心想）</span>
            </div>

            {/* Preview */}
            <div className="mt-4 p-4 rounded-2xl bg-muted/30 border border-primary/10">
              <p className="text-sm text-muted-foreground mb-2">预览效果：</p>
              <p className="text-sm leading-relaxed">
                <span style={{ color: novelNarrationColor }}>他看着窗外的风景，</span>
                <span style={{ color: novelActionColor, fontStyle: 'italic' }}>*微微叹了口气*</span>
                <span style={{ color: novelNarrationColor }}>。</span>
                <span style={{ color: novelDialogueColor, fontWeight: 500 }}>「今天的天气真好啊。」</span>
                <span style={{ color: novelThoughtColor, fontStyle: 'italic' }}>（如果能一直这样就好了）</span>
              </p>
            </div>
          </div>
        </div>
        )}

        {openSection === 'wallpaper' && (
        <div className="order-[21] space-y-3">
        <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">全局背景图</h3>
            </div>
            {globalBackgroundUrl && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setGlobalBackgroundUrl(''); setStoredGlobalBackgroundUrl(''); toast.success('已清空全局背景'); }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
              >
                <X className="w-4 h-4 mr-1" />
                清空
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-sm mb-4">上传图片作为整个小手机的背景</p>
          
          <div 
            onClick={() => globalFileInputRef.current?.click()}
            className="border-2 border-dashed border-primary/30 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-primary/5"
          >
            {globalBackgroundUrl ? (
              <div className="relative w-full h-32">
                <img src={globalBackgroundUrl} alt="全局背景" className="w-full h-full object-cover rounded-xl" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-sm">点击更换</span>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-primary mb-2" />
                <span className="text-primary text-sm">{globalUploading ? '上传中...' : '点击上传全局背景'}</span>
              </>
            )}
          </div>
          <input ref={globalFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleGlobalBackgroundUpload} />
        </div>

        {/* Chat Background */}
        <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">聊天背景</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm font-medium">聊天页面背景图片</p>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-primary/30 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-primary/5"
            >
              {chatBackgroundUrl ? (
                <div className="relative w-full h-32">
                  <img src={chatBackgroundUrl} alt="背景" className="w-full h-full object-cover rounded-xl" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-sm">点击更换</span>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-primary mb-2" />
                  <span className="text-primary text-sm">{uploading ? '上传中...' : '点击上传背景图'}</span>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
          </div>
        </div>
        </div>
        )}

        {/* Avatar Frame Selection */}
        {openSection === 'chat' && (
        <div className="order-[31] space-y-3">
        <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">头像框</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-3">用户头像框</p>
              <div className="flex gap-3 flex-wrap">
                {avatarFramePresets.map(frame => (
                  <button
                    key={frame.id}
                    onClick={() => setAvatarFrame(frame.url)}
                    className={`relative w-20 h-20 rounded-xl border-2 transition-all overflow-hidden ${
                      avatarFrame === frame.url 
                        ? 'border-primary ring-2 ring-primary/30' 
                        : 'border-muted hover:border-primary/50'
                    }`}
                  >
                    {frame.url ? (
                      <img src={frame.url} alt={frame.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">
                        无
                      </div>
                    )}
                    {avatarFrame === frame.url && (
                      <Check className="absolute bottom-1 right-1 w-4 h-4 text-primary bg-background rounded-full p-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-3">角色头像框</p>
              <div className="flex gap-3 flex-wrap">
                {avatarFramePresets.map(frame => (
                  <button
                    key={frame.id}
                    onClick={() => setFriendAvatarFrame(frame.url)}
                    className={`relative w-20 h-20 rounded-xl border-2 transition-all overflow-hidden ${
                      friendAvatarFrame === frame.url 
                        ? 'border-secondary ring-2 ring-secondary/30' 
                        : 'border-muted hover:border-secondary/50'
                    }`}
                  >
                    {frame.url ? (
                      <img src={frame.url} alt={frame.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">
                        无
                      </div>
                    )}
                    {friendAvatarFrame === frame.url && (
                      <Check className="absolute bottom-1 right-1 w-4 h-4 text-secondary bg-background rounded-full p-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bubble Frame Selection */}
        <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">气泡框</h3>
          </div>
          <p className="text-muted-foreground text-sm mb-4">选择可爱的气泡框装饰聊天</p>
          
          <div className="space-y-4">
<div>
              <p className="text-sm font-medium mb-3">用户气泡框</p>
              <div className="flex gap-3 flex-wrap">
                {bubbleFramePresets.map(frame => (
                  <button
                    key={frame.id}
                    onClick={() => setBubbleFrame(frame.id === 'none' ? '' : frame.id)}
                    className={`relative w-20 h-14 rounded-xl border-2 transition-all overflow-hidden ${
                      (frame.id === 'none' && !bubbleFrame) || bubbleFrame === frame.id
                        ? 'border-primary ring-2 ring-primary/30' 
                        : 'border-muted hover:border-primary/50'
                    }`}
                  >
                    {frame.id === 'none' ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">
                        无
                      </div>
                    ) : (
                      <div 
                        className="w-full h-full rounded-lg flex items-center justify-center text-xs relative"
                        style={{
                          background: frame.gradient,
                          border: `2px solid ${frame.borderColor}`,
                        }}
                      >
                        {frame.decorImage && (
                          <img src={frame.decorImage} alt="" className="absolute -top-1.5 -left-1.5 w-5 h-5 object-contain z-10" />
                        )}
                        <span style={{ color: frame.decorColor || '#fff' }}>{frame.name}</span>
                      </div>
                    )}
                    {((frame.id === 'none' && !bubbleFrame) || bubbleFrame === frame.id) && (
                      <Check className="absolute bottom-1 right-1 w-4 h-4 text-primary bg-background rounded-full p-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
<div>
              <p className="text-sm font-medium mb-3">角色气泡框</p>
              <div className="flex gap-3 flex-wrap">
                {bubbleFramePresets.map(frame => (
                  <button
                    key={frame.id}
                    onClick={() => setFriendBubbleFrame(frame.id === 'none' ? '' : frame.id)}
                    className={`relative w-20 h-14 rounded-xl border-2 transition-all overflow-hidden ${
                      (frame.id === 'none' && !friendBubbleFrame) || friendBubbleFrame === frame.id
                        ? 'border-secondary ring-2 ring-secondary/30' 
                        : 'border-muted hover:border-secondary/50'
                    }`}
                  >
                    {frame.id === 'none' ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">
                        无
                      </div>
                    ) : (
                      <div 
                        className="w-full h-full rounded-lg flex items-center justify-center text-xs relative"
                        style={{
                          background: frame.gradient,
                          border: `2px solid ${frame.borderColor}`,
                        }}
                      >
                        {frame.decorImage && (
                          <img src={frame.decorImage} alt="" className="absolute -top-1.5 -left-1.5 w-5 h-5 object-contain z-10" />
                        )}
                        <span style={{ color: frame.decorColor || '#fff' }}>{frame.name}</span>
                      </div>
                    )}
                    {((frame.id === 'none' && !friendBubbleFrame) || friendBubbleFrame === frame.id) && (
                      <Check className="absolute bottom-1 right-1 w-4 h-4 text-secondary bg-background rounded-full p-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* User bubble settings */}
        <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <h3 className="font-bold text-lg mb-4">用户气泡</h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-3">样式</p>
              <div className="flex gap-2">
                {bubbleStyles.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setBubbleStyle(style.id)}
                    className={`flex-1 py-3 px-4 rounded-full text-sm font-medium transition-all ${
                      bubbleStyle === style.id 
                        ? 'bg-primary text-primary-foreground shadow-soft' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">颜色</p>
              <div className="flex gap-2 flex-wrap">
                {macaronColors.map(c => (
                  <button 
                    key={c} 
                    onClick={() => setBubbleColor(c)} 
                    className={`w-10 h-10 rounded-full border-4 transition-transform hover:scale-110 ${
                      bubbleColor === c ? 'border-primary scale-110' : 'border-transparent'
                    }`} 
                    style={{ backgroundColor: c }} 
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">字体颜色</p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-2 border-muted overflow-hidden"
                  style={{ padding: 0 }}
                />
                <div className="flex gap-2 flex-wrap">
                  {['#333333', '#FFFFFF', '#000000', '#FFB5C5', '#FF6B6B'].map(c => (
                    <button 
                      key={c} 
                      onClick={() => setFontColor(c)} 
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        fontColor === c ? 'border-primary scale-110' : 'border-muted'
                      }`} 
                      style={{ backgroundColor: c }} 
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">透明度 {Math.round(opacity[0] * 100)}%</p>
              <Slider 
                value={opacity} 
                onValueChange={setOpacity} 
                max={1} 
                min={0.3}
                step={0.1} 
                className="w-full"
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-3">气泡大小 {bubbleSize[0]}px</p>
              <Slider 
                value={bubbleSize} 
                onValueChange={setBubbleSize} 
                max={24} 
                min={12}
                step={1} 
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Friend bubble settings */}
        <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <h3 className="font-bold text-lg mb-4">角色气泡</h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-3">样式</p>
              <div className="flex gap-2">
                {bubbleStyles.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setBubbleStyle(style.id)}
                    className={`flex-1 py-3 px-4 rounded-full text-sm font-medium transition-all ${
                      bubbleStyle === style.id 
                        ? 'bg-secondary text-secondary-foreground shadow-soft' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">颜色</p>
              <div className="flex gap-2 flex-wrap">
                {macaronColors.map(c => (
                  <button 
                    key={c} 
                    onClick={() => setFriendBubbleColor(c)} 
                    className={`w-10 h-10 rounded-full border-4 transition-transform hover:scale-110 ${
                      friendBubbleColor === c ? 'border-secondary scale-110' : 'border-transparent'
                    }`} 
                    style={{ backgroundColor: c }} 
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">字体颜色</p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={friendFontColor}
                  onChange={(e) => setFriendFontColor(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-2 border-muted overflow-hidden"
                  style={{ padding: 0 }}
                />
                <div className="flex gap-2 flex-wrap">
                  {['#333333', '#FFFFFF', '#000000', '#B5D8FF', '#4ECDC4'].map(c => (
                    <button 
                      key={c} 
                      onClick={() => setFriendFontColor(c)} 
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        friendFontColor === c ? 'border-secondary scale-110' : 'border-muted'
                      }`} 
                      style={{ backgroundColor: c }} 
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <h3 className="font-bold text-lg mb-4">预览</h3>
          <div 
            className="rounded-2xl p-4 space-y-3"
            style={{ 
              backgroundImage: chatBackgroundUrl ? `url(${chatBackgroundUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundColor: chatBackgroundUrl ? undefined : 'hsl(var(--muted))'
            }}
          >
            {/* 用户消息预览 */}
            <div className="flex justify-end items-end gap-2">
              {(() => {
                const userBubbleStyle = bubbleFramePresets.find(f => f.id === bubbleFrame);
                return (
                  <div 
                    className={`${getBubblePreviewClass(bubbleStyle, true)} relative`}
                    style={{ 
                      background: userBubbleStyle?.gradient || bubbleColor,
                      border: userBubbleStyle?.borderColor ? `2px solid ${userBubbleStyle.borderColor}` : undefined,
                      opacity: opacity[0], 
                      color: fontColor, 
                      fontSize: `${bubbleSize[0]}px` 
                    }}
                  >
                    {userBubbleStyle?.decorIcon && (
                      <span className="absolute -top-2 -right-2 text-sm drop-shadow-sm">{userBubbleStyle.decorIcon}</span>
                    )}
                    你好呀~
                  </div>
                );
              })()}
              <div className="relative w-10 h-10 flex-shrink-0">
                {avatarFrame && (
                  <img src={avatarFrame} alt="头像框" className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" />
                )}
                <div className="absolute inset-[15%] rounded-full overflow-hidden flex items-center justify-center">
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="用户头像" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-pink-200 to-rose-200 flex items-center justify-center text-xs text-gray-600">
                      {userProfile?.nickname?.charAt(0) || '我'}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 角色消息预览 */}
            <div className="flex justify-start items-end gap-2">
              <div className="relative w-10 h-10 flex-shrink-0">
                {friendAvatarFrame && (
                  <img src={friendAvatarFrame} alt="头像框" className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" />
                )}
                <div className="absolute inset-[15%] rounded-full overflow-hidden flex items-center justify-center">
                  {characterPreview?.avatar_url ? (
                    <img src={characterPreview.avatar_url} alt="角色头像" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-xs text-gray-500">
                      {characterPreview?.name?.charAt(0) || '友'}
                    </div>
                  )}
                </div>
              </div>
              {(() => {
                const friendBubbleStyle = bubbleFramePresets.find(f => f.id === friendBubbleFrame);
                return (
                  <div 
                    className={`${getBubblePreviewClass(bubbleStyle, false)} relative`}
                    style={{ 
                      background: friendBubbleStyle?.gradient || friendBubbleColor,
                      border: friendBubbleStyle?.borderColor ? `2px solid ${friendBubbleStyle.borderColor}` : undefined,
                      opacity: opacity[0], 
                      color: friendFontColor, 
                      fontSize: `${bubbleSize[0]}px` 
                    }}
                  >
                    {friendBubbleStyle?.decorIcon && (
                      <span className="absolute -top-2 -left-2 text-sm drop-shadow-sm">{friendBubbleStyle.decorIcon}</span>
                    )}
                    你好! 很高兴认识你 💕
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default CustomizePage;
