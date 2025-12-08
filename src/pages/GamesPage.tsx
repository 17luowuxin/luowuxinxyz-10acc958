import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Skull, BookOpen, HelpCircle, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const games = [
  { id: 'werewolf', name: '狼人杀', desc: '和AI好友一起玩狼人杀', icon: Skull, color: 'from-red-500 to-purple-600', route: '/werewolf' },
  { id: 'script', name: '剧本杀', desc: '沉浸式角色扮演', icon: BookOpen, color: 'from-purple-500 to-pink-500', route: null },
  { id: 'riddle', name: '猜谜语', desc: '考验智慧的时刻', icon: HelpCircle, color: 'from-blue-500 to-cyan-500', route: null },
  { id: 'truth', name: '真心话大冒险', desc: '刺激又有趣', icon: Heart, color: 'from-pink-500 to-red-500', route: null },
];

const GamesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold ml-2">游戏</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {games.map((g, index) => (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => g.route && navigate(g.route)}
            className={`relative overflow-hidden rounded-2xl p-4 shadow-card text-center cursor-pointer transition-transform hover:scale-105 ${g.route ? '' : 'opacity-60'}`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${g.color} opacity-90`} />
            <div className="relative z-10 text-white">
              <g.icon className="w-12 h-12 mx-auto mb-3" />
              <h3 className="font-bold text-lg">{g.name}</h3>
              <p className="text-xs text-white/80 mt-1">{g.desc}</p>
              {!g.route && (
                <span className="inline-block mt-2 text-xs bg-white/20 px-2 py-1 rounded-full">
                  即将推出
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default GamesPage;
