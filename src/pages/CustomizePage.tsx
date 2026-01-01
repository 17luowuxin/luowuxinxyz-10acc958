import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, Sparkles, Globe, Film, Palette, Check, X, Type, User, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { applyGlobalTextColor, applyGlobalTextSize } from '@/hooks/useGlobalSettings';
import { toast } from 'sonner';
import ThemeGallery from '@/components/customize/ThemeGallery';

// 预设头像框
import dreamFrame from '@/assets/avatar-frames/dream-frame.png';
// 头像装饰图片
import animeHeadDecor from '@/assets/bubble-frames/anime-head-decor.png';
import cuteBoyFrame from '@/assets/bubble-frames/cute-boy-frame.jpeg';

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
  // 可爱男孩气泡框 - 左侧装饰角色
  { id: 'cute-boy', name: '可爱男孩', type: 'image', gradient: '', borderColor: '#666666', decorColor: '', decorIcon: '', decorImage: cuteBoyFrame },
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

// Font options
const fontOptions = [
  { id: 'default', name: '默认', family: 'Nunito, sans-serif', preview: 'Aa 你好' },
  { id: 'kuaile', name: '快乐体', family: '"ZCOOL KuaiLe", cursive', preview: 'Aa 你好' },
  { id: 'mashan', name: '马善政楷', family: '"Ma Shan Zheng", cursive', preview: 'Aa 你好' },
  { id: 'xiaowei', name: '小薇体', family: '"ZCOOL XiaoWei", serif', preview: 'Aa 你好' },
  { id: 'liujian', name: '刘建毛草', family: '"Liu Jian Mao Cao", cursive', preview: 'Aa 你好' },
  { id: 'longcang', name: '龙藏体', family: '"Long Cang", cursive', preview: 'Aa 你好' },
];

// 字体颜色选项
const fontColors = [
  '#333333', // 深灰
  '#FFFFFF', // 白色
  '#FFB5C5', // 粉色
  '#B5D8FF', // 蓝色
  '#000000', // 黑色
  '#FF6B6B', // 红色
  '#4ECDC4', // 青色
  '#FFE66D', // 黄色
];

// 全局文字大小选项
const textSizeOptions = [
  { id: 12, label: '小' },
  { id: 14, label: '较小' },
  { id: 16, label: '标准' },
  { id: 18, label: '较大' },
  { id: 20, label: '大' },
  { id: 24, label: '超大' },
];

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
  const [videoBackgroundUrl, setVideoBackgroundUrl] = useState('');
  const [currentTheme, setCurrentTheme] = useState('pink');
  const [currentFont, setCurrentFont] = useState('default');
  const [fontColor, setFontColor] = useState('#333333');
  const [friendFontColor, setFriendFontColor] = useState('#333333');
  const [uploading, setUploading] = useState(false);
  const [globalUploading, setGlobalUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const globalFileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [avatarFrame, setAvatarFrame] = useState('');
  const [friendAvatarFrame, setFriendAvatarFrame] = useState('');
  const [bubbleFrame, setBubbleFrame] = useState('');
  const [friendBubbleFrame, setFriendBubbleFrame] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [characterPreview, setCharacterPreview] = useState<any>(null);
  const [globalTextColor, setGlobalTextColor] = useState('#333333');
  const [globalTextSize, setGlobalTextSize] = useState(16);

  useEffect(() => {
    if (user) {
      fetchSettings();
      fetchUserProfile();
      fetchFirstCharacter();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('user_id', user?.id)
      .single();
    if (data) setUserProfile(data);
  };

  const fetchFirstCharacter = async () => {
    const { data } = await supabase
      .from('characters')
      .select('name, avatar_url')
      .eq('user_id', user?.id)
      .limit(1)
      .single();
    if (data) setCharacterPreview(data);
  };

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.remove('theme-pink', 'theme-blue', 'theme-orange', 'theme-green', 'theme-purple', 'theme-dark');
    document.documentElement.classList.add(`theme-${currentTheme}`);
  }, [currentTheme]);

  // Apply font to document
  useEffect(() => {
    const font = fontOptions.find(f => f.id === currentFont);
    if (font) {
      document.documentElement.style.fontFamily = font.family;
      document.body.style.fontFamily = font.family;
      // Also apply to all elements, except font preview areas
      const style = document.createElement('style');
      style.id = 'global-font-style';
      style.textContent = `*:not([data-font-preview]) { font-family: ${font.family} !important; }`;
      
      // Remove old style if exists
      const oldStyle = document.getElementById('global-font-style');
      if (oldStyle) oldStyle.remove();
      
      document.head.appendChild(style);
    }
  }, [currentFont]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('customization').select('*').eq('user_id', user?.id).maybeSingle();
    if (data) {
      setBubbleColor(data.bubble_color || '#FFB5C5');
      setFriendBubbleColor(data.friend_bubble_color || '#B5D8FF');
      setBubbleStyle(data.bubble_style || 'rounded');
      setOpacity([Number(data.bubble_opacity) || 1]);
      setBubbleSize([(data as any).bubble_size || 16]);
      setChatBackgroundUrl(data.chat_background_url || '');
      setGlobalBackgroundUrl((data as any).global_background_url || '');
      setVideoBackgroundUrl((data as any).video_background_url || '');
      if (data.theme) setCurrentTheme(data.theme);
      if ((data as any).font_family) setCurrentFont((data as any).font_family);
      if ((data as any).font_color) setFontColor((data as any).font_color);
      if ((data as any).friend_font_color) setFriendFontColor((data as any).friend_font_color);
      if ((data as any).avatar_frame_url) setAvatarFrame((data as any).avatar_frame_url);
      if ((data as any).friend_avatar_frame_url) setFriendAvatarFrame((data as any).friend_avatar_frame_url);
      if ((data as any).bubble_frame_url) setBubbleFrame((data as any).bubble_frame_url);
      if ((data as any).friend_bubble_frame_url) setFriendBubbleFrame((data as any).friend_bubble_frame_url);
      if ((data as any).global_text_color) setGlobalTextColor((data as any).global_text_color);
      if ((data as any).global_text_size) setGlobalTextSize((data as any).global_text_size);
    }
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    // 压缩大图片
    if (file.size > 2 * 1024 * 1024) {
      toast.loading('正在压缩图片...');
    }

    setUploading(true);
    const fileName = `${user.id}/chat-bg-${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error: uploadError } = await supabase.storage.from('backgrounds').upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });
    
    if (uploadError) {
      toast.error('上传失败');
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
    setChatBackgroundUrl(publicUrl + '?t=' + Date.now());
    setUploading(false);
    toast.success('背景图上传成功');
  };

  const handleGlobalBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setGlobalUploading(true);
    const fileName = `${user.id}/global-bg-${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error: uploadError } = await supabase.storage.from('backgrounds').upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });
    
    if (uploadError) {
      toast.error('上传失败');
      setGlobalUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
    setGlobalBackgroundUrl(publicUrl + '?t=' + Date.now());
    setGlobalUploading(false);
    toast.success('全局背景图上传成功');
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('video/')) {
      toast.error('请选择视频文件 (MP4/WebM)');
      return;
    }

    // 限制8MB以提升上传速度
    if (file.size > 8 * 1024 * 1024) {
      toast.error('视频文件需小于8MB以保证流畅播放');
      return;
    }

    setVideoUploading(true);
    toast.loading('正在上传视频...');
    
    const fileName = `${user.id}/video-bg-${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error: uploadError } = await supabase.storage.from('backgrounds').upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });
    
    if (uploadError) {
      toast.dismiss();
      toast.error('上传失败: ' + uploadError.message);
      setVideoUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
    setVideoBackgroundUrl(publicUrl + '?t=' + Date.now());
    setVideoUploading(false);
    toast.dismiss();
    toast.success('动态背景上传成功');
  };

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId);
    toast.success(`已切换到${themeOptions.find(t => t.id === themeId)?.name}主题`);
  };

  const handleSave = async () => {
    // Clear session cache to force reload
    if (user) {
      sessionStorage.removeItem(`bg_${user.id}`);
    }
    
    const { error } = await supabase.from('customization').upsert({
      user_id: user?.id,
      bubble_color: bubbleColor,
      friend_bubble_color: friendBubbleColor,
      bubble_style: bubbleStyle,
      bubble_opacity: opacity[0],
      bubble_size: bubbleSize[0],
      chat_background_url: chatBackgroundUrl,
      global_background_url: globalBackgroundUrl,
      video_background_url: videoBackgroundUrl,
      theme: currentTheme,
      font_family: currentFont,
      font_color: fontColor,
      friend_font_color: friendFontColor,
      avatar_frame_url: avatarFrame,
      friend_avatar_frame_url: friendAvatarFrame,
      bubble_frame_url: bubbleFrame,
      friend_bubble_frame_url: friendBubbleFrame,
      global_text_color: globalTextColor,
      global_text_size: globalTextSize,
    } as any, { onConflict: 'user_id' });
    
    if (error) {
      console.error('Save error:', error);
      toast.error('保存失败');
    } else {
      // 立即同步到全局样式（桌面APP标签、锁屏文字等）
      applyGlobalTextColor(globalTextColor);
      applyGlobalTextSize(globalTextSize);
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold ml-2 text-primary">美化</h1>
        </div>
        <Button variant="candy" onClick={handleSave} className="rounded-full px-6">
          保存
        </Button>
      </div>

      <div className="p-4 space-y-6 pb-24">
        {/* Theme Gallery */}
        <ThemeGallery onThemeApplied={fetchSettings} />

        {/* Video Background */}
        <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">动态视频背景</h3>
            </div>
            {videoBackgroundUrl && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setVideoBackgroundUrl(''); toast.success('已清空动态背景'); }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
              >
                <X className="w-4 h-4 mr-1" />
                清空
              </Button>
            )}
          </div>
          
          <div 
            onClick={() => videoInputRef.current?.click()}
            className="border-2 border-dashed border-primary/30 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-primary/5"
          >
            {videoBackgroundUrl ? (
              <div className="relative w-full h-32">
                <video 
                  src={videoBackgroundUrl} 
                  className="w-full h-full object-cover rounded-xl"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-sm">点击更换</span>
                </div>
              </div>
            ) : (
              <>
                <Film className="w-8 h-8 text-primary mb-2" />
                <span className="text-primary font-medium">{videoUploading ? '上传中...' : '点击上传动态背景'}</span>
                <span className="text-muted-foreground text-xs mt-1">支持 MP4/WebM，10MB以内</span>
              </>
            )}
          </div>
          <input 
            ref={videoInputRef} 
            type="file" 
            accept="video/mp4,video/webm" 
            className="hidden" 
            onChange={handleVideoUpload} 
          />
        </div>

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
            {fontOptions.map((font) => (
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
        </div>

        {/* Global Text Color & Size */}
        <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">桌面文字设置</h3>
          </div>
          <p className="text-muted-foreground text-sm mb-4">设置全局文字颜色和大小，应用到整个应用</p>
          
          <div className="space-y-4">
            {/* Text Color - Color Picker */}
            <div>
              <p className="text-sm font-medium mb-3">文字颜色</p>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={globalTextColor}
                  onChange={(e) => setGlobalTextColor(e.target.value)}
                  className="w-16 h-16 rounded-xl cursor-pointer border-2 border-muted overflow-hidden"
                  style={{ padding: 0 }}
                />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-2">当前颜色: {globalTextColor}</p>
                  <div className="flex gap-2 flex-wrap">
                    {['#333333', '#FFFFFF', '#000000', '#FF6B6B', '#4ECDC4', '#FFB5C5'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setGlobalTextColor(color)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                          globalTextColor === color ? 'border-primary scale-110' : 'border-muted'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Text Size */}
            <div>
              <p className="text-sm font-medium mb-3">文字大小</p>
              <div className="flex gap-2 flex-wrap">
                {textSizeOptions.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => setGlobalTextSize(size.id)}
                    className={`px-4 py-2 rounded-xl border-2 transition-all ${
                      globalTextSize === size.id 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-muted bg-muted/50 hover:border-primary/50'
                    }`}
                  >
                    <span style={{ fontSize: `${size.id}px` }}>{size.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="mt-4 p-4 rounded-2xl bg-muted/30 border border-primary/10">
              <p className="text-sm text-muted-foreground mb-2">预览效果：</p>
              <p style={{ color: globalTextColor, fontSize: `${globalTextSize}px` }}>
                这是预览文字 Hello World 你好世界
              </p>
            </div>
          </div>
        </div>

        {/* Global App Background */}
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
                onClick={() => { setGlobalBackgroundUrl(''); toast.success('已清空全局背景'); }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
              >
                <X className="w-4 h-4 mr-1" />
                清空
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-sm mb-4">上传图片作为背景（与动态视频二选一）</p>
          
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

        {/* Avatar Frame Selection */}
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
    </div>
  );
};

export default CustomizePage;
