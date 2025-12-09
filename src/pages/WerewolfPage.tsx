import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Moon, Sun, Users, Skull, Shield, Eye, FlaskConical, Sword, Vote, Play, RotateCcw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAPIConfig } from '@/hooks/useAPIConfig';
import { toast } from 'sonner';

interface Character {
  id: string;
  name: string;
  persona: string;
  avatar_url: string | null;
}

interface GameCharacter extends Character {
  role: string;
  isAlive: boolean;
  isRevealed: boolean;
}

interface GameLog {
  id: string;
  phase: string;
  round: number;
  speaker: string;
  content: string;
  type: 'action' | 'speech' | 'system';
}

const ROLES = ['狼人', '狼人', '村民', '村民', '预言家', '女巫', '守卫', '猎人'];
const ROLE_ICONS: Record<string, React.ReactNode> = {
  '狼人': <Skull className="w-4 h-4" />,
  '村民': <Users className="w-4 h-4" />,
  '预言家': <Eye className="w-4 h-4" />,
  '女巫': <FlaskConical className="w-4 h-4" />,
  '守卫': <Shield className="w-4 h-4" />,
  '猎人': <Sword className="w-4 h-4" />,
};

const ROLE_COLORS: Record<string, string> = {
  '狼人': 'bg-red-500',
  '村民': 'bg-green-500',
  '预言家': 'bg-purple-500',
  '女巫': 'bg-pink-500',
  '守卫': 'bg-blue-500',
  '猎人': 'bg-orange-500',
};

const WerewolfPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { apiConfig, isConfigured } = useAPIConfig();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [gameCharacters, setGameCharacters] = useState<GameCharacter[]>([]);
  const [gamePhase, setGamePhase] = useState<'setup' | 'night' | 'day' | 'vote' | 'end'>('setup');
  const [round, setRound] = useState(1);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [winner, setWinner] = useState<'good' | 'evil' | null>(null);
  const [witchPotions, setWitchPotions] = useState({ heal: true, poison: true });
  const [lastGuarded, setLastGuarded] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchCharacters();
    }
  }, [user]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchCharacters = async () => {
    const { data } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', user!.id)
      .limit(8);
    
    if (data) {
      setCharacters(data);
    }
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const startGame = () => {
    if (characters.length < 6) {
      toast.error('需要至少6个AI角色才能开始游戏');
      return;
    }

    const selectedCharacters = characters.slice(0, Math.min(8, characters.length));
    const shuffledRoles = shuffleArray(ROLES.slice(0, selectedCharacters.length));
    
    const gameChars: GameCharacter[] = selectedCharacters.map((char, index) => ({
      ...char,
      role: shuffledRoles[index],
      isAlive: true,
      isRevealed: false,
    }));

    setGameCharacters(shuffleArray(gameChars));
    setGamePhase('night');
    setRound(1);
    setLogs([]);
    setWinner(null);
    setWitchPotions({ heal: true, poison: true });
    setLastGuarded(null);

    addLog('system', '游戏开始！天黑请闭眼...', 'night', 1);
  };

  const addLog = (speaker: string, content: string, phase: string, round: number, type: 'action' | 'speech' | 'system' = 'system') => {
    setLogs(prev => [...prev, {
      id: Date.now().toString(),
      phase,
      round,
      speaker,
      content,
      type,
    }]);
  };

  const getAIResponse = async (action: string, character: GameCharacter, targetName?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('werewolf-game', {
        body: {
          action,
          character: {
            id: character.id,
            name: character.name,
            persona: character.persona || '普通人',
            role: character.role,
          },
          gameState: {
            phase: gamePhase,
            round,
            characters: gameCharacters.map(c => ({
              id: c.id,
              name: c.name,
              role: c.role,
              isAlive: c.isAlive,
            })),
            lastAction: logs.slice(-3).map(l => `${l.speaker}: ${l.content}`).join('\n'),
          },
          targetName,
          apiConfig,
        },
      });

      if (error) throw error;
      return data.reply;
    } catch (error) {
      console.error('AI response error:', error);
      toast.error('AI响应失败，请检查API配置');
      return '...';
    }
  };

  const checkWinCondition = (chars: GameCharacter[]): 'good' | 'evil' | null => {
    const aliveWolves = chars.filter(c => c.isAlive && c.role === '狼人').length;
    const aliveGood = chars.filter(c => c.isAlive && c.role !== '狼人').length;

    if (aliveWolves === 0) return 'good';
    if (aliveWolves >= aliveGood) return 'evil';
    return null;
  };

  const processNight = async () => {
    setIsProcessing(true);
    let killedByWolf: string | null = null;
    let guardedPlayer: string | null = null;
    let witchSaved = false;
    let witchKilled: string | null = null;

    const aliveChars = gameCharacters.filter(c => c.isAlive);

    // 守卫行动
    const guard = aliveChars.find(c => c.role === '守卫');
    if (guard) {
      const response = await getAIResponse('night_action', guard);
      addLog(guard.name, response, 'night', round, 'action');
      
      const match = response.match(/守护\[?([^\]，,]+)/);
      if (match) {
        const targetName = match[1].trim();
        if (targetName !== lastGuarded) {
          guardedPlayer = targetName;
          setLastGuarded(targetName);
        }
      }
      await delay(1500);
    }

    // 狼人行动
    const wolves = aliveChars.filter(c => c.role === '狼人');
    if (wolves.length > 0) {
      const wolf = wolves[0];
      const response = await getAIResponse('night_action', wolf);
      addLog('狼人', response, 'night', round, 'action');
      
      const match = response.match(/杀死\[?([^\]，,]+)/);
      if (match) {
        const targetName = match[1].trim();
        if (targetName !== guardedPlayer) {
          killedByWolf = targetName;
        }
      }
      await delay(1500);
    }

    // 预言家行动
    const seer = aliveChars.find(c => c.role === '预言家');
    if (seer) {
      const response = await getAIResponse('night_action', seer);
      addLog(seer.name, response, 'night', round, 'action');
      await delay(1500);
    }

    // 女巫行动
    const witch = aliveChars.find(c => c.role === '女巫');
    if (witch && (witchPotions.heal || witchPotions.poison)) {
      const response = await getAIResponse('night_action', witch, killedByWolf || undefined);
      addLog(witch.name, response, 'night', round, 'action');
      
      if (response.includes('解药') && witchPotions.heal && killedByWolf) {
        witchSaved = true;
        setWitchPotions(prev => ({ ...prev, heal: false }));
      }
      if (response.includes('毒药') && witchPotions.poison) {
        const match = response.match(/毒死?\[?([^\]，,]+)/);
        if (match) {
          witchKilled = match[1].trim();
          setWitchPotions(prev => ({ ...prev, poison: false }));
        }
      }
      await delay(1500);
    }

    // 结算夜晚
    const updatedChars = [...gameCharacters];
    const deaths: string[] = [];

    if (killedByWolf && !witchSaved) {
      const victim = updatedChars.find(c => c.name === killedByWolf);
      if (victim) {
        victim.isAlive = false;
        deaths.push(victim.name);
      }
    }

    if (witchKilled) {
      const victim = updatedChars.find(c => c.name === witchKilled);
      if (victim) {
        victim.isAlive = false;
        if (!deaths.includes(victim.name)) {
          deaths.push(victim.name);
        }
      }
    }

    setGameCharacters(updatedChars);

    // 天亮
    addLog('系统', '天亮了！', 'day', round, 'system');
    if (deaths.length > 0) {
      addLog('系统', `昨晚${deaths.join('、')}死了`, 'day', round, 'system');
    } else {
      addLog('系统', '昨晚是平安夜', 'day', round, 'system');
    }

    const result = checkWinCondition(updatedChars);
    if (result) {
      setWinner(result);
      setGamePhase('end');
    } else {
      setGamePhase('day');
    }

    setIsProcessing(false);
  };

  const processDay = async () => {
    setIsProcessing(true);
    const aliveChars = gameCharacters.filter(c => c.isAlive);

    for (const char of aliveChars) {
      const response = await getAIResponse('day_speech', char);
      addLog(char.name, response, 'day', round, 'speech');
      await delay(2000);
    }

    setGamePhase('vote');
    setIsProcessing(false);
  };

  const processVote = async () => {
    setIsProcessing(true);
    const aliveChars = gameCharacters.filter(c => c.isAlive);
    const votes: Record<string, number> = {};

    for (const char of aliveChars) {
      const response = await getAIResponse('vote', char);
      addLog(char.name, response, 'vote', round, 'action');
      
      const match = response.match(/投票给\[?([^\]，,]+)/);
      if (match) {
        const targetName = match[1].trim();
        votes[targetName] = (votes[targetName] || 0) + 1;
      }
      await delay(1500);
    }

    // 统计票数
    let maxVotes = 0;
    let eliminated: string | null = null;
    for (const [name, count] of Object.entries(votes)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = name;
      }
    }

    if (eliminated) {
      const updatedChars = [...gameCharacters];
      const victim = updatedChars.find(c => c.name === eliminated);
      if (victim) {
        victim.isAlive = false;
        victim.isRevealed = true;
        addLog('系统', `${eliminated}被投票出局（${maxVotes}票），身份是${victim.role}`, 'vote', round, 'system');
        
        // 遗言
        const lastWords = await getAIResponse('last_words', victim);
        addLog(victim.name, lastWords, 'vote', round, 'speech');
        
        setGameCharacters(updatedChars);
      }
    }

    const result = checkWinCondition(gameCharacters);
    if (result) {
      setWinner(result);
      setGamePhase('end');
    } else {
      setRound(prev => prev + 1);
      setGamePhase('night');
      addLog('系统', '天黑请闭眼...', 'night', round + 1, 'system');
    }

    setIsProcessing(false);
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleNextPhase = () => {
    if (gamePhase === 'night') {
      processNight();
    } else if (gamePhase === 'day') {
      processDay();
    } else if (gamePhase === 'vote') {
      processVote();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/50 backdrop-blur-lg p-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">狼人杀</h1>
        {isConfigured && (
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">自定义API</span>
        )}
        <button onClick={() => navigate('/settings')} className="p-2 rounded-full hover:bg-white/10 ml-auto">
          <Settings className="w-5 h-5" />
        </button>
        {gamePhase !== 'setup' && gamePhase !== 'end' && (
          <div className="flex items-center gap-2">
            {gamePhase === 'night' ? <Moon className="w-5 h-5 text-blue-400" /> : <Sun className="w-5 h-5 text-yellow-400" />}
            <span>第{round}天 {gamePhase === 'night' ? '夜晚' : gamePhase === 'day' ? '白天' : '投票'}</span>
          </div>
        )}
      </div>

      {/* Setup Phase */}
      {gamePhase === 'setup' && (
        <div className="p-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">选择AI角色</h2>
            <p className="text-white/60">需要至少6个角色，最多8个</p>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            {characters.map((char) => (
              <motion.div
                key={char.id}
                whileHover={{ scale: 1.05 }}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/10"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-candy-purple to-candy-pink flex items-center justify-center overflow-hidden">
                  {char.avatar_url ? (
                    <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">👤</span>
                  )}
                </div>
                <span className="text-xs font-medium">{char.name}</span>
              </motion.div>
            ))}
          </div>

          <div className="flex justify-center">
            <Button
              onClick={startGame}
              disabled={characters.length < 6}
              className="bg-gradient-to-r from-candy-purple to-candy-pink text-white px-8 py-3 rounded-full"
            >
              <Play className="w-5 h-5 mr-2" />
              开始游戏
            </Button>
          </div>

          {characters.length < 6 && (
            <p className="text-center text-red-400 mt-4">
              请先在"好友"页面创建至少6个AI角色
            </p>
          )}
        </div>
      )}

      {/* Game Phase */}
      {(gamePhase === 'night' || gamePhase === 'day' || gamePhase === 'vote') && (
        <div className="flex flex-col h-[calc(100vh-64px)]">
          {/* Characters */}
          <div className="p-4 border-b border-white/10">
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {gameCharacters.map((char) => (
                <div
                  key={char.id}
                  className={`flex flex-col items-center gap-1 min-w-[60px] ${!char.isAlive ? 'opacity-40' : ''}`}
                >
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${char.isAlive ? 'bg-white/20' : 'bg-gray-600'}`}>
                      {char.avatar_url ? (
                        <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg">👤</span>
                      )}
                    </div>
                    {!char.isAlive && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Skull className="w-6 h-6 text-red-500" />
                      </div>
                    )}
                    {char.isRevealed && (
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${ROLE_COLORS[char.role]} flex items-center justify-center`}>
                        {ROLE_ICONS[char.role]}
                      </div>
                    )}
                  </div>
                  <span className="text-xs">{char.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Logs */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <AnimatePresence>
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl ${
                    log.type === 'system' 
                      ? 'bg-white/5 text-white/60 text-center text-sm' 
                      : log.type === 'action'
                      ? 'bg-purple-500/20 border border-purple-500/30'
                      : 'bg-white/10'
                  }`}
                >
                  {log.type !== 'system' && (
                    <div className="font-medium text-candy-pink mb-1">{log.speaker}</div>
                  )}
                  <div>{log.content}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={logsEndRef} />
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-white/10">
            <Button
              onClick={handleNextPhase}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-candy-purple to-candy-pink py-3 rounded-full"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  处理中...
                </div>
              ) : gamePhase === 'night' ? (
                <>
                  <Moon className="w-5 h-5 mr-2" />
                  开始夜晚行动
                </>
              ) : gamePhase === 'day' ? (
                <>
                  <Sun className="w-5 h-5 mr-2" />
                  开始白天讨论
                </>
              ) : (
                <>
                  <Vote className="w-5 h-5 mr-2" />
                  开始投票
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* End Phase */}
      {gamePhase === 'end' && (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-center"
          >
            <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center ${winner === 'good' ? 'bg-green-500' : 'bg-red-500'}`}>
              {winner === 'good' ? <Shield className="w-12 h-12" /> : <Skull className="w-12 h-12" />}
            </div>
            <h2 className="text-3xl font-bold mb-2">
              {winner === 'good' ? '好人阵营胜利！' : '狼人阵营胜利！'}
            </h2>
            <p className="text-white/60 mb-8">
              游戏结束，共进行了{round}轮
            </p>

            {/* Reveal all roles */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {gameCharacters.map((char) => (
                <div key={char.id} className={`flex flex-col items-center gap-2 p-3 rounded-xl bg-white/10 ${!char.isAlive ? 'opacity-50' : ''}`}>
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                      {char.avatar_url ? (
                        <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>👤</span>
                      )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${ROLE_COLORS[char.role]} flex items-center justify-center`}>
                      {ROLE_ICONS[char.role]}
                    </div>
                  </div>
                  <span className="text-xs font-medium">{char.name}</span>
                  <span className="text-xs text-white/60">{char.role}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={() => setGamePhase('setup')}
              className="bg-gradient-to-r from-candy-purple to-candy-pink px-8 py-3 rounded-full"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              再来一局
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default WerewolfPage;
