import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Moon, Sun, Users, Skull, Shield, Eye, FlaskConical, Sword, Vote, Play, RotateCcw, Settings, User, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAPIConfig } from '@/hooks/useAPIConfig';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  isPlayer: boolean; // 是否是用户玩家
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
  
  // 用户参与模式相关状态
  const [playerMode, setPlayerMode] = useState(false);
  const [playerInput, setPlayerInput] = useState('');
  const [waitingForPlayer, setWaitingForPlayer] = useState(false);
  const [playerAction, setPlayerAction] = useState<'night' | 'day' | 'vote' | null>(null);
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [targetAction, setTargetAction] = useState<string>('');
  const [killedByWolfThisNight, setKilledByWolfThisNight] = useState<string | null>(null);

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

  const getPlayerCharacter = (): GameCharacter | undefined => {
    return gameCharacters.find(c => c.isPlayer);
  };

  const startGame = (withPlayer: boolean) => {
    const requiredAICount = withPlayer ? 5 : 6;
    if (characters.length < requiredAICount) {
      toast.error(`需要至少${requiredAICount}个AI角色才能开始游戏`);
      return;
    }

    setPlayerMode(withPlayer);
    const totalPlayers = Math.min(8, characters.length + (withPlayer ? 1 : 0));
    const selectedCharacters = characters.slice(0, withPlayer ? totalPlayers - 1 : totalPlayers);
    const shuffledRoles = shuffleArray(ROLES.slice(0, totalPlayers));
    
    let gameChars: GameCharacter[] = selectedCharacters.map((char, index) => ({
      ...char,
      role: shuffledRoles[withPlayer ? index + 1 : index],
      isAlive: true,
      isRevealed: false,
      isPlayer: false,
    }));

    // 如果用户参与，添加用户玩家
    if (withPlayer) {
      const playerChar: GameCharacter = {
        id: 'player',
        name: '我',
        persona: '玩家',
        avatar_url: null,
        role: shuffledRoles[0],
        isAlive: true,
        isRevealed: false,
        isPlayer: true,
      };
      gameChars = [playerChar, ...gameChars];
    }

    setGameCharacters(shuffleArray(gameChars));
    setGamePhase('night');
    setRound(1);
    setLogs([]);
    setWinner(null);
    setWitchPotions({ heal: true, poison: true });
    setLastGuarded(null);

    addLog('系统', '游戏开始！天黑请闭眼...', 'night', 1);
    
    if (withPlayer) {
      const player = gameChars.find(c => c.isPlayer);
      addLog('系统', `你的身份是：${player?.role}`, 'night', 1);
    }
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

  const getAliveCharacters = () => gameCharacters.filter(c => c.isAlive);

  const handlePlayerNightAction = (target: string) => {
    const player = getPlayerCharacter();
    if (!player) return;

    setShowTargetDialog(false);
    
    let actionText = '';
    if (player.role === '狼人') {
      actionText = `我决定杀死[${target}]`;
    } else if (player.role === '预言家') {
      const targetChar = gameCharacters.find(c => c.name === target);
      const isWolf = targetChar?.role === '狼人';
      actionText = `我查验${target}，${isWolf ? '是狼人！' : '是好人'}`;
    } else if (player.role === '守卫') {
      actionText = `我守护[${target}]`;
    } else if (player.role === '女巫') {
      actionText = targetAction === 'heal' 
        ? `我使用解药救${killedByWolfThisNight}` 
        : `我使用毒药毒死[${target}]`;
    }
    
    addLog('我', actionText, 'night', round, 'action');
    setPlayerInput('');
    setWaitingForPlayer(false);
    setPlayerAction(null);
    
    // 继续处理剩余的夜晚行动
    continueNightAfterPlayer(target);
  };

  const handlePlayerDaySpeech = () => {
    if (!playerInput.trim()) return;
    
    addLog('我', playerInput, 'day', round, 'speech');
    setPlayerInput('');
    setWaitingForPlayer(false);
    setPlayerAction(null);
    
    // 继续处理剩余的白天发言
    continueDayAfterPlayer();
  };

  const handlePlayerVote = (target: string) => {
    setShowTargetDialog(false);
    addLog('我', `我投票给[${target}]`, 'vote', round, 'action');
    setWaitingForPlayer(false);
    setPlayerAction(null);
    
    // 继续处理剩余的投票
    continueVoteAfterPlayer(target);
  };

  const processNight = async () => {
    setIsProcessing(true);
    let killedByWolf: string | null = null;
    let guardedPlayer: string | null = null;
    let witchSaved = false;
    let witchKilled: string | null = null;

    const aliveChars = gameCharacters.filter(c => c.isAlive);
    const player = getPlayerCharacter();
    const isPlayerAlive = player?.isAlive;

    // 守卫行动
    const guard = aliveChars.find(c => c.role === '守卫');
    if (guard) {
      if (guard.isPlayer && isPlayerAlive) {
        setWaitingForPlayer(true);
        setPlayerAction('night');
        setShowTargetDialog(true);
        setTargetAction('guard');
        setIsProcessing(false);
        return;
      } else if (!guard.isPlayer) {
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
    }

    // 狼人行动
    const wolves = aliveChars.filter(c => c.role === '狼人');
    const playerIsWolf = player?.role === '狼人' && isPlayerAlive;
    
    if (playerIsWolf && !guard?.isPlayer) {
      setWaitingForPlayer(true);
      setPlayerAction('night');
      setShowTargetDialog(true);
      setTargetAction('kill');
      setIsProcessing(false);
      return;
    } else if (wolves.length > 0 && !wolves.some(w => w.isPlayer)) {
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
      if (seer.isPlayer && isPlayerAlive && !guard?.isPlayer && !playerIsWolf) {
        setWaitingForPlayer(true);
        setPlayerAction('night');
        setShowTargetDialog(true);
        setTargetAction('check');
        setIsProcessing(false);
        return;
      } else if (!seer.isPlayer) {
        const response = await getAIResponse('night_action', seer);
        addLog(seer.name, response, 'night', round, 'action');
        await delay(1500);
      }
    }

    // 女巫行动
    const witch = aliveChars.find(c => c.role === '女巫');
    if (witch && (witchPotions.heal || witchPotions.poison)) {
      if (witch.isPlayer && isPlayerAlive) {
        setKilledByWolfThisNight(killedByWolf);
        setWaitingForPlayer(true);
        setPlayerAction('night');
        setShowTargetDialog(true);
        setTargetAction('witch');
        setIsProcessing(false);
        return;
      } else if (!witch.isPlayer) {
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
    }

    // 结算夜晚
    finishNight(killedByWolf, witchSaved, witchKilled, guardedPlayer);
  };

  const continueNightAfterPlayer = async (playerTarget: string) => {
    setIsProcessing(true);
    const player = getPlayerCharacter();
    const aliveChars = gameCharacters.filter(c => c.isAlive);
    
    let killedByWolf: string | null = null;
    let guardedPlayer: string | null = null;
    let witchSaved = false;
    let witchKilled: string | null = null;

    // 根据玩家角色处理结果
    if (player?.role === '守卫') {
      if (playerTarget !== lastGuarded) {
        guardedPlayer = playerTarget;
        setLastGuarded(playerTarget);
      }
    } else if (player?.role === '狼人') {
      if (playerTarget !== guardedPlayer) {
        killedByWolf = playerTarget;
      }
    } else if (player?.role === '女巫') {
      if (targetAction === 'heal' && witchPotions.heal) {
        witchSaved = true;
        setWitchPotions(prev => ({ ...prev, heal: false }));
      } else if (targetAction === 'poison' && witchPotions.poison) {
        witchKilled = playerTarget;
        setWitchPotions(prev => ({ ...prev, poison: false }));
      }
    }

    // 继续AI角色行动
    const wolves = aliveChars.filter(c => c.role === '狼人' && !c.isPlayer);
    if (wolves.length > 0 && player?.role !== '狼人') {
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

    const seer = aliveChars.find(c => c.role === '预言家' && !c.isPlayer);
    if (seer) {
      const response = await getAIResponse('night_action', seer);
      addLog(seer.name, response, 'night', round, 'action');
      await delay(1500);
    }

    const witch = aliveChars.find(c => c.role === '女巫' && !c.isPlayer);
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

    finishNight(killedByWolf, witchSaved, witchKilled, guardedPlayer);
  };

  const finishNight = (killedByWolf: string | null, witchSaved: boolean, witchKilled: string | null, guardedPlayer: string | null) => {
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
    const player = getPlayerCharacter();

    for (const char of aliveChars) {
      if (char.isPlayer && player?.isAlive) {
        setWaitingForPlayer(true);
        setPlayerAction('day');
        setIsProcessing(false);
        return;
      }
      
      const response = await getAIResponse('day_speech', char);
      addLog(char.name, response, 'day', round, 'speech');
      await delay(2000);
    }

    setGamePhase('vote');
    setIsProcessing(false);
  };

  const continueDayAfterPlayer = async () => {
    setIsProcessing(true);
    const aliveChars = gameCharacters.filter(c => c.isAlive);
    const playerIndex = aliveChars.findIndex(c => c.isPlayer);

    for (let i = playerIndex + 1; i < aliveChars.length; i++) {
      const char = aliveChars[i];
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
    const player = getPlayerCharacter();

    for (const char of aliveChars) {
      if (char.isPlayer && player?.isAlive) {
        setWaitingForPlayer(true);
        setPlayerAction('vote');
        setShowTargetDialog(true);
        setTargetAction('vote');
        setIsProcessing(false);
        return;
      }
      
      const response = await getAIResponse('vote', char);
      addLog(char.name, response, 'vote', round, 'action');
      await delay(1500);
    }

    finishVote();
  };

  const continueVoteAfterPlayer = async (playerVote: string) => {
    setIsProcessing(true);
    const aliveChars = gameCharacters.filter(c => c.isAlive);
    const playerIndex = aliveChars.findIndex(c => c.isPlayer);
    const votes: Record<string, number> = {};
    votes[playerVote] = 1;

    for (let i = 0; i < aliveChars.length; i++) {
      if (i === playerIndex) continue;
      
      const char = aliveChars[i];
      const response = await getAIResponse('vote', char);
      addLog(char.name, response, 'vote', round, 'action');
      
      const match = response.match(/投票给\[?([^\]，,]+)/);
      if (match) {
        const targetName = match[1].trim();
        votes[targetName] = (votes[targetName] || 0) + 1;
      }
      await delay(1500);
    }

    finishVoteWithVotes(votes);
  };

  const finishVote = async () => {
    const aliveChars = gameCharacters.filter(c => c.isAlive);
    const votes: Record<string, number> = {};

    // 重新统计已有的投票
    const voteLogs = logs.filter(l => l.phase === 'vote' && l.round === round && l.type === 'action');
    voteLogs.forEach(log => {
      const match = log.content.match(/投票给\[?([^\]，,]+)/);
      if (match) {
        const targetName = match[1].trim();
        votes[targetName] = (votes[targetName] || 0) + 1;
      }
    });

    finishVoteWithVotes(votes);
  };

  const finishVoteWithVotes = async (votes: Record<string, number>) => {
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
        
        if (!victim.isPlayer) {
          const lastWords = await getAIResponse('last_words', victim);
          addLog(victim.name, lastWords, 'vote', round, 'speech');
        } else {
          addLog('我', '（你被投票出局了）', 'vote', round, 'speech');
        }
        
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

  const renderTargetSelection = () => {
    const aliveChars = getAliveCharacters().filter(c => !c.isPlayer);
    const player = getPlayerCharacter();
    
    let title = '';
    let description = '';
    
    if (targetAction === 'kill') {
      title = '选择击杀目标';
      description = '你是狼人，请选择今晚要击杀的目标';
    } else if (targetAction === 'guard') {
      title = '选择守护目标';
      description = '你是守卫，请选择今晚要守护的玩家（不能连续守护同一人）';
    } else if (targetAction === 'check') {
      title = '选择查验目标';
      description = '你是预言家，请选择要查验的玩家';
    } else if (targetAction === 'witch') {
      title = '女巫行动';
      description = killedByWolfThisNight 
        ? `今晚${killedByWolfThisNight}被狼人杀害，是否使用解药？` 
        : '今晚无人被杀，是否使用毒药？';
    } else if (targetAction === 'vote') {
      title = '投票环节';
      description = '请选择你认为是狼人的玩家进行投票';
    }

    return (
      <AlertDialog open={showTargetDialog} onOpenChange={setShowTargetDialog}>
        <AlertDialogContent className="bg-slate-900 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2 my-4">
            {targetAction === 'witch' && killedByWolfThisNight && witchPotions.heal && (
              <Button
                onClick={() => {
                  setTargetAction('heal');
                  handlePlayerNightAction(killedByWolfThisNight);
                }}
                className="bg-green-500 hover:bg-green-600"
              >
                使用解药
              </Button>
            )}
            {targetAction === 'witch' && witchPotions.poison && (
              <>
                {aliveChars.map(char => (
                  <Button
                    key={char.id}
                    onClick={() => {
                      setTargetAction('poison');
                      handlePlayerNightAction(char.name);
                    }}
                    variant="outline"
                    className="border-red-500/50 text-red-300"
                  >
                    毒死 {char.name}
                  </Button>
                ))}
              </>
            )}
            {targetAction !== 'witch' && aliveChars.map(char => (
              <Button
                key={char.id}
                onClick={() => {
                  if (targetAction === 'vote') {
                    handlePlayerVote(char.name);
                  } else {
                    handlePlayerNightAction(char.name);
                  }
                }}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                {char.name}
              </Button>
            ))}
          </div>
          <AlertDialogFooter>
            {targetAction === 'witch' && (
              <AlertDialogCancel 
                onClick={() => {
                  setShowTargetDialog(false);
                  setWaitingForPlayer(false);
                  setPlayerAction(null);
                  addLog('我', '我选择不使用药水', 'night', round, 'action');
                  continueNightAfterPlayer('');
                }}
                className="bg-white/10 text-white border-white/20"
              >
                不使用药水
              </AlertDialogCancel>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/50 backdrop-blur-lg p-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">狼人杀</h1>
        {playerMode && (
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">玩家模式</span>
        )}
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
            <h2 className="text-2xl font-bold mb-2">选择游戏模式</h2>
            <p className="text-white/60">你可以选择观战或加入游戏</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <motion.div
              whileHover={{ scale: 1.02 }}
              onClick={() => startGame(false)}
              className={`p-6 rounded-2xl cursor-pointer border-2 transition-all ${
                characters.length >= 6 
                  ? 'bg-white/10 border-white/20 hover:border-purple-500' 
                  : 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
              }`}
            >
              <Eye className="w-10 h-10 mb-4 text-purple-400" />
              <h3 className="font-bold text-lg mb-2">观战模式</h3>
              <p className="text-sm text-white/60">观看AI角色们进行游戏</p>
              <p className="text-xs text-white/40 mt-2">需要6-8个AI角色</p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              onClick={() => startGame(true)}
              className={`p-6 rounded-2xl cursor-pointer border-2 transition-all ${
                characters.length >= 5 
                  ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50 hover:border-purple-400' 
                  : 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
              }`}
            >
              <User className="w-10 h-10 mb-4 text-pink-400" />
              <h3 className="font-bold text-lg mb-2">玩家模式</h3>
              <p className="text-sm text-white/60">与AI角色一起参与游戏</p>
              <p className="text-xs text-white/40 mt-2">需要5-7个AI角色</p>
            </motion.div>
          </div>

          <div className="mb-6">
            <h3 className="font-medium mb-3">可用AI角色 ({characters.length})</h3>
            <div className="grid grid-cols-4 gap-4">
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
          </div>

          {characters.length < 5 && (
            <p className="text-center text-red-400 mt-4">
              请先在"好友"页面创建至少5个AI角色
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
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${
                      char.isPlayer ? 'ring-2 ring-pink-500' : ''
                    } ${char.isAlive ? 'bg-white/20' : 'bg-gray-600'}`}>
                      {char.isPlayer ? (
                        <User className="w-6 h-6 text-pink-400" />
                      ) : char.avatar_url ? (
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
                    {(char.isRevealed || (char.isPlayer && playerMode)) && (
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${ROLE_COLORS[char.role]} flex items-center justify-center`}>
                        {ROLE_ICONS[char.role]}
                      </div>
                    )}
                  </div>
                  <span className="text-xs">{char.name}</span>
                  {char.isPlayer && playerMode && (
                    <span className="text-[10px] text-pink-400">{char.role}</span>
                  )}
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
                      : log.speaker === '我'
                      ? 'bg-pink-500/20 border border-pink-500/30'
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

          {/* Player Input */}
          {waitingForPlayer && playerAction === 'day' && (
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <Input
                  value={playerInput}
                  onChange={(e) => setPlayerInput(e.target.value)}
                  placeholder="输入你的发言..."
                  className="flex-1 bg-white/10 border-white/20 text-white"
                  onKeyDown={(e) => e.key === 'Enter' && handlePlayerDaySpeech()}
                />
                <Button
                  onClick={handlePlayerDaySpeech}
                  disabled={!playerInput.trim()}
                  className="bg-gradient-to-r from-candy-purple to-candy-pink"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!waitingForPlayer && (
            <div className="p-4 border-t border-white/10">
              <Button
                onClick={handleNextPhase}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                    开始讨论
                  </>
                ) : (
                  <>
                    <Vote className="w-5 h-5 mr-2" />
                    开始投票
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* End Phase */}
      {gamePhase === 'end' && (
        <div className="p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mb-8"
          >
            <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center text-5xl ${
              winner === 'good' ? 'bg-green-500/30' : 'bg-red-500/30'
            }`}>
              {winner === 'good' ? '🎉' : '🐺'}
            </div>
            <h2 className="text-2xl font-bold mt-4">
              {winner === 'good' ? '好人阵营胜利！' : '狼人阵营胜利！'}
            </h2>
            {playerMode && (
              <p className="text-white/60 mt-2">
                {getPlayerCharacter()?.role === '狼人' 
                  ? winner === 'evil' ? '恭喜你，作为狼人获得了胜利！' : '很遗憾，你作为狼人被识破了'
                  : winner === 'good' ? '恭喜你，成功找出了狼人！' : '很遗憾，狼人逃脱了'
                }
              </p>
            )}
          </motion.div>

          <div className="bg-white/10 rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-3">角色揭晓</h3>
            <div className="grid grid-cols-2 gap-2">
              {gameCharacters.map(char => (
                <div key={char.id} className={`flex items-center gap-2 p-2 rounded-lg ${ROLE_COLORS[char.role]}/30`}>
                  <div className={`w-6 h-6 rounded-full ${ROLE_COLORS[char.role]} flex items-center justify-center`}>
                    {ROLE_ICONS[char.role]}
                  </div>
                  <span className="text-sm font-medium">{char.name}</span>
                  <span className="text-xs text-white/60">{char.role}</span>
                  {char.isPlayer && <span className="text-xs text-pink-400">(你)</span>}
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={() => setGamePhase('setup')}
            className="bg-gradient-to-r from-purple-500 to-pink-500"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            再来一局
          </Button>
        </div>
      )}

      {/* Target Selection Dialog */}
      {renderTargetSelection()}
    </div>
  );
};

export default WerewolfPage;