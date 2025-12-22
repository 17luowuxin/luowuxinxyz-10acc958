import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Gift, Sparkles, Heart, Star, Crown, Gem, Flower2, Music2, Cake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  description: string;
}

const gifts: GiftItem[] = [
  { id: 'rose', name: '玫瑰花', price: 1, icon: <Flower2 className="w-8 h-8" />, color: 'from-pink-400 to-rose-500', description: '一朵娇艳的玫瑰' },
  { id: 'heart', name: '爱心', price: 5, icon: <Heart className="w-8 h-8" />, color: 'from-red-400 to-pink-500', description: '满满的爱意' },
  { id: 'star', name: '星星', price: 10, icon: <Star className="w-8 h-8" />, color: 'from-yellow-400 to-orange-500', description: '闪闪发光的星星' },
  { id: 'cake', name: '蛋糕', price: 20, icon: <Cake className="w-8 h-8" />, color: 'from-amber-400 to-orange-500', description: '甜蜜的蛋糕' },
  { id: 'music', name: '音乐盒', price: 50, icon: <Music2 className="w-8 h-8" />, color: 'from-blue-400 to-indigo-500', description: '美妙的旋律' },
  { id: 'gem', name: '宝石', price: 100, icon: <Gem className="w-8 h-8" />, color: 'from-purple-400 to-violet-500', description: '璀璨的宝石' },
  { id: 'crown', name: '皇冠', price: 200, icon: <Crown className="w-8 h-8" />, color: 'from-yellow-500 to-amber-600', description: '尊贵的皇冠' },
  { id: 'sparkle', name: '梦之光', price: 520, icon: <Sparkles className="w-8 h-8" />, color: 'from-pink-500 to-purple-600', description: '最珍贵的礼物' },
];

const GiftShopPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBalance();
      fetchCharacters();
    }
  }, [user]);

  const fetchBalance = async () => {
    const { data } = await supabase
      .from('dream_transactions')
      .select('amount, is_received')
      .eq('user_id', user?.id)
      .eq('is_received', true);

    if (data) {
      const total = data.reduce((sum, t) => sum + Number(t.amount), 0);
      setBalance(total);
    }
  };

  const fetchCharacters = async () => {
    const { data } = await supabase
      .from('characters')
      .select('id, name, avatar_url')
      .eq('user_id', user?.id)
      .order('name');

    if (data) {
      setCharacters(data);
    }
  };

  const handleGiftClick = (gift: GiftItem) => {
    if (balance < gift.price) {
      toast.error('梦境币不足，快去和角色聊天获取吧~');
      return;
    }
    setSelectedGift(gift);
    setShowCharacterPicker(true);
  };

  const handleSendGift = async () => {
    if (!selectedGift || !selectedCharacter || !user) return;

    setSending(true);

    // Deduct balance by creating a negative transaction
    const { error } = await supabase
      .from('dream_transactions')
      .insert({
        user_id: user.id,
        character_id: selectedCharacter.id,
        character_name: selectedCharacter.name,
        amount: -selectedGift.price,
        message: `赠送了${selectedGift.name}`,
        is_received: true,
      });

    if (error) {
      toast.error('赠送失败');
      setSending(false);
      return;
    }

    toast.success(
      <div className="flex items-center gap-2">
        <span>成功向 {selectedCharacter.name} 赠送了 {selectedGift.name}！</span>
        {selectedGift.icon}
      </div>
    );

    setShowCharacterPicker(false);
    setSelectedGift(null);
    setSelectedCharacter(null);
    setSending(false);
    fetchBalance();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-orange-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')}
            className="rounded-full"
          >
            <ChevronLeft className="w-6 h-6 text-purple-600" />
          </Button>
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-500" />
            <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              梦阁
            </h1>
          </div>
        </div>
        
        {/* Balance */}
        <motion.div
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/finance')}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white px-4 py-2 rounded-full shadow-lg cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span className="font-bold">¥{balance.toFixed(0)}</span>
        </motion.div>
      </div>

      {/* Description */}
      <div className="px-4 py-2">
        <p className="text-sm text-gray-500 text-center">
          用角色赠送的梦境币，为TA购买心意礼物吧~
        </p>
      </div>

      {/* Gifts Grid */}
      <div className="p-4 grid grid-cols-2 gap-4">
        {gifts.map((gift, index) => (
          <motion.div
            key={gift.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleGiftClick(gift)}
            className={`relative bg-white rounded-3xl p-4 shadow-lg cursor-pointer overflow-hidden
              ${balance >= gift.price ? 'hover:shadow-xl' : 'opacity-60'}`}
          >
            {/* Background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${gift.color} opacity-10`} />
            
            <div className="relative flex flex-col items-center gap-2">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gift.color} flex items-center justify-center text-white shadow-md`}>
                {gift.icon}
              </div>
              <p className="font-bold text-gray-800">{gift.name}</p>
              <p className="text-xs text-gray-400">{gift.description}</p>
              <div className="flex items-center gap-1 text-orange-500 font-bold">
                <Sparkles className="w-3 h-3" />
                <span>¥{gift.price}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Character Picker Dialog */}
      <Dialog open={showCharacterPicker} onOpenChange={setShowCharacterPicker}>
        <DialogContent className="max-w-[90%] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center">
              选择要赠送的角色
            </DialogTitle>
          </DialogHeader>
          
          {characters.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">还没有创建角色哦~</p>
              <Button
                onClick={() => navigate('/friends')}
                className="mt-4 bg-purple-500 hover:bg-purple-600"
              >
                去创建角色
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto py-2">
              {characters.map((char) => (
                <motion.div
                  key={char.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCharacter(char)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl cursor-pointer transition-colors
                    ${selectedCharacter?.id === char.id 
                      ? 'bg-purple-100 ring-2 ring-purple-500' 
                      : 'bg-gray-50 hover:bg-gray-100'}`}
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 overflow-hidden">
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-lg">
                        {char.name[0]}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-700 truncate w-full text-center">
                    {char.name}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          {selectedCharacter && selectedGift && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <span>向 <strong>{selectedCharacter.name}</strong> 赠送</span>
                <span className={`bg-gradient-to-r ${selectedGift.color} bg-clip-text text-transparent font-bold`}>
                  {selectedGift.name}
                </span>
              </div>
              <Button
                onClick={handleSendGift}
                disabled={sending}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full"
              >
                {sending ? '赠送中...' : `确认赠送 (¥${selectedGift.price})`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiftShopPage;
