import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, Sparkles, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
];

const CustomizePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bubbleColor, setBubbleColor] = useState('#FFB5C5');
  const [friendBubbleColor, setFriendBubbleColor] = useState('#B5D8FF');
  const [bubbleStyle, setBubbleStyle] = useState('rounded');
  const [opacity, setOpacity] = useState([1]);
  const [bubbleSize, setBubbleSize] = useState([16]); // font size in px
  const [chatBackgroundUrl, setChatBackgroundUrl] = useState('');
  const [globalBackgroundUrl, setGlobalBackgroundUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [globalUploading, setGlobalUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const globalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('customization').select('*').eq('user_id', user?.id).single();
    if (data) {
      setBubbleColor(data.bubble_color || '#FFB5C5');
      setFriendBubbleColor(data.friend_bubble_color || '#B5D8FF');
      setBubbleStyle(data.bubble_style || 'rounded');
      setOpacity([Number(data.bubble_opacity) || 1]);
      setBubbleSize([(data as any).bubble_size || 16]);
      setChatBackgroundUrl(data.chat_background_url || '');
      setGlobalBackgroundUrl((data as any).global_background_url || '');
    }
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setUploading(true);
    const fileName = `${user.id}/chat-bg-${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error: uploadError } = await supabase.storage.from('backgrounds').upload(fileName, file);
    if (uploadError) {
      toast.error('上传失败');
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
    setChatBackgroundUrl(publicUrl);
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
    
    const { error: uploadError } = await supabase.storage.from('backgrounds').upload(fileName, file);
    if (uploadError) {
      toast.error('上传失败');
      setGlobalUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
    setGlobalBackgroundUrl(publicUrl);
    setGlobalUploading(false);
    toast.success('全局背景图上传成功');
  };

  const handleSave = async () => {
    const { error } = await supabase.from('customization').upsert({
      user_id: user?.id,
      bubble_color: bubbleColor,
      friend_bubble_color: friendBubbleColor,
      bubble_style: bubbleStyle,
      bubble_opacity: opacity[0],
      bubble_size: bubbleSize[0],
      chat_background_url: chatBackgroundUrl,
      global_background_url: globalBackgroundUrl,
    }, { onConflict: 'user_id' });
    
    if (error) {
      console.error('Save error:', error);
      toast.error('保存失败');
    } else {
      toast.success('美化设置已保存!');
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
    <div className="min-h-screen bg-background">
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
        {/* Global App Background */}
        <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">全局美化</h3>
          </div>
          <p className="text-muted-foreground text-sm mb-4">上传图片作为整个应用的透明背景</p>
          
          <div className="space-y-4">
            <p className="text-sm font-medium">全局背景图片</p>
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
            <div className="flex justify-end items-end gap-2">
              <div 
                className={getBubblePreviewClass(bubbleStyle, true)}
                style={{ backgroundColor: bubbleColor, opacity: opacity[0], color: '#333', fontSize: `${bubbleSize[0]}px` }}
              >
                你好呀~
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-200 to-rose-200 flex items-center justify-center text-xs text-gray-600 flex-shrink-0">
                我
              </div>
            </div>
            <div className="flex justify-start items-end gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                友
              </div>
              <div 
                className={getBubblePreviewClass(bubbleStyle, false)}
                style={{ backgroundColor: friendBubbleColor, opacity: opacity[0], color: '#333', fontSize: `${bubbleSize[0]}px` }}
              >
                你好! 很高兴认识你 💕
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomizePage;