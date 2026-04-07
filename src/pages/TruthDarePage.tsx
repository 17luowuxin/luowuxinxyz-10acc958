import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, Zap, Users, Loader2, RotateCcw, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAPIConfig } from '@/hooks/useAPIConfig';
import { toast } from 'sonner';


interface Character {
  id: string;
  name: string;
  avatar_url: string | null;
  persona: string | null;
  isUser?: boolean;
}

interface GameLog {
  id: string;
  type: 'system' | 'truth' | 'dare' | 'answer' | 'reaction';
  asker?: string;
  target?: string;
  content: string;
  choice?: 'truth' | 'dare';
}

const TruthDarePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, authSource } = useAuth();
  const { apiConfig, isConfigured, loading: apiConfigLoading } = useAPIConfig();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [gamePhase, setGamePhase] = useState<'setup' | 'playing' | 'choosing' | 'asking' | 'answering'>('setup');
  const [currentTurn, setCurrentTurn] = useState(0);
  const [targetIndex, setTargetIndex] = useState(0);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [players, setPlayers] = useState<Character[]>([]);
  const [currentChoice, setCurrentChoice] = useState<'truth' | 'dare' | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [userProfile, setUserProfile] = useState<{ nickname: string; avatar_url: string | null } | null>(null);
  const [includeUser, setIncludeUser] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');

  useEffect(() => {
    if (user) {
      fetchCharacters();
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('user_id', user?.id)
      .maybeSingle();
    if (data) setUserProfile(data);
  };

  const fetchCharacters = async () => {
    const { data } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', user?.id);
    if (data) setCharacters(data);
  };

  const toggleCharacter = (id: string) => {
    setSelectedCharacters(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const addLog = (log: Omit<GameLog, 'id'>) => {
    setLogs(prev => [...prev, { ...log, id: Date.now().toString() }]);
  };

  const getAIResponse = async (action: string, character: Character, targetCharacter: Character, gameHistory: string = '') => {
    try {
      const { data, error } = await supabase.functions.invoke('truth-dare', {
        body: { action, character, targetCharacter, gameHistory, apiConfig, userId: user?.id, authSource }
      });
      if (error) throw error;
      return data.reply;
    } catch (error) {
      console.error('AI response error:', error);
      toast.error('AI响应失败，请检查API配置');
      return '...';
    }
  };

  const startGame = () => {
    if (apiConfigLoading) {
      toast.error('API配置加载中，请稍候...');
      return;
    }
    if (!apiConfig?.apiKey) {
      toast.error('请先在设置中配置API密钥');
      return;
    }
    
    let gamePlayers: Character[] = characters.filter(c => selectedCharacters.includes(c.id));
    
    // 如果用户选择参与，添加用户到玩家列表
    if (includeUser && userProfile) {
      const userPlayer: Character = {
        id: 'user',
        name: userProfile.nickname || '我',
        avatar_url: userProfile.avatar_url,
        persona: null,
        isUser: true
      };
      gamePlayers = [userPlayer, ...gamePlayers];
    }
    
    if (gamePlayers.length < 3) {
      toast.error('至少需要3个参与者才能开始游戏');
      return;
    }
    setPlayers(gamePlayers);
    setGamePhase('choosing');
    setCurrentTurn(0);
    setLogs([]);
    addLog({ type: 'system', content: '🎉 真心话大冒险开始！' });
    
    // 随机选择第一个被问的人
    const randomTarget = Math.floor(Math.random() * gamePlayers.length);
    setTargetIndex(randomTarget === 0 ? 1 : randomTarget);
  };

  const handleChoice = async (choice: 'truth' | 'dare') => {
    setCurrentChoice(choice);
    setIsLoading(true);
    setGamePhase('asking');

    const asker = players[currentTurn];
    const target = players[targetIndex];

    addLog({ 
      type: 'system', 
      content: `${target.name} 选择了${choice === 'truth' ? '真心话 💭' : '大冒险 ⚡'}` 
    });

    // 提问者提问
    const question = await getAIResponse(
      choice === 'truth' ? 'ask_truth' : 'ask_dare',
      asker,
      target
    );
    
    setCurrentQuestion(question);
    addLog({
      type: choice,
      asker: asker.name,
      target: target.name,
      content: question,
      choice
    });

    setIsLoading(false);
    setGamePhase('answering');
  };

  const handleAnswer = async () => {
    setIsLoading(true);
    const asker = players[currentTurn];
    const target = players[targetIndex];

    // 如果目标是用户，跳过AI回答（用户自己输入）
    if (target.isUser) {
      setIsLoading(false);
      return;
    }

    // AI目标回答
    const answer = await getAIResponse(
      currentChoice === 'truth' ? 'answer_truth' : 'do_dare',
      target,
      asker,
      currentQuestion
    );

    addLog({
      type: 'answer',
      asker: target.name,
      content: answer
    });

    await handleReactionAndNextTurn(answer);
  };

  const handleUserAnswer = async () => {
    if (!userAnswer.trim()) {
      toast.error('请输入你的回答');
      return;
    }
    
    setIsLoading(true);
    const target = players[targetIndex];
    
    addLog({
      type: 'answer',
      asker: target.name,
      content: userAnswer
    });

    await handleReactionAndNextTurn(userAnswer);
    setUserAnswer('');
  };

  const handleReactionAndNextTurn = async (answer: string) => {
    const asker = players[currentTurn];
    const target = players[targetIndex];
    
    // 随机一个AI旁观者反应
    const observers = players.filter((_, i) => i !== currentTurn && i !== targetIndex && !players[i].isUser);
    if (observers.length > 0) {
      const randomObserver = observers[Math.floor(Math.random() * observers.length)];
      const reaction = await getAIResponse(
        'react',
        randomObserver,
        target,
        `${asker.name}问${target.name}：${currentQuestion}，${target.name}的回答是：${answer}`
      );
      addLog({
        type: 'reaction',
        asker: randomObserver.name,
        content: reaction
      });
    }

    // 下一轮
    nextTurn();
    setIsLoading(false);
  };

  const nextTurn = () => {
    // 被问的人成为下一轮的提问者
    const nextAsker = targetIndex;
    // 随机选择新的目标（不能是自己）
    let newTarget;
    do {
      newTarget = Math.floor(Math.random() * players.length);
    } while (newTarget === nextAsker);
    
    setCurrentTurn(nextAsker);
    setTargetIndex(newTarget);
    setCurrentChoice(null);
    setCurrentQuestion('');
    setGamePhase('choosing');
  };

  const resetGame = () => {
    setGamePhase('setup');
    setPlayers([]);
    setLogs([]);
    setCurrentTurn(0);
    setTargetIndex(0);
    setCurrentChoice(null);
    setCurrentQuestion('');
  };

  const currentAsker = players[currentTurn];
  const currentTarget = players[targetIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate('/games')}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold ml-2 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            真心话大冒险
          </h1>
          {isConfigured && (
            <span className="ml-2 text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">自定义API</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="text-gray-500">
            <Settings className="w-5 h-5" />
          </Button>
          {gamePhase !== 'setup' && (
            <Button variant="outline" size="sm" onClick={resetGame}>
              <RotateCcw className="w-4 h-4 mr-1" /> 重新开始
            </Button>
          )}
        </div>
      </div>

      {gamePhase === 'setup' ? (
        <div className="space-y-4">
          {/* 用户参与选项 */}
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => setIncludeUser(!includeUser)}
            className={`bg-white/80 backdrop-blur rounded-2xl p-4 shadow-lg cursor-pointer transition-all ${
              includeUser ? 'ring-2 ring-pink-400' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                includeUser 
                  ? 'bg-gradient-to-br from-pink-400 to-purple-400' 
                  : 'bg-gray-200'
              }`}>
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className={`w-6 h-6 ${includeUser ? 'text-white' : 'text-gray-500'}`} />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">{userProfile?.nickname || '我'}</p>
                <p className="text-xs text-gray-500">点击{includeUser ? '取消' : '加入'}游戏</p>
              </div>
              {includeUser && (
                <span className="text-xs bg-pink-100 text-pink-600 px-2 py-1 rounded-full">已加入</span>
              )}
            </div>
          </motion.div>

          <div className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-pink-500" />
              <span className="font-medium">选择参与的角色</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {characters.map(char => (
                <motion.div
                  key={char.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleCharacter(char.id)}
                  className={`p-3 rounded-xl text-center cursor-pointer transition-all ${
                    selectedCharacters.includes(char.id)
                      ? 'bg-gradient-to-br from-pink-400 to-purple-400 text-white shadow-lg'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-pink-300 to-purple-300 flex items-center justify-center text-white text-lg mb-2">
                    {char.avatar_url ? (
                      <img src={char.avatar_url} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      char.name[0]
                    )}
                  </div>
                  <span className="text-sm font-medium truncate block">{char.name}</span>
                </motion.div>
              ))}
            </div>
            {characters.length === 0 && (
              <p className="text-center text-gray-500 py-4">
                还没有创建AI好友，去创建一些吧~
              </p>
            )}
          </div>

          <Button
            onClick={startGame}
            disabled={(includeUser ? selectedCharacters.length + 1 : selectedCharacters.length) < 3}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-6 text-lg rounded-xl"
          >
            <Heart className="w-5 h-5 mr-2" />
            开始游戏 ({(includeUser ? selectedCharacters.length + 1 : selectedCharacters.length)}/3+)
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 当前回合信息 */}
          <div className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white shadow-lg">
                  {currentAsker?.avatar_url ? (
                    <img src={currentAsker.avatar_url} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    currentAsker?.name[0]
                  )}
                </div>
                <p className="text-sm mt-1 font-medium">{currentAsker?.name}</p>
                <p className="text-xs text-gray-500">提问者</p>
              </div>
              
              <div className="text-2xl">→</div>
              
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-pink-400 to-red-400 flex items-center justify-center text-white shadow-lg">
                  {currentTarget?.avatar_url ? (
                    <img src={currentTarget.avatar_url} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    currentTarget?.name[0]
                  )}
                </div>
                <p className="text-sm mt-1 font-medium">{currentTarget?.name}</p>
                <p className="text-xs text-gray-500">回答者</p>
              </div>
            </div>
          </div>

          {/* 选择阶段 */}
          {gamePhase === 'choosing' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-lg"
            >
              <p className="text-center mb-4 font-medium">
                {currentTarget?.name}，选择真心话还是大冒险？
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handleChoice('truth')}
                  disabled={isLoading}
                  className="py-8 bg-gradient-to-br from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-xl"
                >
                  <Heart className="w-6 h-6 mr-2" />
                  真心话
                </Button>
                <Button
                  onClick={() => handleChoice('dare')}
                  disabled={isLoading}
                  className="py-8 bg-gradient-to-br from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 text-white rounded-xl"
                >
                  <Zap className="w-6 h-6 mr-2" />
                  大冒险
                </Button>
              </div>
            </motion.div>
          )}

          {/* 回答阶段 */}
          {gamePhase === 'answering' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-lg"
            >
              {currentTarget?.isUser ? (
                <div className="space-y-3">
                  <p className="text-center font-medium">轮到你回答了！</p>
                  <Input
                    placeholder={currentChoice === 'truth' ? '输入你的真心话回答...' : '描述你完成大冒险的情况...'}
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="bg-white"
                  />
                  <Button
                    onClick={handleUserAnswer}
                    disabled={isLoading || !userAnswer.trim()}
                    className="w-full bg-gradient-to-r from-green-400 to-emerald-500 text-white"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    提交回答
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="mb-4">等待 {currentTarget?.name} 回答...</p>
                  <Button
                    onClick={handleAnswer}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-green-400 to-emerald-500 text-white"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {currentTarget?.name} 回答
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* 加载中 */}
          {(gamePhase === 'asking' && isLoading) && (
            <div className="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-lg text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-pink-500 mb-2" />
              <p className="text-gray-600">{currentAsker?.name} 正在想问题...</p>
            </div>
          )}

          {/* 游戏日志 */}
          <div className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-lg max-h-80 overflow-y-auto">
            <h3 className="font-bold mb-3 text-gray-700">游戏记录</h3>
            <AnimatePresence>
              {logs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`mb-3 p-3 rounded-xl ${
                    log.type === 'system' ? 'bg-gray-100 text-center text-sm' :
                    log.type === 'truth' ? 'bg-pink-50 border-l-4 border-pink-400' :
                    log.type === 'dare' ? 'bg-purple-50 border-l-4 border-purple-400' :
                    log.type === 'answer' ? 'bg-green-50 border-l-4 border-green-400' :
                    'bg-blue-50 border-l-4 border-blue-400'
                  }`}
                >
                  {log.type === 'system' ? (
                    <span>{log.content}</span>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {log.asker}
                          {log.target && ` → ${log.target}`}
                        </span>
                        {log.choice && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            log.choice === 'truth' ? 'bg-pink-200 text-pink-700' : 'bg-purple-200 text-purple-700'
                          }`}>
                            {log.choice === 'truth' ? '真心话' : '大冒险'}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700">{log.content}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* 玩家列表 */}
          <div className="flex justify-center gap-2 flex-wrap">
            {players.map((player, index) => (
              <div
                key={player.id}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm shadow ${
                  index === currentTurn
                    ? 'ring-2 ring-blue-400 bg-gradient-to-br from-blue-400 to-cyan-400'
                    : index === targetIndex
                    ? 'ring-2 ring-pink-400 bg-gradient-to-br from-pink-400 to-red-400'
                    : 'bg-gradient-to-br from-gray-300 to-gray-400'
                }`}
              >
                {player.avatar_url ? (
                  <img src={player.avatar_url} className="w-full h-full rounded-full object-cover" />
                ) : (
                  player.name[0]
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TruthDarePage;
