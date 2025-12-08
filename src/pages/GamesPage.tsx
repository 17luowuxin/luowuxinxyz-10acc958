import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const games = [
  { id: 'werewolf', name: '狼人杀', desc: '和AI好友一起玩狼人杀' },
  { id: 'script', name: '剧本杀', desc: '沉浸式角色扮演' },
  { id: 'riddle', name: '猜谜语', desc: '考验智慧的时刻' },
  { id: 'truth', name: '真心话大冒险', desc: '刺激又有趣' },
];

const GamesPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-xl font-bold ml-2">游戏</h1>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {games.map(g => (
          <div key={g.id} className="bg-card rounded-2xl p-4 shadow-card text-center">
            <Gamepad2 className="w-10 h-10 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold">{g.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{g.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default GamesPage;
