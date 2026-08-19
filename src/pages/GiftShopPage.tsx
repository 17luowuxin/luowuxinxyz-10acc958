import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Gift, Sparkles, ShoppingCart, Trash2, Plus, 
  Heart, Star, Crown, Gem, Flower2, Music2, Cake, ImagePlus,
  Check, X, HeartOff, Clock, Watch, Headphones, Projector, Gamepad2,
  Sparkle, Camera, Cookie, Shirt, Flower, Coffee, Smartphone, Car
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import {
  deleteLocalRows,
  getLocalTable,
  insertLocalRow,
  isLocalModeEnabled,
  upsertLocalRow,
} from '@/lib/localDataStore';

const fileToDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('读取本机文件失败'));
    reader.readAsDataURL(file);
  });

interface Character {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface GiftItem {
  id: string;
  name: string;
  price: number;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  description: string;
  category: 'ancient' | 'modern' | 'daily' | 'luxury';
  customImage?: string;
}

interface CartItem {
  gift: GiftItem;
  quantity: number;
}

interface FavoriteItem {
  id: string;
  gift_id: string;
  gift_name: string;
  gift_price: number;
  gift_color: string;
  gift_category: string;
  custom_image: string | null;
  created_at: string;
}

interface HistoryItem {
  id: string;
  character_id: string;
  character_name: string;
  gift_id: string;
  gift_name: string;
  gift_price: number;
  quantity: number;
  created_at: string;
}

// 分类定义
const categories = [
  { id: 'ancient', name: '古风类', borderClass: 'from-pink-300 to-pink-400', bgPattern: 'ink-wash', textureClass: 'bg-gradient-to-br from-pink-50 to-rose-50' },
  { id: 'modern', name: '现代类', borderClass: 'from-blue-300 to-blue-400', bgPattern: 'lines', textureClass: 'bg-gradient-to-br from-blue-50 to-cyan-50' },
  { id: 'daily', name: '日常类', borderClass: 'from-yellow-300 to-amber-400', bgPattern: 'soft', textureClass: 'bg-gradient-to-br from-yellow-50 to-orange-50' },
  { id: 'luxury', name: '豪车数码', borderClass: 'from-emerald-300 to-teal-400', bgPattern: 'tech', textureClass: 'bg-gradient-to-br from-emerald-50 to-teal-50' },
];

const defaultGifts: GiftItem[] = [
  // 古风类
  { id: 'jade-pendant', name: '墨玉玉佩', price: 520, icon: <Gem className="w-7 h-7" />, color: 'from-slate-600 to-slate-800', borderColor: 'from-pink-300 to-pink-400', description: '古风吊坠', category: 'ancient' },
  { id: 'wood-hairpin', name: '檀香木簪', price: 888, icon: <Flower2 className="w-7 h-7" />, color: 'from-amber-700 to-amber-900', borderColor: 'from-pink-300 to-pink-400', description: '雕花款', category: 'ancient' },
  { id: 'safety-charm', name: '平安符', price: 1314, icon: <Heart className="w-7 h-7" />, color: 'from-red-500 to-rose-600', borderColor: 'from-pink-300 to-pink-400', description: '刺绣锦囊', category: 'ancient' },
  { id: 'celadon-cup', name: '青瓷茶盏', price: 666, icon: <Coffee className="w-7 h-7" />, color: 'from-cyan-400 to-teal-500', borderColor: 'from-pink-300 to-pink-400', description: '莲纹款', category: 'ancient' },
  { id: 'gold-jade', name: '鎏金玉佩', price: 999, icon: <Sparkles className="w-7 h-7" />, color: 'from-yellow-400 to-amber-500', borderColor: 'from-pink-300 to-pink-400', description: '星空纹', category: 'ancient' },
  { id: 'ancient-fan', name: '古风折扇', price: 777, icon: <Star className="w-7 h-7" />, color: 'from-stone-400 to-stone-600', borderColor: 'from-pink-300 to-pink-400', description: '题字款', category: 'ancient' },
  // 现代类
  { id: 'mech-watch', name: '定制机械表', price: 5201, icon: <Watch className="w-7 h-7" />, color: 'from-gray-800 to-black', borderColor: 'from-blue-300 to-blue-400', description: '黑檀木表盘', category: 'modern' },
  { id: 'headphones', name: '无线降噪耳机', price: 2333, icon: <Headphones className="w-7 h-7" />, color: 'from-gray-600 to-gray-800', borderColor: 'from-blue-300 to-blue-400', description: '哑光黑', category: 'modern' },
  { id: 'projector', name: '星空投影仪', price: 1314, icon: <Projector className="w-7 h-7" />, color: 'from-indigo-500 to-purple-600', borderColor: 'from-blue-300 to-blue-400', description: '浪漫星空', category: 'modern' },
  { id: 'gaming-set', name: '电竞键鼠套装', price: 2520, icon: <Gamepad2 className="w-7 h-7" />, color: 'from-purple-500 to-pink-500', borderColor: 'from-blue-300 to-blue-400', description: '渐变光', category: 'modern' },
  // 日常类
  { id: 'aroma-box', name: '香薰礼盒', price: 999, icon: <Sparkle className="w-7 h-7" />, color: 'from-green-300 to-teal-400', borderColor: 'from-yellow-300 to-amber-400', description: '白茶味', category: 'daily' },
  { id: 'polaroid', name: '拍立得相机', price: 1520, icon: <Camera className="w-7 h-7" />, color: 'from-orange-400 to-amber-500', borderColor: 'from-yellow-300 to-amber-400', description: '复古款', category: 'daily' },
  { id: 'cookies', name: '手工曲奇礼盒', price: 520, icon: <Cookie className="w-7 h-7" />, color: 'from-amber-400 to-yellow-500', borderColor: 'from-yellow-300 to-amber-400', description: '甜蜜美味', category: 'daily' },
  { id: 'scarf', name: '羊绒围巾', price: 888, icon: <Shirt className="w-7 h-7" />, color: 'from-gray-500 to-gray-700', borderColor: 'from-yellow-300 to-amber-400', description: '深灰色', category: 'daily' },
  { id: 'succulent', name: '多肉盆栽', price: 666, icon: <Flower className="w-7 h-7" />, color: 'from-green-400 to-emerald-500', borderColor: 'from-yellow-300 to-amber-400', description: '玉露款', category: 'daily' },
  { id: 'pajamas', name: '纯棉睡衣套装', price: 777, icon: <Shirt className="w-7 h-7" />, color: 'from-pink-300 to-rose-400', borderColor: 'from-yellow-300 to-amber-400', description: '浅色系', category: 'daily' },
  { id: 'mug', name: '定制马克杯', price: 520, icon: <Coffee className="w-7 h-7" />, color: 'from-blue-400 to-indigo-500', borderColor: 'from-yellow-300 to-amber-400', description: '星空印花', category: 'daily' },
  { id: 'carpet', name: '羊毛地毯', price: 999, icon: <Gift className="w-7 h-7" />, color: 'from-stone-400 to-stone-600', borderColor: 'from-yellow-300 to-amber-400', description: '简约几何纹', category: 'daily' },
  // 豪车数码
  { id: 'iphone16', name: '苹果16手机', price: 52000, icon: <Smartphone className="w-7 h-7" />, color: 'from-gray-700 to-gray-900', borderColor: 'from-emerald-300 to-teal-400', description: '最新旗舰', category: 'luxury' },
  { id: 'lambo-black', name: '兰博基尼（黑款）', price: 131400, icon: <Car className="w-7 h-7" />, color: 'from-gray-900 to-black', borderColor: 'from-emerald-300 to-teal-400', description: '极致速度', category: 'luxury' },
  { id: 'lambo-yellow', name: '兰博基尼（黄款）', price: 99999, icon: <Car className="w-7 h-7" />, color: 'from-yellow-400 to-amber-500', borderColor: 'from-emerald-300 to-teal-400', description: '经典黄色', category: 'luxury' },
];

const GiftShopPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [balance, setBalance] = useState(0);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>(defaultGifts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editingGiftId, setEditingGiftId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'exchange' | 'collect' | 'mine'>('exchange');
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [giftHistory, setGiftHistory] = useState<HistoryItem[]>([]);
  const [localMode, setLocalMode] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLocalMode(null);
      return;
    }
    isLocalModeEnabled(user.id).then(setLocalMode).catch(() => setLocalMode(false));
  }, [user?.id]);

  useEffect(() => {
    if (user && localMode !== null) {
      fetchBalance();
      fetchCharacters();
      fetchFavorites();
      fetchGiftHistory();
      fetchCustomImages();
    }
  }, [user, localMode]);

  // 加载自定义图片
  const fetchCustomImages = async () => {
    if (!user) return;
    const data = localMode
      ? await getLocalTable(user.id, 'gift_custom_images')
      : (await supabase.from('gift_custom_images').select('gift_id, image_url').eq('user_id', user.id)).data;
    
    if (data && data.length > 0) {
      setGifts(prevGifts => prevGifts.map(gift => {
        const customImage = data.find(img => img.gift_id === gift.id);
        return customImage ? { ...gift, customImage: customImage.image_url } : gift;
      }));
    }
  };

  const fetchBalance = async () => {
    if (!user?.id) return;
    const data = localMode
      ? (await getLocalTable(user.id, 'dream_transactions')).filter((row) => row.is_received === true)
      : (await supabase.from('dream_transactions').select('amount, is_received').eq('user_id', user.id).eq('is_received', true)).data;

    if (data) {
      const total = data.reduce((sum, t) => sum + Number(t.amount), 0);
      setBalance(total);
    }
  };

  const fetchCharacters = async () => {
    if (!user?.id) return;
    const data = localMode
      ? (await getLocalTable(user.id, 'characters')).sort((a, b) => String(a.name).localeCompare(String(b.name)))
      : (await supabase.from('characters').select('id, name, avatar_url').eq('user_id', user.id).order('name')).data;

    if (data) {
      setCharacters(data);
    }
  };

  const fetchFavorites = async () => {
    if (!user) return;
    const data = localMode
      ? (await getLocalTable(user.id, 'gift_favorites')).sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
      : (await supabase.from('gift_favorites').select('*').eq('user_id', user.id).order('created_at', { ascending: false })).data;

    if (data) {
      setFavorites(data as FavoriteItem[]);
    }
  };

  const fetchGiftHistory = async () => {
    if (!user) return;
    const data = localMode
      ? (await getLocalTable(user.id, 'gift_history')).sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
      : (await supabase.from('gift_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false })).data;

    if (data) {
      setGiftHistory(data as HistoryItem[]);
    }
  };

  // 收藏/取消收藏
  const toggleFavorite = async (gift: GiftItem) => {
    if (!user) return;
    
    const existing = favorites.find(f => f.gift_id === gift.id);
    
    if (existing) {
      // 取消收藏
      if (localMode) await deleteLocalRows(user.id, 'gift_favorites', (row) => row.id === existing.id);
      else await supabase.from('gift_favorites').delete().eq('id', existing.id);
      
      setFavorites(favorites.filter(f => f.id !== existing.id));
      toast.success('已取消收藏');
    } else {
      // 添加收藏
      const favoriteRow = {
          user_id: user.id,
          gift_id: gift.id,
          gift_name: gift.name,
          gift_price: gift.price,
          gift_color: gift.color,
          gift_category: gift.category,
          custom_image: gift.customImage || null,
      };
      const { data, error } = localMode
        ? { data: await insertLocalRow(user.id, 'gift_favorites', favoriteRow), error: null }
        : await supabase.from('gift_favorites').insert(favoriteRow).select().single();

      if (data && !error) {
        setFavorites([data as FavoriteItem, ...favorites]);
        toast.success('已添加收藏 💖');
      }
    }
  };

  const isFavorited = (giftId: string) => {
    return favorites.some(f => f.gift_id === giftId);
  };

  // 播放按钮音效
  const playClickSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAACAgICAgICAgICAgICAgICAgICAgICAgJCQoKCwsMDA0NDg4PDwAAEREiIzNERVZnd4iZqrvc');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  };

  // 添加到购物车
  const addToCart = (gift: GiftItem) => {
    playClickSound();
    const existing = cart.find(item => item.gift.id === gift.id);
    if (existing) {
      setCart(cart.map(item => 
        item.gift.id === gift.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { gift, quantity: 1 }]);
    }
    toast.success('已加入购物车', { duration: 1500 });
  };

  // 从购物车移除
  const removeFromCart = (giftId: string) => {
    setCart(cart.filter(item => item.gift.id !== giftId));
  };

  // 计算购物车总价
  const cartTotal = cart.reduce((sum, item) => sum + item.gift.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // 上传自定义图片 - 保存到存储
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingGiftId || !user) return;

    try {
      if (localMode) {
        const localUrl = await fileToDataUrl(file);
        await upsertLocalRow(
          user.id,
          'gift_custom_images',
          (row) => row.gift_id === editingGiftId,
          { user_id: user.id, gift_id: editingGiftId, image_url: localUrl },
        );
        setGifts(gifts.map((gift) => gift.id === editingGiftId ? { ...gift, customImage: localUrl } : gift));
        setEditingGiftId(null);
        toast.success('图片已保存到本机');
        return;
      }

      // 上传到存储
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/gift-${editingGiftId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      // 保存到数据库
      await supabase
        .from('gift_custom_images')
        .upsert({
          user_id: user.id,
          gift_id: editingGiftId,
          image_url: publicUrl,
        }, { onConflict: 'user_id,gift_id' });
      
      // 更新本地状态
      setGifts(gifts.map(g => 
        g.id === editingGiftId ? { ...g, customImage: publicUrl } : g
      ));
      setEditingGiftId(null);
      toast.success('图片已保存');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('上传失败，请重试');
    }
    
    e.target.value = '';
  };

  // 打开礼物详情
  const openGiftDetail = (gift: GiftItem) => {
    setSelectedGift(gift);
    setShowDetail(true);
  };

  // 直接购买
  const handleDirectPurchase = () => {
    if (!selectedGift) return;
    if (balance < selectedGift.price) {
      toast.error('梦境币不足，快去和角色聊天获取吧~');
      return;
    }
    setShowDetail(false);
    setShowCharacterPicker(true);
  };

  // 结算购物车
  const handleCheckout = () => {
    if (balance < cartTotal) {
      toast.error('梦境币不足');
      return;
    }
    setShowCart(false);
    setShowCharacterPicker(true);
  };

  // 发送礼物并触发角色回复
  const handleSendGift = async () => {
    if (!selectedCharacter || !user) return;

    const giftList = selectedGift ? [{ gift: selectedGift, quantity: 1 }] : cart;
    const totalPrice = selectedGift ? selectedGift.price : cartTotal;

    if (balance < totalPrice) {
      toast.error('梦境币不足');
      return;
    }

    setSending(true);

    try {
      // 创建交易记录
      const giftNames = giftList.map(item => `${item.gift.name}x${item.quantity}`).join('、');
      
      const transactionRow = {
          user_id: user.id,
          character_id: selectedCharacter.id,
          character_name: selectedCharacter.name,
          amount: totalPrice,
          message: `赠送了${giftNames}`,
          is_received: true,
          is_user_transfer: true,
      };
      let error = null;
      if (localMode) await insertLocalRow(user.id, 'dream_transactions', transactionRow);
      else error = (await supabase.from('dream_transactions').insert(transactionRow)).error;

      if (error) throw error;

      // 保存礼物历史记录
      for (const item of giftList) {
        const historyRow = {
          user_id: user.id,
          character_id: selectedCharacter.id,
          character_name: selectedCharacter.name,
          gift_id: item.gift.id,
          gift_name: item.gift.name,
          gift_price: item.gift.price,
          quantity: item.quantity,
        };
        if (localMode) await insertLocalRow(user.id, 'gift_history', historyRow);
        else await supabase.from('gift_history').insert(historyRow);
      }

      // 发送聊天消息给角色
      const userMessage = `我给你送了${giftNames}，希望你喜欢！💝`;
      
      const userChatRow = {
        user_id: user.id,
        character_id: selectedCharacter.id,
        role: 'user',
        content: userMessage,
      };
      if (localMode) await insertLocalRow(user.id, 'chat_messages', userChatRow);
      else await supabase.from('chat_messages').insert(userChatRow);

      // 触发角色自动回复（调用chat edge function）
      try {
        const charData = localMode
          ? (await getLocalTable(user.id, 'characters')).find((row) => row.id === selectedCharacter.id)
          : (await supabase.from('characters').select('persona, name').eq('id', selectedCharacter.id).single()).data;

          if (charData) {
            const response = await supabase.functions.invoke('chat', {
              body: {
                returnJson: true,
                messages: [{ role: 'user', content: userMessage }],
                characterName: charData.name,
                persona: charData.persona || '',
                characterId: selectedCharacter.id,
                userId: user.id,
              },
            });

            const replyText = (response.data as any)?.response || (response.data as any)?.reply;
            if (replyText) {
              const replyRow = {
                user_id: user.id,
                character_id: selectedCharacter.id,
                role: 'assistant',
                content: replyText,
              };
              if (localMode) await insertLocalRow(user.id, 'chat_messages', replyRow);
              else await supabase.from('chat_messages').insert(replyRow);
            }
          }
      } catch (chatError) {
        console.log('Auto reply skipped:', chatError);
      }

      // 显示成功动画
      setShowCharacterPicker(false);
      setShowSuccess(true);
      
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedGift(null);
        setSelectedCharacter(null);
        setCart([]);
        fetchBalance();
        fetchGiftHistory();
      }, 2500);

    } catch (error) {
      toast.error('赠送失败，请重试');
    } finally {
      setSending(false);
    }
  };

  // 获取分类的礼物
  const getGiftsByCategory = (categoryId: string) => {
    return gifts.filter(g => g.category === categoryId);
  };

  return (
    <div className="min-h-screen bg-[#FFFBF5]">
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* 顶部导航 */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')}
            className="rounded-full hover:bg-pink-100"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </Button>
          
          {/* 店名 - 马卡龙色带星光描边 */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Gift className="w-6 h-6 text-pink-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
              <Sparkles className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <h1 
              className="text-xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #FDA4AF 0%, #A5B4FC 50%, #FDE68A 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 20px rgba(251,191,36,0.3)',
              }}
            >
              梦阁
            </h1>
          </div>
        </div>
        
        {/* 右侧：梦境币 + 购物车 */}
        <div className="flex items-center gap-3">
          {/* 梦境币 */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/finance')}
            className="flex items-center gap-1.5 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full shadow-sm cursor-pointer border border-yellow-200"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-300 to-amber-400 flex items-center justify-center shadow-inner">
              <span className="text-[10px] font-bold text-amber-800">¥</span>
            </div>
            <span className="font-bold text-gray-700">{balance.toFixed(0)}</span>
          </motion.div>

          {/* 购物车 */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => { playClickSound(); setShowCart(true); }}
            className="relative p-2 bg-gradient-to-br from-pink-200 to-pink-300 rounded-full shadow-md cursor-pointer"
          >
            <ShoppingCart className="w-5 h-5 text-pink-600" />
            {cartCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-orange-400 text-white text-xs font-bold rounded-full flex items-center justify-center shadow"
              >
                {cartCount}
              </motion.span>
            )}
          </motion.div>
        </div>
      </div>

      {/* 底部切换按钮 - 果冻感 */}
      <div className="flex justify-center gap-3 px-4 py-3">
        {[
          { id: 'exchange', name: '兑换', color: 'from-pink-300 to-pink-400' },
          { id: 'collect', name: '收藏', color: 'from-blue-300 to-blue-400' },
          { id: 'mine', name: '我的', color: 'from-yellow-300 to-amber-400' },
        ].map((tab) => (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => { playClickSound(); setActiveTab(tab.id as any); }}
            className={`px-6 py-2 rounded-full font-medium text-sm shadow-lg transition-all duration-200
              ${activeTab === tab.id 
                ? `bg-gradient-to-br ${tab.color} text-white shadow-xl` 
                : 'bg-white/80 text-gray-600 hover:bg-white'
              }`}
            style={{
              boxShadow: activeTab === tab.id 
                ? '0 4px 15px -3px rgba(0,0,0,0.15), inset 0 -2px 4px rgba(0,0,0,0.1)' 
                : undefined
            }}
          >
            {tab.name}
          </motion.button>
        ))}
      </div>

      {/* 主内容区 */}
      {activeTab === 'exchange' && (
        <div className="px-4 pb-8">
          {/* 分类卡片 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {categories.map((cat) => (
              <motion.div
                key={cat.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={`relative p-4 rounded-2xl cursor-pointer overflow-hidden transition-all duration-300
                  ${selectedCategory === cat.id ? 'ring-2 ring-offset-2' : ''}`}
                style={{
                  background: `linear-gradient(135deg, ${cat.id === 'ancient' ? '#FDF2F8' : cat.id === 'modern' ? '#EFF6FF' : cat.id === 'daily' ? '#FFFBEB' : '#ECFDF5'} 0%, white 100%)`,
                  boxShadow: selectedCategory === cat.id ? '0 8px 25px -5px rgba(0,0,0,0.15)' : '0 2px 10px -3px rgba(0,0,0,0.1)',
                }}
              >
                {/* 渐变边框效果 */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${cat.borderClass} opacity-30 pointer-events-none`} />
                <div className="absolute inset-[2px] rounded-xl bg-white/90 pointer-events-none" />
                
                {/* 纹理背景 */}
                <div className={`absolute inset-0 ${cat.textureClass} opacity-20 pointer-events-none`} />
                
                <div className="relative text-center">
                  <p className="font-bold text-gray-700">{cat.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{getGiftsByCategory(cat.id).length}件商品</p>
                </div>

                {/* 点击流光效果 */}
                {selectedCategory === cat.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 0.5, 0], scale: [0.5, 1.5] }}
                    transition={{ duration: 0.5 }}
                    className={`absolute inset-0 bg-gradient-to-br ${cat.borderClass} rounded-2xl pointer-events-none`}
                  />
                )}
              </motion.div>
            ))}
          </div>

          {/* 礼物列表 */}
          <div className="grid grid-cols-2 gap-3">
            {(selectedCategory ? getGiftsByCategory(selectedCategory) : gifts).map((gift, index) => (
              <motion.div
                key={gift.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative bg-white rounded-2xl p-4 shadow-md overflow-hidden group"
              >
                {/* 渐变边框 */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gift.borderColor} opacity-40 pointer-events-none`} />
                <div className="absolute inset-[2px] rounded-xl bg-white pointer-events-none" />

                {/* 收藏按钮 */}
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  onClick={() => toggleFavorite(gift)}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 shadow-sm"
                >
                  <Heart 
                    className={`w-4 h-4 transition-colors ${isFavorited(gift.id) ? 'text-pink-500 fill-pink-500' : 'text-gray-300'}`} 
                  />
                </motion.button>

                <div className="relative flex flex-col items-center gap-2">
                  {/* 图标/图片 */}
                  <div 
                    className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${gift.color} flex items-center justify-center text-white shadow-md overflow-hidden`}
                    onClick={() => {
                      setEditingGiftId(gift.id);
                      fileInputRef.current?.click();
                    }}
                  >
                    {gift.customImage ? (
                      <img src={gift.customImage} alt={gift.name} className="w-full h-full object-cover" />
                    ) : (
                      gift.icon
                    )}
                    {/* 上传按钮悬浮 */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ImagePlus className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  <p className="font-bold text-gray-700 text-sm">{gift.name}</p>
                  <p className="text-xs text-gray-400">{gift.description}</p>
                  
                  {/* 价格 */}
                  <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-300 to-amber-400 flex items-center justify-center text-[8px] text-amber-800">¥</span>
                    <span>{gift.price}</span>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2 mt-1">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => addToCart(gift)}
                      className="px-3 py-1 bg-gradient-to-br from-blue-300 to-blue-400 text-white text-xs rounded-full shadow"
                    >
                      加购
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => openGiftDetail(gift)}
                      className="px-3 py-1 bg-gradient-to-br from-yellow-300 to-amber-400 text-white text-xs rounded-full shadow"
                    >
                      直购
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'collect' && (
        <div className="px-4 pb-8">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Heart className="w-12 h-12 mb-2 opacity-30" />
              <p>还没有收藏任何礼物~</p>
              <p className="text-xs mt-1">在礼物上点击 ❤️ 可添加收藏</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {favorites.map((fav, index) => {
                const giftIcon = defaultGifts.find(g => g.id === fav.gift_id)?.icon || <Gift className="w-7 h-7" />;
                return (
                  <motion.div
                    key={fav.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative bg-white rounded-2xl p-4 shadow-md overflow-hidden"
                  >
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${fav.gift_color.replace('from-', 'from-').replace('to-', 'to-')} opacity-20 pointer-events-none`} />
                    
                    <div className="relative flex flex-col items-center gap-2">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${fav.gift_color} flex items-center justify-center text-white shadow-md overflow-hidden`}>
                        {fav.custom_image ? (
                          <img src={fav.custom_image} alt={fav.gift_name} className="w-full h-full object-cover" />
                        ) : (
                          giftIcon
                        )}
                      </div>

                      <p className="font-bold text-gray-700 text-sm">{fav.gift_name}</p>
                      
                      <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                        <span className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-300 to-amber-400 flex items-center justify-center text-[8px] text-amber-800">¥</span>
                        <span>{fav.gift_price}</span>
                      </div>

                      <div className="flex gap-2 mt-1">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            const gift = gifts.find(g => g.id === fav.gift_id);
                            if (gift) openGiftDetail(gift);
                          }}
                          className="px-3 py-1 bg-gradient-to-br from-yellow-300 to-amber-400 text-white text-xs rounded-full shadow"
                        >
                          购买
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={async () => {
                            if (localMode && user?.id) await deleteLocalRows(user.id, 'gift_favorites', (row) => row.id === fav.id);
                            else await supabase.from('gift_favorites').delete().eq('id', fav.id);
                            setFavorites(favorites.filter(f => f.id !== fav.id));
                            toast.success('已取消收藏');
                          }}
                          className="px-3 py-1 bg-gradient-to-br from-gray-300 to-gray-400 text-white text-xs rounded-full shadow"
                        >
                          <HeartOff className="w-3 h-3" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'mine' && (
        <div className="px-4 pb-8">
          {giftHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Gift className="w-12 h-12 mb-2 opacity-30" />
              <p>还没有赠送过礼物~</p>
              <p className="text-xs mt-1">快去挑选心仪的礼物送给TA吧</p>
            </div>
          ) : (
            <div className="space-y-3">
              {giftHistory.map((history, index) => {
                const giftIcon = defaultGifts.find(g => g.id === history.gift_id)?.icon || <Gift className="w-5 h-5" />;
                const giftColor = defaultGifts.find(g => g.id === history.gift_id)?.color || 'from-pink-400 to-rose-500';
                return (
                  <motion.div
                    key={history.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-gray-50"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${giftColor} flex items-center justify-center text-white shadow`}>
                      {giftIcon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-700 truncate">{history.gift_name}</p>
                        <span className="text-xs text-gray-400">x{history.quantity}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <span>送给</span>
                        <span className="text-pink-500 font-medium">{history.character_name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-500 text-sm">-¥{history.gift_price * history.quantity}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-300">
                        <Clock className="w-3 h-3" />
                        <span>{format(new Date(history.created_at), 'MM/dd HH:mm')}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 购物车弹窗 */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-[90%] rounded-3xl bg-[#FFFBF5]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-center">
              <ShoppingCart className="w-5 h-5 text-pink-400" />
              购物车
            </DialogTitle>
          </DialogHeader>
          
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-12 h-12 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400">购物车是空的~</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {cart.map((item) => (
                <div key={item.gift.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gift.color} flex items-center justify-center text-white text-sm shadow`}>
                    {item.gift.customImage ? (
                      <img src={item.gift.customImage} alt="" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      item.gift.icon
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-700">{item.gift.name}</p>
                    <p className="text-xs text-gray-400">x{item.quantity}</p>
                  </div>
                  <p className="font-bold text-amber-500">¥{item.gift.price * item.quantity}</p>
                  <button
                    onClick={() => removeFromCart(item.gift.id)}
                    className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <div className="border-t border-gray-100 pt-4 mt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-500">总计</span>
                <span className="text-xl font-bold text-pink-500">¥{cartTotal}</span>
              </div>
              <Button
                onClick={handleCheckout}
                className="w-full bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 text-white rounded-full"
              >
                结算
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 礼物详情弹窗 */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-[85%] rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50">
          {selectedGift && (
            <div className="text-center py-4">
              <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${selectedGift.color} flex items-center justify-center text-white shadow-lg mb-4`}>
                {selectedGift.customImage ? (
                  <img src={selectedGift.customImage} alt="" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  React.cloneElement(selectedGift.icon as React.ReactElement, { className: 'w-10 h-10' })
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">{selectedGift.name}</h3>
              <p className="text-gray-500 mb-4">{selectedGift.description}</p>
              <p className="text-2xl font-bold text-amber-500 mb-6">¥{selectedGift.price}</p>
              
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => { addToCart(selectedGift); setShowDetail(false); }}
                  className="bg-gradient-to-br from-blue-300 to-blue-400 hover:from-blue-400 hover:to-blue-500 text-white rounded-full px-6"
                >
                  加入购物车
                </Button>
                <Button
                  onClick={handleDirectPurchase}
                  className="bg-gradient-to-br from-yellow-300 to-amber-400 hover:from-yellow-400 hover:to-amber-500 text-white rounded-full px-6"
                >
                  立即购买
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 角色选择弹窗 */}
      <Dialog open={showCharacterPicker} onOpenChange={setShowCharacterPicker}>
        <DialogContent className="max-w-[90%] rounded-3xl bg-[#FFFBF5]">
          <DialogHeader>
            <DialogTitle className="text-center">选择要赠送的角色</DialogTitle>
          </DialogHeader>
          
          {characters.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="w-12 h-12 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400">还没有创建角色哦~</p>
              <Button
                onClick={() => navigate('/friends')}
                className="mt-4 bg-gradient-to-r from-pink-400 to-purple-400"
              >
                去创建角色
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-[250px] overflow-y-auto py-2">
              {characters.map((char) => (
                <motion.div
                  key={char.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCharacter(char)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl cursor-pointer transition-all
                    ${selectedCharacter?.id === char.id 
                      ? 'bg-gradient-to-br from-pink-100 to-purple-100 ring-2 ring-pink-400' 
                      : 'bg-white hover:bg-gray-50'}`}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-pink-300 to-purple-300 shadow">
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold">
                        {char.name[0]}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-600 truncate w-full text-center">{char.name}</p>
                </motion.div>
              ))}
            </div>
          )}

          {selectedCharacter && (
            <div className="mt-4">
              <Button
                onClick={handleSendGift}
                disabled={sending}
                className="w-full bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 hover:from-pink-500 hover:via-purple-500 hover:to-blue-500 text-white rounded-full shadow-lg"
              >
                {sending ? '赠送中...' : `确认赠送给 ${selectedCharacter.name}`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 成功动画 */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="relative"
            >
              {/* 星光炸开效果 */}
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ 
                    scale: [0, 2],
                    opacity: [1, 0],
                    x: Math.cos(i * 30 * Math.PI / 180) * 100,
                    y: Math.sin(i * 30 * Math.PI / 180) * 100,
                  }}
                  transition={{ duration: 0.8, delay: i * 0.05 }}
                  className={`absolute w-4 h-4 rounded-full ${
                    i % 3 === 0 ? 'bg-pink-400' : i % 3 === 1 ? 'bg-blue-400' : 'bg-yellow-400'
                  }`}
                  style={{ left: '50%', top: '50%', marginLeft: -8, marginTop: -8 }}
                />
              ))}
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-white rounded-3xl p-8 shadow-2xl text-center"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                >
                  <Gift className="w-16 h-16 text-pink-400 mx-auto mb-4" />
                </motion.div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">兑换成功</h3>
                <p className="text-gray-500">礼物已送达~</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GiftShopPage;
