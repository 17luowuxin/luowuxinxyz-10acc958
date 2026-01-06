import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAPIConfig } from '@/hooks/useAPIConfig';
import { 
  ArrowLeft, Settings, ChevronLeft, ChevronRight, Send, Image, 
  Volume2, VolumeX, User, Plus, ChevronDown, Music, MoreVertical,
  Eye, Edit, Trash2, Save, FolderOpen, X
} from 'lucide-react';
import { toast } from 'sonner';

interface Character {
  id: string;
  name: string;
  avatar_url: string | null;
  persona: string | null;
  sprite_url: string | null;
  voice_id: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface StorySettings {
  name: string;
  characters: Character[];
  background: string;
  opening: string;
  openingCharacter: string | null;
  willEnd: boolean;
}

// 用户立绘类型
interface UserSprite {
  url: string | null;
}

// 存档类型
interface VNSave {
  id: string;
  name: string;
  character_id: string;
  story_settings: StorySettings | null;
  messages: Message[];
  background_url: string | null;
  user_sprite_url: string | null;
  current_index: number;
  created_at: string;
  updated_at: string;
}

// 故事设置页面 - 全新独特设计
const StorySetupPage: React.FC<{ onStart: (settings: StorySettings, characterId: string, userSpriteUrl?: string) => void }> = ({ onStart }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'story' | 'sprites'>('story');
  const [userSprite, setUserSprite] = useState<UserSprite>({ url: null });
  const [uploadingUser, setUploadingUser] = useState(false);
  const [uploadingChar, setUploadingChar] = useState(false);
  
  const userSpriteRef = useRef<HTMLInputElement>(null);
  const charSpriteRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<StorySettings>({
    name: '',
    characters: [],
    background: '',
    opening: '',
    openingCharacter: null,
    willEnd: false
  });

  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      // 加载角色
      const { data } = await supabase
        .from('characters')
        .select('id, name, avatar_url, persona, sprite_url, voice_id')
        .eq('user_id', user.id);
      
      if (data) setAllCharacters(data);
      
      // 加载用户立绘
      const { data: customData } = await supabase
        .from('customization')
        .select('app_icons')
        .eq('user_id', user.id)
        .single();
      
      if (customData?.app_icons) {
        const icons = customData.app_icons as Record<string, string>;
        if (icons['user_sprite']) {
          setUserSprite({ url: icons['user_sprite'] });
        }
      }
      
      setLoading(false);
    };
    
    loadData();
  }, [user]);

  const selectCharacter = (char: Character) => {
    const exists = settings.characters.find(c => c.id === char.id);
    if (exists) {
      setSettings(prev => ({
        ...prev,
        characters: prev.characters.filter(c => c.id !== char.id),
        openingCharacter: prev.openingCharacter === char.id ? null : prev.openingCharacter
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        characters: [...prev.characters, char],
        openingCharacter: prev.openingCharacter || char.id
      }));
    }
  };

  // 上传用户立绘
  const handleUserSpriteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingUser(true);
    toast.loading('上传中...');

    try {
      const fileName = `${user.id}/user-sprite/main-${Date.now()}.png`;
      await supabase.storage.from('backgrounds').upload(fileName, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
      
      const spriteUrl = `${publicUrl}?t=${Date.now()}`;
      setUserSprite({ url: spriteUrl });
      
      // 保存到customization
      const { data: existing } = await supabase
        .from('customization')
        .select('app_icons')
        .eq('user_id', user.id)
        .single();

      const icons = (existing?.app_icons as Record<string, string>) || {};
      icons['user_sprite'] = spriteUrl;

      await supabase.from('customization').upsert({
        user_id: user.id,
        app_icons: icons
      }, { onConflict: 'user_id' });

      toast.dismiss();
      toast.success('立绘上传成功');
    } catch (error) {
      toast.dismiss();
      toast.error('上传失败');
    } finally {
      setUploadingUser(false);
      if (userSpriteRef.current) userSpriteRef.current.value = '';
    }
  };

  // 上传角色立绘
  const handleCharSpriteUpload = async (e: React.ChangeEvent<HTMLInputElement>, charId: string) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingChar(true);
    toast.loading('上传中...');

    try {
      const fileName = `${user.id}/sprites/${charId}/main-${Date.now()}.png`;
      await supabase.storage.from('backgrounds').upload(fileName, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
      
      const spriteUrl = `${publicUrl}?t=${Date.now()}`;
      
      await supabase
        .from('characters')
        .update({ sprite_url: spriteUrl })
        .eq('id', charId);

      // 更新本地状态
      setAllCharacters(prev => prev.map(c => 
        c.id === charId ? { ...c, sprite_url: spriteUrl } : c
      ));
      setSettings(prev => ({
        ...prev,
        characters: prev.characters.map(c => 
          c.id === charId ? { ...c, sprite_url: spriteUrl } : c
        )
      }));

      toast.dismiss();
      toast.success('角色立绘上传成功');
    } catch (error) {
      toast.dismiss();
      toast.error('上传失败');
    } finally {
      setUploadingChar(false);
      if (charSpriteRef.current) charSpriteRef.current.value = '';
    }
  };

  const handleStart = () => {
    if (settings.characters.length === 0) {
      toast.error('请至少选择一个角色');
      return;
    }
    const mainChar = settings.characters[0];
    onStart(settings, mainChar.id, userSprite.url || undefined);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-foreground/60"
        >
          加载中...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 flex flex-col">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between p-4 border-b border-border/50">
        <button
          onClick={() => navigate('/games')}
          className="w-10 h-10 rounded-xl bg-muted/80 flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">创建新故事</h1>
        <div className="w-10" />
      </header>

      {/* Tab切换 */}
      <div className="flex gap-2 p-4">
        <button
          onClick={() => setActiveTab('story')}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            activeTab === 'story' 
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' 
              : 'bg-muted/60 text-muted-foreground hover:bg-muted'
          }`}
        >
          故事设定
        </button>
        <button
          onClick={() => setActiveTab('sprites')}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            activeTab === 'sprites' 
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' 
              : 'bg-muted/60 text-muted-foreground hover:bg-muted'
          }`}
        >
          立绘管理
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'story' ? (
            <motion.div
              key="story"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-5"
            >
              {/* 故事标题 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">故事标题</label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="为你的故事起个名字..."
                  className="w-full px-4 py-3.5 bg-card border border-border/60 rounded-xl text-base placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* 选择角色 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground/80">参与角色</label>
                  <span className="text-xs text-muted-foreground">
                    已选 {settings.characters.length} 个
                  </span>
                </div>
                
                {allCharacters.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {allCharacters.map((char) => {
                      const isSelected = settings.characters.find(c => c.id === char.id);
                      return (
                        <motion.button
                          key={char.id}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => selectCharacter(char)}
                          className={`relative p-2 rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10 shadow-md shadow-primary/10'
                              : 'border-transparent bg-card hover:bg-muted/50'
                          }`}
                        >
                          <div className="w-full aspect-square rounded-lg overflow-hidden mb-1.5">
                            {char.avatar_url ? (
                              <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                <User className="w-6 h-6 text-foreground/30" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-center truncate">{char.name}</p>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs"
                            >
                              ✓
                            </motion.div>
                          )}
                          {char.voice_id && (
                            <div className="absolute bottom-8 right-1">
                              <Volume2 className="w-3 h-3 text-primary" />
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center">
                    <User className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">还没有角色</p>
                    <button
                      onClick={() => navigate('/friends')}
                      className="mt-3 text-sm text-primary font-medium"
                    >
                      去创建角色 →
                    </button>
                  </div>
                )}
              </div>

              {/* 世界观设定 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">世界观设定（选填）</label>
                <textarea
                  value={settings.background}
                  onChange={(e) => setSettings(prev => ({ ...prev, background: e.target.value }))}
                  placeholder="描述故事背景、人物关系、特殊规则等..."
                  rows={4}
                  className="w-full px-4 py-3 bg-card border border-border/60 rounded-xl text-sm resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* 开场白 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">开场白（选填）</label>
                <textarea
                  value={settings.opening}
                  onChange={(e) => setSettings(prev => ({ ...prev, opening: e.target.value }))}
                  placeholder="故事开始时角色说的第一句话..."
                  rows={2}
                  className="w-full px-4 py-3 bg-card border border-border/60 rounded-xl text-sm resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="sprites"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* 用户立绘 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <label className="text-sm font-medium text-foreground/80">我的立绘</label>
                </div>
                <div
                  onClick={() => userSpriteRef.current?.click()}
                  className="border-2 border-dashed border-primary/30 rounded-2xl p-4 bg-primary/5 cursor-pointer hover:border-primary/50 transition-colors min-h-[160px] flex items-center justify-center"
                >
                  {userSprite.url ? (
                    <div className="relative">
                      <img
                        src={userSprite.url}
                        alt="我的立绘"
                        className="max-h-[200px] object-contain rounded-lg"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/30 rounded-lg transition-opacity">
                        <span className="text-white text-sm">点击更换</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-primary">
                      <Image className="w-10 h-10 mx-auto mb-2 opacity-60" />
                      <p className="text-sm">{uploadingUser ? '上传中...' : '点击上传我的立绘'}</p>
                      <p className="text-xs text-muted-foreground mt-1">建议透明PNG</p>
                    </div>
                  )}
                </div>
                <input
                  ref={userSpriteRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUserSpriteUpload}
                />
              </div>

              {/* 角色立绘列表 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <label className="text-sm font-medium text-foreground/80">角色立绘</label>
                </div>
                
                {settings.characters.length > 0 ? (
                  <div className="space-y-3">
                    {settings.characters.map((char) => (
                      <div key={char.id} className="bg-card border border-border/60 rounded-xl p-3">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                            {char.avatar_url ? (
                              <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <User className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{char.name}</p>
                            {char.voice_id && (
                              <p className="text-xs text-primary flex items-center gap-1">
                                <Volume2 className="w-3 h-3" /> 已配置语音
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e) => handleCharSpriteUpload(e as any, char.id);
                            input.click();
                          }}
                          className="border border-dashed border-border rounded-xl p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-center min-h-[100px]"
                        >
                          {char.sprite_url ? (
                            <img
                              src={char.sprite_url}
                              alt={`${char.name}立绘`}
                              className="max-h-[120px] object-contain"
                            />
                          ) : (
                            <div className="text-center text-muted-foreground">
                              <Image className="w-8 h-8 mx-auto mb-1 opacity-50" />
                              <p className="text-xs">点击上传立绘</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center">
                    <p className="text-sm text-muted-foreground">请先在「故事设定」中选择角色</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部开始按钮 */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleStart}
          disabled={settings.characters.length === 0}
          className="w-full h-13 py-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/30 disabled:opacity-50 disabled:shadow-none transition-all"
        >
          开始故事 →
        </motion.button>
      </div>

      <input
        ref={charSpriteRef}
        type="file"
        accept="image/*"
        className="hidden"
      />
    </div>
  );
};

// 视觉小说聊天页面
const VisualNovelChatPage: React.FC<{ 
  characterId: string;
  storySettings?: StorySettings;
  userSpriteUrl?: string;
}> = ({ characterId, storySettings, userSpriteUrl }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { apiConfig, ttsConfig, vnConfig } = useAPIConfig();
  // 优先使用 VN 专用配置，没有则回退到通用配置
  const effectiveApiConfig = vnConfig?.apiKey
    ? { provider: 'custom', apiKey: vnConfig.apiKey, baseUrl: vnConfig.baseUrl, model: vnConfig.model }
    : apiConfig;

  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userSprite, setUserSprite] = useState<string | null>(userSpriteUrl || null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saves, setSaves] = useState<VNSave[]>([]);
  const [saveName, setSaveName] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spriteInputRef = useRef<HTMLInputElement>(null);

  // 加载角色并初始化开场白（全新聊天，不加载历史）
  useEffect(() => {
    if (!characterId || !user) return;

    const loadCharacter = async () => {
      try {
        const { data, error } = await supabase
          .from('characters')
          .select('id, name, avatar_url, persona, sprite_url, voice_id, opening_line')
          .eq('id', characterId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Load character error:', error);
          toast.error('角色加载失败');
          navigate('/visual-novel');
          return;
        }

        if (data) {
          setCharacter(data);

          // 加载自定义背景
          const { data: customData } = await supabase
            .from('customization')
            .select('app_icons')
            .eq('user_id', user.id)
            .single();

          if (customData?.app_icons) {
            const icons = customData.app_icons as Record<string, string>;
            const storedBg = icons[`vn_bg_${characterId}`];
            if (storedBg) setBackgroundUrl(storedBg);
          }

          // 使用故事设置的开场白，如果没有则使用角色的开场白
          const openingText = storySettings?.opening || (data as any).opening_line;
          if (openingText) {
            const openingMessage: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: openingText,
              created_at: new Date().toISOString()
            };
            setMessages([openingMessage]);
            setCurrentMessageIndex(0);
          }
        }
      } catch (err) {
        console.error('Load error:', err);
      } finally {
        setPageLoading(false);
      }
    };

    loadCharacter();
  }, [characterId, user, navigate, storySettings]);

  // 打字机效果
  useEffect(() => {
    const currentMessage = messages[currentMessageIndex];
    if (!currentMessage || currentMessage.role === 'user') {
      setTypedText(currentMessage?.content || '');
      setIsTyping(false);
      return;
    }

    setTypedText('');
    setIsTyping(true);
    
    const text = currentMessage.content;
    let index = 0;
    
    const timer = setInterval(() => {
      if (index < text.length) {
        setTypedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [currentMessageIndex, messages]);

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || !character || !user || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    const newUserMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    };
    
    // 先更新消息列表
    setMessages(prev => {
      const updated = [...prev, newUserMessage];
      setCurrentMessageIndex(updated.length - 1);
      return updated;
    });

    try {
      // 构建系统提示，包含故事设置
      let systemPrompt = character.persona || '';
      if (storySettings) {
        if (storySettings.background) {
          systemPrompt = `[故事背景]\n${storySettings.background}\n\n[角色设定]\n${systemPrompt}`;
        }
      }

      console.log('Sending chat request with config:', { characterId: character.id, userId: user.id, effectiveApiConfig });

      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          returnJson: true,
          messages: [...messages, newUserMessage]
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content })),
          characterName: character.name,
          persona: systemPrompt,
          characterId: character.id,
          userId: user.id,
          userApiKey: effectiveApiConfig?.apiKey,
          provider: effectiveApiConfig?.provider,
          baseUrl: effectiveApiConfig?.baseUrl,
          model: effectiveApiConfig?.model,
        },
      });

      console.log('Chat response:', { hasData: !!data, error });

      if (error) {
        console.error('Chat error:', error, data);
        toast.error((data as any)?.error || error.message || 'AI 回复失败');
        return;
      }

      const replyText = (data as any)?.response || (data as any)?.reply;

      if (replyText) {
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: replyText,
          created_at: new Date().toISOString()
        };
        
        setMessages(prev => {
          const updated = [...prev, aiMessage];
          setCurrentMessageIndex(updated.length - 1);
          return updated;
        });

        // 语音播放
        if (!isMuted && character?.voice_id && ttsConfig?.apiKey) {
          try {
            const ttsResponse = await supabase.functions.invoke('tts', {
              body: {
                text: replyText,
                voiceId: character.voice_id,
                ...ttsConfig
              }
            });
            if (ttsResponse.data?.audioUrl) {
              const audio = new Audio(ttsResponse.data.audioUrl);
              audio.play().catch(console.error);
            }
          } catch (ttsErr) {
            console.error('TTS error:', ttsErr);
          }
        }
      } else {
        console.error('No response in data:', data);
        toast.error((data as any)?.error || 'AI 未返回回复');
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('发送失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 背景上传
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !characterId) return;

    try {
      toast.loading('上传中...');
      const fileName = `${user.id}/vn-bg/${characterId}-${Date.now()}.jpg`;
      
      await supabase.storage.from('backgrounds').upload(fileName, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
      
      setBackgroundUrl(publicUrl);
      
      const { data: existing } = await supabase
        .from('customization')
        .select('app_icons')
        .eq('user_id', user.id)
        .single();

      const icons = (existing?.app_icons as Record<string, string>) || {};
      icons[`vn_bg_${characterId}`] = publicUrl;

      await supabase.from('customization').upsert({
        user_id: user.id,
        app_icons: icons
      }, { onConflict: 'user_id' });

      toast.dismiss();
      toast.success('背景已设置');
    } catch (error) {
      toast.dismiss();
      toast.error('上传失败');
    }
  };

  // 立绘上传
  const handleSpriteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !characterId) return;

    try {
      toast.loading('上传中...');
      const fileName = `${user.id}/sprites/${characterId}/main-${Date.now()}.png`;
      
      await supabase.storage.from('backgrounds').upload(fileName, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('backgrounds').getPublicUrl(fileName);
      
      setCharacter(prev => prev ? { ...prev, sprite_url: publicUrl } : null);
      
      await supabase
        .from('characters')
        .update({ sprite_url: publicUrl })
        .eq('id', characterId);

      toast.dismiss();
      toast.success('立绘已设置');
    } catch (error) {
      toast.dismiss();
      toast.error('上传失败');
    }
  };

  // 加载存档列表
  const loadSaves = async () => {
    if (!user || !characterId) return;
    
    const { data } = await supabase
      .from('vn_saves')
      .select('*')
      .eq('user_id', user.id)
      .eq('character_id', characterId)
      .order('updated_at', { ascending: false });
    
    if (data) {
      setSaves(data.map(s => ({
        ...s,
        story_settings: s.story_settings as unknown as StorySettings | null,
        messages: s.messages as unknown as Message[]
      })));
    }
  };

  // 保存存档
  const saveGame = async () => {
    if (!user || !characterId || messages.length === 0) {
      toast.error('没有可保存的内容');
      return;
    }

    try {
      const name = saveName.trim() || `存档 ${new Date().toLocaleString('zh-CN')}`;
      
      const saveData = {
        user_id: user.id,
        character_id: characterId,
        name,
        story_settings: JSON.parse(JSON.stringify(storySettings || {})),
        messages: JSON.parse(JSON.stringify(messages)),
        background_url: backgroundUrl,
        user_sprite_url: userSprite,
        current_index: currentMessageIndex
      };
      
      const { error } = await supabase.from('vn_saves').insert(saveData);

      if (error) {
        console.error('Save error:', error);
        toast.error('存档失败');
        return;
      }

      toast.success('存档成功');
      setSaveName('');
      setShowSaveModal(false);
      loadSaves();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('存档失败');
    }
  };

  // 读取存档
  const loadGame = async (save: VNSave) => {
    setMessages(save.messages);
    setCurrentMessageIndex(save.current_index);
    if (save.background_url) setBackgroundUrl(save.background_url);
    if (save.user_sprite_url) setUserSprite(save.user_sprite_url);
    setShowLoadModal(false);
    toast.success('读档成功');
  };

  // 删除存档
  const deleteSave = async (saveId: string) => {
    try {
      await supabase.from('vn_saves').delete().eq('id', saveId);
      toast.success('存档已删除');
      loadSaves();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const prevMessage = () => {
    if (currentMessageIndex > 0) {
      setCurrentMessageIndex(prev => prev - 1);
    }
  };

  const nextMessage = () => {
    if (currentMessageIndex < messages.length - 1) {
      setCurrentMessageIndex(prev => prev + 1);
    }
  };

  const skipTyping = () => {
    if (isTyping) {
      const currentMessage = messages[currentMessageIndex];
      if (currentMessage) {
        setTypedText(currentMessage.content);
        setIsTyping(false);
      }
    }
  };

  const currentMessage = messages[currentMessageIndex];

  if (pageLoading) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-black">
      {/* 背景 */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-all duration-500"
        style={{ 
          backgroundImage: backgroundUrl 
            ? `url(${backgroundUrl})` 
            : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
        }}
      />
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

      {/* 角色立绘 - 右侧 */}
      <AnimatePresence mode="wait">
        {character?.sprite_url && currentMessage?.role === 'assistant' && (
          <motion.div
            key="char-sprite"
            className="absolute bottom-32 right-4 z-10"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3 }}
          >
            <img 
              src={character.sprite_url} 
              alt={character.name} 
              className="max-h-[40vh] object-contain drop-shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 用户立绘 - 左侧 */}
      <AnimatePresence mode="wait">
        {userSprite && currentMessage?.role === 'user' && (
          <motion.div
            key="user-sprite"
            className="absolute bottom-32 left-4 z-10"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <img 
              src={userSprite} 
              alt="我" 
              className="max-h-[40vh] object-contain drop-shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 顶部导航 */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <button
          onClick={() => navigate('/visual-novel')}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <h1 className="text-white font-medium text-lg drop-shadow-lg">
          {storySettings?.name || character?.name || '加载中...'}
        </h1>
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* 设置面板 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 right-4 z-40 bg-black/80 backdrop-blur-md rounded-2xl p-4 space-y-3 min-w-[160px]"
          >
            <button
              onClick={() => { setShowSaveModal(true); setShowSettings(false); }}
              className="w-full flex items-center gap-3 text-white/80 hover:text-white text-sm"
            >
              <Save className="w-4 h-4" />
              <span>保存存档</span>
            </button>
            <button
              onClick={() => { loadSaves(); setShowLoadModal(true); setShowSettings(false); }}
              className="w-full flex items-center gap-3 text-white/80 hover:text-white text-sm"
            >
              <FolderOpen className="w-4 h-4" />
              <span>读取存档</span>
            </button>
            <div className="border-t border-white/10 my-2" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 text-white/80 hover:text-white text-sm"
            >
              <Image className="w-4 h-4" />
              <span>更换背景</span>
            </button>
            <button
              onClick={() => spriteInputRef.current?.click()}
              className="w-full flex items-center gap-3 text-white/80 hover:text-white text-sm"
            >
              <User className="w-4 h-4" />
              <span>更换立绘</span>
            </button>
            <button
              onClick={() => navigate('/visual-novel/sprites')}
              className="w-full flex items-center gap-3 text-white/80 hover:text-white text-sm"
            >
              <Edit className="w-4 h-4" />
              <span>立绘管理</span>
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-full flex items-center gap-3 text-white/80 hover:text-white text-sm"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isMuted ? '取消静音' : '静音'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 保存存档弹窗 */}
      <AnimatePresence>
        {showSaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowSaveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 w-full max-w-sm border border-white/10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-lg font-medium">保存存档</h3>
                <button onClick={() => setShowSaveModal(false)} className="text-white/60 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="存档名称（可选）"
                className="w-full h-11 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-pink-500/50 mb-4"
              />
              <div className="text-white/60 text-sm mb-4">
                当前进度：{messages.length} 条对话
              </div>
              <button
                onClick={saveGame}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium"
              >
                确认保存
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 读取存档弹窗 */}
      <AnimatePresence>
        {showLoadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowLoadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 w-full max-w-sm border border-white/10 max-h-[70vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-lg font-medium">读取存档</h3>
                <button onClick={() => setShowLoadModal(false)} className="text-white/60 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {saves.length === 0 ? (
                  <div className="text-white/50 text-center py-8">暂无存档</div>
                ) : (
                  saves.map((save) => (
                    <div
                      key={save.id}
                      className="bg-white/5 rounded-xl p-4 border border-white/10"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium truncate">{save.name}</h4>
                          <p className="text-white/50 text-sm mt-1">
                            {save.messages.length} 条对话
                          </p>
                          <p className="text-white/40 text-xs mt-1">
                            {new Date(save.updated_at).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-2">
                          <button
                            onClick={() => loadGame(save)}
                            className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center hover:bg-pink-500/30"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteSave(save.id)}
                            className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleBgUpload}
        className="hidden"
      />
      <input
        ref={spriteInputRef}
        type="file"
        accept="image/*"
        onChange={handleSpriteUpload}
        className="hidden"
      />

      {/* 底部对话框区域 */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        {/* 消息导航 */}
        {messages.length > 0 && (
          <div className="flex items-center justify-between px-4 mb-2">
            <button
              onClick={prevMessage}
              disabled={currentMessageIndex === 0}
              className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-white/60 text-xs">
              {currentMessageIndex + 1} / {messages.length}
            </span>
            <button
              onClick={nextMessage}
              disabled={currentMessageIndex === messages.length - 1}
              className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* 对话框 */}
        <div 
          className="mx-3 mb-3 bg-black/70 backdrop-blur-md rounded-2xl p-4 border border-white/10 min-h-[100px]"
          onClick={skipTyping}
        >
          {currentMessage ? (
            <div>
              <div className="text-pink-400 text-sm font-medium mb-2">
                {currentMessage.role === 'assistant' ? character?.name : '我'}
              </div>
              <p className="text-white text-base leading-relaxed">
                {currentMessage.role === 'assistant' ? typedText : currentMessage.content}
                {isTyping && <span className="animate-pulse">▌</span>}
              </p>
            </div>
          ) : (
            <p className="text-white/50 text-center">开始对话吧...</p>
          )}
        </div>

        {/* 输入框 */}
        <div className="mx-3 mb-4 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="输入消息..."
            className="flex-1 h-11 px-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="w-11 h-11 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// 主入口组件
const VisualNovelPage: React.FC = () => {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const [storySettings, setStorySettings] = useState<StorySettings | null>(null);
  const [activeCharId, setActiveCharId] = useState<string | null>(characterId || null);
  const [userSpriteUrl, setUserSpriteUrl] = useState<string | undefined>();

  const handleStartStory = (settings: StorySettings, charId: string, spriteUrl?: string) => {
    setStorySettings(settings);
    setActiveCharId(charId);
    setUserSpriteUrl(spriteUrl);
  };

  // 如果URL中有characterId，直接进入聊天
  if (characterId) {
    return <VisualNovelChatPage characterId={characterId} />;
  }

  // 如果已经设置了故事并选择了角色
  if (activeCharId && storySettings) {
    return <VisualNovelChatPage characterId={activeCharId} storySettings={storySettings} userSpriteUrl={userSpriteUrl} />;
  }

  // 否则显示故事设置页面
  return <StorySetupPage onStart={handleStartStory} />;
};

export default VisualNovelPage;
