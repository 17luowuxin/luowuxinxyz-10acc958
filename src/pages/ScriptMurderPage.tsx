import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Clock, Star, Play, MessageCircle, Vote, Eye, RotateCcw, Shuffle, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAPIConfig } from '@/hooks/useAPIConfig';
import { toast } from 'sonner';
import { SCRIPTS, Script, ScriptRole } from '@/data/scripts';

interface Character {
  id: string;
  name: string;
  persona: string;
  avatar_url: string | null;
}

interface GamePlayer {
  character: Character;
  role: ScriptRole;
}

interface GameLog {
  id: string;
  speaker: string;
  content: string;
  phase: string;
  avatar?: string;
}

const ScriptMurderPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { apiConfig, isConfigured } = useAPIConfig();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [gamePhase, setGamePhase] = useState<'select' | 'assign' | 'intro' | 'discuss' | 'vote' | 'reveal'>('select');
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [discussionRound, setDiscussionRound] = useState(1);
  const [votes, setVotes] = useState<Record<string, string>>({});
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
      .eq('user_id', user!.id);
    
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

  const selectScript = (script: Script) => {
    setSelectedScript(script);
    setGamePhase('assign');
  };

  const assignRoles = () => {
    if (!selectedScript) return;
    
    const roleCount = selectedScript.roles.length;
    if (characters.length < roleCount) {
      toast.error(`需要至少${roleCount}个AI角色才能玩这个剧本`);
      return;
    }

    const shuffledCharacters = shuffleArray(characters).slice(0, roleCount);
    const shuffledRoles = shuffleArray([...selectedScript.roles]);

    const gamePlayers: GamePlayer[] = shuffledCharacters.map((char, index) => ({
      character: char,
      role: shuffledRoles[index],
    }));

    setPlayers(gamePlayers);
    setLogs([]);
    setVotes({});
    setDiscussionRound(1);
    
    addLog('系统', `剧本《${selectedScript.title}》开始！`, 'system');
    addLog('系统', selectedScript.story, 'story');
    
    setGamePhase('intro');
  };

  const addLog = (speaker: string, content: string, phase: string, avatar?: string) => {
    setLogs(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      speaker,
      content,
      phase,
      avatar,
    }]);
  };

  const getAIResponse = async (action: string, player: GamePlayer, question?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('script-murder', {
        body: {
          action,
          character: {
            id: player.character.id,
            name: player.character.name,
            persona: player.character.persona || '普通人',
          },
          scriptRole: player.role,
          script: {
            title: selectedScript?.title,
            background: selectedScript?.background,
          },
          gameState: {
            roles: players.map(p => ({ name: p.role.name })),
            recentSpeeches: logs.slice(-5).filter(l => l.phase === 'discuss').map(l => `${l.speaker}: ${l.content}`),
          },
          question,
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

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const processIntroductions = async () => {
    setIsProcessing(true);
    addLog('系统', '现在开始自我介绍环节...', 'system');

    for (const player of players) {
      const response = await getAIResponse('introduce', player);
      addLog(player.role.name, response, 'intro', player.character.avatar_url || undefined);
      await delay(2000);
    }

    addLog('系统', '自我介绍结束，接下来是讨论环节。', 'system');
    addLog('系统', `线索提示：${selectedScript?.clues.join('；')}`, 'clue');
    setGamePhase('discuss');
    setIsProcessing(false);
  };

  const processDiscussion = async () => {
    setIsProcessing(true);
    addLog('系统', `第${discussionRound}轮讨论开始...`, 'system');

    for (const player of players) {
      const response = await getAIResponse('discuss', player);
      addLog(player.role.name, response, 'discuss', player.character.avatar_url || undefined);
      await delay(2500);
    }

    if (discussionRound >= 2) {
      addLog('系统', '讨论结束，现在开始投票！', 'system');
      setGamePhase('vote');
    } else {
      setDiscussionRound(prev => prev + 1);
      addLog('系统', '本轮讨论结束，可以继续讨论或开始投票。', 'system');
    }
    
    setIsProcessing(false);
  };

  const processVoting = async () => {
    setIsProcessing(true);
    addLog('系统', '投票环节开始！每位玩家将投出自己的一票...', 'system');

    const voteResults: Record<string, string> = {};

    for (const player of players) {
      const response = await getAIResponse('vote', player);
      addLog(player.role.name, response, 'vote', player.character.avatar_url || undefined);
      
      const match = response.match(/投票给\[?([^\]，,]+)/);
      if (match) {
        voteResults[player.role.name] = match[1].trim();
      }
      await delay(1500);
    }

    setVotes(voteResults);
    
    // Count votes
    const voteCounts: Record<string, number> = {};
    Object.values(voteResults).forEach(vote => {
      voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });

    let maxVotes = 0;
    let suspected = '';
    Object.entries(voteCounts).forEach(([name, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        suspected = name;
      }
    });

    const murderer = players.find(p => p.role.isMurderer);
    const suspectedPlayer = players.find(p => p.role.name === suspected);

    addLog('系统', `投票结果：${Object.entries(voteCounts).map(([n, c]) => `${n}(${c}票)`).join('、')}`, 'system');
    
    if (suspectedPlayer?.role.isMurderer) {
      addLog('系统', `🎉 恭喜！大家成功找出了凶手 ${suspected}！`, 'result');
    } else {
      addLog('系统', `😱 很遗憾，${suspected}不是凶手。真正的凶手是 ${murderer?.role.name}！`, 'result');
    }

    setGamePhase('reveal');
    setIsProcessing(false);
  };

  const processReveal = async () => {
    setIsProcessing(true);
    addLog('系统', '现在揭晓所有人的真实身份...', 'system');

    for (const player of players) {
      const response = await getAIResponse('reveal', player);
      const roleTag = player.role.isMurderer ? '【凶手】' : '【好人】';
      addLog(`${roleTag} ${player.role.name}`, response, 'reveal', player.character.avatar_url || undefined);
      await delay(1500);
    }

    setIsProcessing(false);
  };

  const handleAction = () => {
    if (gamePhase === 'intro') {
      processIntroductions();
    } else if (gamePhase === 'discuss') {
      processDiscussion();
    } else if (gamePhase === 'vote') {
      processVoting();
    } else if (gamePhase === 'reveal') {
      processReveal();
    }
  };

  const resetGame = () => {
    setSelectedScript(null);
    setPlayers([]);
    setGamePhase('select');
    setLogs([]);
    setVotes({});
    setDiscussionRound(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/50 backdrop-blur-lg p-4 flex items-center gap-4">
        <button onClick={() => gamePhase === 'select' ? navigate(-1) : resetGame()} className="p-2 rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">剧本杀</h1>
        {isConfigured && (
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">自定义API</span>
        )}
        <button onClick={() => navigate('/settings')} className="p-2 rounded-full hover:bg-white/10 ml-auto">
          <Settings className="w-5 h-5" />
        </button>
        {selectedScript && gamePhase !== 'select' && (
          <span className="text-sm text-white/60">{selectedScript.title}</span>
        )}
      </div>

      {/* Script Selection */}
      {gamePhase === 'select' && (
        <div className="p-6 space-y-6">
          <h2 className="text-2xl font-bold text-center mb-8">选择剧本</h2>
          
          <div className="space-y-4">
            {SCRIPTS.map((script) => (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => selectScript(script)}
                className="bg-white/10 backdrop-blur rounded-2xl p-4 cursor-pointer border border-white/10 hover:border-purple-500/50 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{script.cover}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{script.title}</h3>
                    <p className="text-sm text-white/60 mt-1 line-clamp-2">{script.background}</p>
                    <div className="flex gap-4 mt-3 text-xs text-white/50">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {script.playerCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {script.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {script.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Role Assignment */}
      {gamePhase === 'assign' && selectedScript && (
        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="text-4xl mb-4">{selectedScript.cover}</div>
            <h2 className="text-2xl font-bold">{selectedScript.title}</h2>
            <p className="text-white/60 mt-2">{selectedScript.background}</p>
          </div>

          <div className="bg-white/10 rounded-xl p-4">
            <h3 className="font-semibold mb-3">角色列表 ({selectedScript.roles.length}人)</h3>
            <div className="space-y-2">
              {selectedScript.roles.map(role => (
                <div key={role.id} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center text-sm">
                    {role.gender === 'male' ? '👨' : role.gender === 'female' ? '👩' : '🧑'}
                  </div>
                  <div>
                    <div className="font-medium">{role.name}</div>
                    <div className="text-xs text-white/50">{role.occupation} · {role.age}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/10 rounded-xl p-4">
            <h3 className="font-semibold mb-3">可用AI角色 ({characters.length}人)</h3>
            <div className="flex flex-wrap gap-2">
              {characters.slice(0, 8).map(char => (
                <div key={char.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-candy-pink to-candy-purple overflow-hidden">
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">👤</div>
                    )}
                  </div>
                  <span className="text-sm">{char.name}</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={assignRoles}
            disabled={characters.length < selectedScript.roles.length}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 py-3 rounded-full"
          >
            <Shuffle className="w-5 h-5 mr-2" />
            随机分配角色并开始
          </Button>

          {characters.length < selectedScript.roles.length && (
            <p className="text-center text-red-400 text-sm">
              需要至少{selectedScript.roles.length}个AI角色，当前只有{characters.length}个
            </p>
          )}
        </div>
      )}

      {/* Game Phase */}
      {(gamePhase === 'intro' || gamePhase === 'discuss' || gamePhase === 'vote' || gamePhase === 'reveal') && (
        <div className="flex flex-col h-[calc(100vh-64px)]">
          {/* Players */}
          <div className="p-4 border-b border-white/10">
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {players.map((player) => (
                <div key={player.character.id} className="flex flex-col items-center gap-1 min-w-[60px]">
                  <div className="w-12 h-12 rounded-full bg-white/20 overflow-hidden">
                    {player.character.avatar_url ? (
                      <img src={player.character.avatar_url} alt={player.role.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">👤</div>
                    )}
                  </div>
                  <span className="text-xs font-medium">{player.role.name}</span>
                  <span className="text-[10px] text-white/50">{player.character.name}</span>
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
                    log.phase === 'system' || log.phase === 'result'
                      ? 'bg-purple-500/20 text-center text-sm'
                      : log.phase === 'story'
                      ? 'bg-amber-500/20 border border-amber-500/30'
                      : log.phase === 'clue'
                      ? 'bg-blue-500/20 border border-blue-500/30 text-sm'
                      : 'bg-white/10'
                  }`}
                >
                  {log.phase !== 'system' && log.phase !== 'story' && log.phase !== 'clue' && log.phase !== 'result' && (
                    <div className="flex items-center gap-2 mb-2">
                      {log.avatar && (
                        <div className="w-6 h-6 rounded-full overflow-hidden">
                          <img src={log.avatar} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <span className="font-medium text-purple-300">{log.speaker}</span>
                    </div>
                  )}
                  <div>{log.content}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={logsEndRef} />
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-white/10 space-y-2">
            {gamePhase === 'discuss' && discussionRound >= 2 && !isProcessing && (
              <Button
                onClick={() => setGamePhase('vote')}
                variant="outline"
                className="w-full border-purple-500 text-purple-300"
              >
                <Vote className="w-5 h-5 mr-2" />
                跳过讨论，开始投票
              </Button>
            )}
            
            <Button
              onClick={gamePhase === 'reveal' && logs.some(l => l.phase === 'reveal') ? resetGame : handleAction}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 py-3 rounded-full"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  处理中...
                </div>
              ) : gamePhase === 'intro' ? (
                <>
                  <MessageCircle className="w-5 h-5 mr-2" />
                  开始自我介绍
                </>
              ) : gamePhase === 'discuss' ? (
                <>
                  <MessageCircle className="w-5 h-5 mr-2" />
                  第{discussionRound}轮讨论
                </>
              ) : gamePhase === 'vote' ? (
                <>
                  <Vote className="w-5 h-5 mr-2" />
                  开始投票
                </>
              ) : logs.some(l => l.phase === 'reveal') ? (
                <>
                  <RotateCcw className="w-5 h-5 mr-2" />
                  重新开始
                </>
              ) : (
                <>
                  <Eye className="w-5 h-5 mr-2" />
                  揭晓真相
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptMurderPage;
