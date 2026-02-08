import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageCircle, Users, Heart, Calendar, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Stats {
  totalMessages: number;
  totalCharacters: number;
  totalDiaries: number;
  totalPhotos: number;
  totalMoments: number;
  recentDays: number;
  favoriteCharacter?: { name: string; count: number };
}

const StatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalMessages: 0,
    totalCharacters: 0,
    totalDiaries: 0,
    totalPhotos: 0,
    totalMoments: 0,
    recentDays: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    setLoading(true);
    
    // 获取消息总数
    const { count: msgCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id);

    // 获取角色数
    const { count: charCount } = await supabase
      .from('characters')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id);

    // 获取日记数
    const { count: diaryCount } = await (supabase
      .from('diaries' as any)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id) as any);

    // 获取照片数
    const { count: photoCount } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id);

    // 获取动态数
    const { count: momentCount } = await supabase
      .from('moments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id);

    // 获取最常聊天的角色
    const { data: msgData } = await supabase
      .from('chat_messages')
      .select('character_id, characters(name)')
      .eq('user_id', user?.id);

    let favoriteCharacter;
    if (msgData && msgData.length > 0) {
      const charCounts: Record<string, { name: string; count: number }> = {};
      msgData.forEach((msg: any) => {
        if (msg.character_id && msg.characters?.name) {
          if (!charCounts[msg.character_id]) {
            charCounts[msg.character_id] = { name: msg.characters.name, count: 0 };
          }
          charCounts[msg.character_id].count++;
        }
      });
      const sorted = Object.values(charCounts).sort((a, b) => b.count - a.count);
      if (sorted.length > 0) {
        favoriteCharacter = sorted[0];
      }
    }

    // 计算活跃天数
    const { data: recentMsgs } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(100);

    let recentDays = 0;
    if (recentMsgs && recentMsgs.length > 0) {
      const dates = new Set(recentMsgs.map((m: any) => 
        new Date(m.created_at).toDateString()
      ));
      recentDays = dates.size;
    }

    setStats({
      totalMessages: msgCount || 0,
      totalCharacters: charCount || 0,
      totalDiaries: diaryCount || 0,
      totalPhotos: photoCount || 0,
      totalMoments: momentCount || 0,
      recentDays,
      favoriteCharacter
    });
    setLoading(false);
  };

  const statCards = [
    { label: '聊天消息', value: stats.totalMessages, icon: MessageCircle, color: 'from-pink-400 to-rose-400' },
    { label: 'AI角色', value: stats.totalCharacters, icon: Users, color: 'from-purple-400 to-violet-400' },
    { label: '日记条数', value: stats.totalDiaries, icon: Calendar, color: 'from-blue-400 to-cyan-400' },
    { label: '相册照片', value: stats.totalPhotos, icon: Heart, color: 'from-orange-400 to-amber-400' },
    { label: '空间动态', value: stats.totalMoments, icon: TrendingUp, color: 'from-green-400 to-emerald-400' },
    { label: '活跃天数', value: stats.recentDays, icon: Clock, color: 'from-indigo-400 to-blue-400' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/80 to-pink-50/80 backdrop-blur-sm p-4">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold ml-2">数据统计</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`bg-gradient-to-br ${card.color} rounded-2xl p-4 text-white shadow-lg`}
                >
                  <Icon className="w-6 h-6 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-sm opacity-80">{card.label}</p>
                </motion.div>
              );
            })}
          </div>

          {/* 最喜欢的角色 */}
          {stats.favoriteCharacter && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-card rounded-2xl p-4 shadow-sm"
            >
              <h3 className="font-medium text-muted-foreground mb-2">最常聊天的角色</h3>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{stats.favoriteCharacter.name}</span>
                <span className="text-sm text-muted-foreground">
                  {stats.favoriteCharacter.count} 条消息
                </span>
              </div>
            </motion.div>
          )}

          {/* 使用提示 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-gradient-to-r from-candy-pink/20 to-candy-purple/20 rounded-2xl p-4"
          >
            <p className="text-sm text-center text-muted-foreground">
              继续和AI好友聊天，创造更多美好回忆吧~ 💕
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default StatsPage;