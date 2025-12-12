import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Clock, Star, Play, MessageCircle, Vote, Eye, RotateCcw, Shuffle, Settings, User, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAPIConfig } from '@/hooks/useAPIConfig';
import { toast } from 'sonner';
import { SCRIPTS, Script, ScriptRole } from '@/data/scripts';
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

interface GamePlayer {
  character: Character;
  role: ScriptRole;
  isPlayer: boolean; // 是否是用户玩家
}

interface GameLog {
  id: string;
  speaker: string;
  content: string;
  phase: string;
  avatar?: string;
}

interface SelectedCharacterForRole {
  role: ScriptRole;
  character: Character | null; // null 表示用户自己扮演
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
  
  // 用户参与模式
  const [playerMode, setPlayerMode] = useState(false);
  const [playerInput, setPlayerInput] = useState('');
  const [waitingForPlayer, setWaitingForPlayer] = useState(false);
  const [playerAction, setPlayerAction] = useState<'intro' | 'discuss' | 'vote' | 'reveal' | null>(null);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ScriptRole | null>(null);
  const [userProfile, setUserProfile] = useState<{ avatar_url: string | null } | null>(null);
  
  // 新增：角色分配设置
  const [characterAssignments, setCharacterAssignments] = useState<SelectedCharacterForRole[]>([]);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [pickingForRole, setPickingForRole] = useState<ScriptRole | null>(null);

  useEffect(() => {
    if (user) {
      fetchCharacters();
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', user!.id)
      .maybeSingle();
    if (data) setUserProfile(data);
  };

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
    initializeAssignments(script);
    setGamePhase('assign');
  };

  const getPlayerGamePlayer = (): GamePlayer | undefined => {
    return players.find(p => p.isPlayer);
  };

  const assignRoles = (withPlayer: boolean, chosenRole?: ScriptRole) => {
    if (!selectedScript) return;
    
    setPlayerMode(withPlayer);
    const roleCount = selectedScript.roles.length;
    const requiredAI = withPlayer ? roleCount - 1 : roleCount;
    
    if (characters.length < requiredAI) {
      toast.error(`需要至少${requiredAI}个AI角色才能玩这个剧本`);
      return;
    }

    const shuffledCharacters = shuffleArray(characters).slice(0, requiredAI);
    let availableRoles = [...selectedScript.roles];
    
    let gamePlayers: GamePlayer[] = [];

    if (withPlayer && chosenRole) {
      // 移除玩家选择的角色
      availableRoles = availableRoles.filter(r => r.id !== chosenRole.id);
      
      // 添加玩家
      const playerGamePlayer: GamePlayer = {
        character: {
          id: 'player',
          name: '我',
          persona: '玩家',
          avatar_url: userProfile?.avatar_url || null,
        },
        role: chosenRole,
        isPlayer: true,
      };
      gamePlayers.push(playerGamePlayer);
    }

    // 分配AI角色
    const shuffledRoles = shuffleArray(availableRoles);
    shuffledCharacters.forEach((char, index) => {
      gamePlayers.push({
        character: char,
        role: shuffledRoles[index],
        isPlayer: false,
      });
    });

    // 打乱顺序
    gamePlayers = shuffleArray(gamePlayers);

    setPlayers(gamePlayers);
    setLogs([]);
    setVotes({});
    setDiscussionRound(1);
    
    addLog('系统', `剧本《${selectedScript.title}》开始！`, 'system');
    addLog('系统', selectedScript.story, 'story');
    
    if (withPlayer && chosenRole) {
      addLog('系统', `你扮演的角色是：${chosenRole.name}`, 'system');
      addLog('系统', `角色背景：${chosenRole.background}`, 'system');
      addLog('系统', `你的秘密：${chosenRole.secret}`, 'secret');
      if (chosenRole.isMurderer) {
        addLog('系统', '⚠️ 你是凶手！需要隐藏自己的身份，转移其他人的注意力。', 'secret');
      }
    }
    
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
          userId: user?.id,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'AI连接失败');
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      return data.reply || '...';
    } catch (error) {
      console.error('AI response error:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`AI响应失败: ${errorMessage}`);
      return '...（连接失败，请重试）';
    }
  };

  // 初始化角色分配
  const initializeAssignments = (script: Script) => {
    const assignments = script.roles.map(role => ({
      role,
      character: null as Character | null
    }));
    setCharacterAssignments(assignments);
  };

  // 选择好友角色扮演某个剧本角色
  const assignCharacterToRole = (role: ScriptRole, character: Character | 'player' | null) => {
    setCharacterAssignments(prev => prev.map(a => {
      if (a.role.id === role.id) {
        return { ...a, character: character === 'player' ? null : character };
      }
      // 如果该角色已被分配给其他人，需要移除
      if (character !== 'player' && character !== null && a.character?.id === character.id) {
        return { ...a, character: null };
      }
      return a;
    }));
    setShowCharacterPicker(false);
    setPickingForRole(null);
  };

  // 开始带有自定义分配的游戏
  const startCustomGame = () => {
    if (!selectedScript) return;
    
    const playerAssignment = characterAssignments.find(a => a.character === null);
    const aiAssignments = characterAssignments.filter(a => a.character !== null);
    
    // 检查是否有未分配的角色
    const unassignedAIRoles = characterAssignments.filter(a => a.character === null && (!playerAssignment || a.role.id !== playerAssignment.role.id));
    
    if (unassignedAIRoles.length > 0) {
      toast.error('请为所有角色分配好友');
      return;
    }
    
    let gamePlayers: GamePlayer[] = [];
    
    // 添加玩家
    if (playerAssignment) {
      gamePlayers.push({
        character: {
          id: 'player',
          name: '我',
          persona: '玩家',
          avatar_url: userProfile?.avatar_url || null,
        },
        role: playerAssignment.role,
        isPlayer: true,
      });
    }
    
    // 添加AI角色
    aiAssignments.forEach(a => {
      if (a.character) {
        gamePlayers.push({
          character: a.character,
          role: a.role,
          isPlayer: false,
        });
      }
    });
    
    setPlayerMode(!!playerAssignment);
    setPlayers(shuffleArray(gamePlayers));
    setLogs([]);
    setVotes({});
    setDiscussionRound(1);
    
    addLog('系统', `剧本《${selectedScript.title}》开始！`, 'system');
    addLog('系统', selectedScript.story, 'story');
    
    if (playerAssignment) {
      addLog('系统', `你扮演的角色是：${playerAssignment.role.name}`, 'system');
      addLog('系统', `角色背景：${playerAssignment.role.background}`, 'system');
      addLog('系统', `你的秘密：${playerAssignment.role.secret}`, 'secret');
      if (playerAssignment.role.isMurderer) {
        addLog('系统', '⚠️ 你是凶手！需要隐藏自己的身份，转移其他人的注意力。', 'secret');
      }
    }
    
    setGamePhase('intro');
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handlePlayerIntro = () => {
    if (!playerInput.trim()) return;
    
    const player = getPlayerGamePlayer();
    addLog(player?.role.name || '我', playerInput, 'intro');
    setPlayerInput('');
    setWaitingForPlayer(false);
    setPlayerAction(null);
    
    continueIntroAfterPlayer();
  };

  const handlePlayerDiscuss = () => {
    if (!playerInput.trim()) return;
    
    const player = getPlayerGamePlayer();
    addLog(player?.role.name || '我', playerInput, 'discuss');
    setPlayerInput('');
    setWaitingForPlayer(false);
    setPlayerAction(null);
    
    continueDiscussAfterPlayer();
  };

  const handlePlayerVote = (targetName: string) => {
    setShowVoteDialog(false);
    const player = getPlayerGamePlayer();
    addLog(player?.role.name || '我', `我投票给[${targetName}]，因为我认为他最可疑`, 'vote');
    setWaitingForPlayer(false);
    setPlayerAction(null);
    
    continueVoteAfterPlayer(targetName);
  };

  const handlePlayerReveal = () => {
    if (!playerInput.trim()) return;
    
    const player = getPlayerGamePlayer();
    const roleTag = player?.role.isMurderer ? '【凶手】' : '【好人】';
    addLog(`${roleTag} ${player?.role.name || '我'}`, playerInput, 'reveal');
    setPlayerInput('');
    setWaitingForPlayer(false);
    setPlayerAction(null);
    
    continueRevealAfterPlayer();
  };

  const processIntroductions = async () => {
    setIsProcessing(true);
    addLog('系统', '现在开始自我介绍环节...', 'system');

    for (const player of players) {
      if (player.isPlayer) {
        setWaitingForPlayer(true);
        setPlayerAction('intro');
        setIsProcessing(false);
        return;
      }
      
      const response = await getAIResponse('introduce', player);
      addLog(player.role.name, response, 'intro', player.character.avatar_url || undefined);
      await delay(2000);
    }

    addLog('系统', '自我介绍结束，接下来是讨论环节。', 'system');
    addLog('系统', `线索提示：${selectedScript?.clues.join('；')}`, 'clue');
    setGamePhase('discuss');
    setIsProcessing(false);
  };

  const continueIntroAfterPlayer = async () => {
    setIsProcessing(true);
    const playerIndex = players.findIndex(p => p.isPlayer);

    for (let i = playerIndex + 1; i < players.length; i++) {
      const player = players[i];
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
      if (player.isPlayer) {
        setWaitingForPlayer(true);
        setPlayerAction('discuss');
        setIsProcessing(false);
        return;
      }
      
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

  const continueDiscussAfterPlayer = async () => {
    setIsProcessing(true);
    const playerIndex = players.findIndex(p => p.isPlayer);

    for (let i = playerIndex + 1; i < players.length; i++) {
      const player = players[i];
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

    for (const player of players) {
      if (player.isPlayer) {
        setWaitingForPlayer(true);
        setPlayerAction('vote');
        setShowVoteDialog(true);
        setIsProcessing(false);
        return;
      }
      
      const response = await getAIResponse('vote', player);
      addLog(player.role.name, response, 'vote', player.character.avatar_url || undefined);
      await delay(1500);
    }

    finishVoting();
  };

  const continueVoteAfterPlayer = async (playerVote: string) => {
    setIsProcessing(true);
    const playerIndex = players.findIndex(p => p.isPlayer);
    const voteResults: Record<string, string> = {};
    
    // 记录玩家的投票
    const playerGamePlayer = getPlayerGamePlayer();
    if (playerGamePlayer) {
      voteResults[playerGamePlayer.role.name] = playerVote;
    }

    for (let i = playerIndex + 1; i < players.length; i++) {
      const player = players[i];
      const response = await getAIResponse('vote', player);
      addLog(player.role.name, response, 'vote', player.character.avatar_url || undefined);
      
      const match = response.match(/投票给\[?([^\]，,]+)/);
      if (match) {
        voteResults[player.role.name] = match[1].trim();
      }
      await delay(1500);
    }

    // 统计之前的AI投票
    for (let i = 0; i < playerIndex; i++) {
      const player = players[i];
      const voteLogs = logs.filter(l => l.phase === 'vote' && l.speaker === player.role.name);
      if (voteLogs.length > 0) {
        const match = voteLogs[0].content.match(/投票给\[?([^\]，,]+)/);
        if (match) {
          voteResults[player.role.name] = match[1].trim();
        }
      }
    }

    finishVotingWithResults(voteResults);
  };

  const finishVoting = () => {
    const voteResults: Record<string, string> = {};
    const voteLogs = logs.filter(l => l.phase === 'vote' && l.speaker !== '系统');
    
    voteLogs.forEach(log => {
      const match = log.content.match(/投票给\[?([^\]，,]+)/);
      if (match) {
        voteResults[log.speaker] = match[1].trim();
      }
    });

    finishVotingWithResults(voteResults);
  };

  const finishVotingWithResults = (voteResults: Record<string, string>) => {
    setVotes(voteResults);
    
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
    const playerGamePlayer = getPlayerGamePlayer();

    addLog('系统', `投票结果：${Object.entries(voteCounts).map(([n, c]) => `${n}(${c}票)`).join('、')}`, 'system');
    
    if (suspectedPlayer?.role.isMurderer) {
      addLog('系统', `🎉 恭喜！大家成功找出了凶手 ${suspected}！`, 'result');
      if (playerGamePlayer?.role.isMurderer) {
        addLog('系统', '😱 你作为凶手被识破了！', 'result');
      }
    } else {
      addLog('系统', `😱 很遗憾，${suspected}不是凶手。真正的凶手是 ${murderer?.role.name}！`, 'result');
      if (playerGamePlayer?.role.isMurderer) {
        addLog('系统', '🎉 恭喜你成功隐藏身份，逃脱了！', 'result');
      }
    }

    setGamePhase('reveal');
    setIsProcessing(false);
  };

  const processReveal = async () => {
    setIsProcessing(true);
    addLog('系统', '现在揭晓所有人的真实身份...', 'system');

    for (const player of players) {
      if (player.isPlayer) {
        setWaitingForPlayer(true);
        setPlayerAction('reveal');
        setIsProcessing(false);
        return;
      }
      
      const response = await getAIResponse('reveal', player);
      const roleTag = player.role.isMurderer ? '【凶手】' : '【好人】';
      addLog(`${roleTag} ${player.role.name}`, response, 'reveal', player.character.avatar_url || undefined);
      await delay(1500);
    }

    setIsProcessing(false);
  };

  const continueRevealAfterPlayer = async () => {
    setIsProcessing(true);
    const playerIndex = players.findIndex(p => p.isPlayer);

    for (let i = playerIndex + 1; i < players.length; i++) {
      const player = players[i];
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
    setPlayerMode(false);
    setSelectedRole(null);
  };

  const renderRoleSelection = () => {
    if (!selectedScript) return null;

    return (
      <AlertDialog open={!!selectedRole} onOpenChange={() => setSelectedRole(null)}>
        <AlertDialogContent className="bg-slate-900 border-white/10 max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">确认角色</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              你选择扮演：{selectedRole?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedRole && (
            <div className="space-y-3 my-4 text-sm">
              <div className="bg-white/5 p-3 rounded-lg">
                <div className="text-white/50 mb-1">职业</div>
                <div className="text-white">{selectedRole.occupation} · {selectedRole.age}</div>
              </div>
              <div className="bg-white/5 p-3 rounded-lg">
                <div className="text-white/50 mb-1">背景</div>
                <div className="text-white">{selectedRole.background}</div>
              </div>
              <div className="bg-amber-500/20 p-3 rounded-lg border border-amber-500/30">
                <div className="text-amber-400 mb-1">你的秘密</div>
                <div className="text-white">{selectedRole.secret}</div>
              </div>
              {selectedRole.isMurderer && (
                <div className="bg-red-500/20 p-3 rounded-lg border border-red-500/30">
                  <div className="text-red-400">⚠️ 你是凶手！需要隐藏身份。</div>
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white border-white/20">
              重新选择
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedRole && assignRoles(true, selectedRole)}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              确认开始
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  const renderVoteDialog = () => {
    return (
      <AlertDialog open={showVoteDialog} onOpenChange={setShowVoteDialog}>
        <AlertDialogContent className="bg-slate-900 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">投票环节</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              请选择你认为是凶手的角色
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2 my-4">
            {players.filter(p => !p.isPlayer).map(player => (
              <Button
                key={player.role.id}
                onClick={() => handlePlayerVote(player.role.name)}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                {player.role.name}
              </Button>
            ))}
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/50 backdrop-blur-lg p-4 flex items-center gap-4">
        <button onClick={() => gamePhase === 'select' ? navigate(-1) : resetGame()} className="p-2 rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">剧本杀</h1>
        {playerMode && (
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">玩家模式</span>
        )}
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

          {/* 快速开始按钮 */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              whileHover={{ scale: 1.02 }}
              onClick={() => characters.length >= selectedScript.roles.length && assignRoles(false)}
              className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${
                characters.length >= selectedScript.roles.length 
                  ? 'bg-white/10 border-white/20 hover:border-purple-500' 
                  : 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
              }`}
            >
              <Eye className="w-8 h-8 mb-2 text-purple-400" />
              <h3 className="font-bold mb-1">快速观战</h3>
              <p className="text-xs text-white/60">随机分配角色</p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              onClick={() => {
                if (characterAssignments.every(a => a.character !== null || characterAssignments.find(x => x.character === null))) {
                  startCustomGame();
                }
              }}
              className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${
                characterAssignments.filter(a => a.character !== null).length >= selectedScript.roles.length - 1
                  ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/50 hover:border-purple-400' 
                  : 'bg-white/5 border-white/10 opacity-50'
              }`}
            >
              <Play className="w-8 h-8 mb-2 text-pink-400" />
              <h3 className="font-bold mb-1">开始游戏</h3>
              <p className="text-xs text-white/60">使用下方分配</p>
            </motion.div>
          </div>

          {/* 角色分配区域 */}
          <div className="bg-white/10 rounded-xl p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              为每个角色选择扮演者
            </h3>
            <p className="text-xs text-white/50 mb-4">点击"我来扮演"参与游戏，或选择好友角色由AI扮演</p>
            
            <div className="space-y-3">
              {characterAssignments.map(assignment => {
                const isPlayerRole = assignment.character === null && characterAssignments.filter(a => a.character === null).length === 1;
                const assignedChar = assignment.character;
                
                return (
                  <div 
                    key={assignment.role.id} 
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
                  >
                    {/* 剧本角色信息 */}
                    <div className="w-10 h-10 rounded-full bg-purple-500/30 flex items-center justify-center text-lg flex-shrink-0">
                      {assignment.role.gender === 'male' ? '👨' : assignment.role.gender === 'female' ? '👩' : '🧑'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{assignment.role.name}</div>
                      <div className="text-xs text-white/50 truncate">{assignment.role.occupation}</div>
                    </div>
                    
                    {/* 扮演者选择 */}
                    <div className="flex items-center gap-2">
                      {isPlayerRole ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-pink-500/20 rounded-full border border-pink-500/50">
                          <User className="w-4 h-4 text-pink-400" />
                          <span className="text-sm text-pink-300">我来扮演</span>
                        </div>
                      ) : assignedChar ? (
                        <div 
                          onClick={() => { setPickingForRole(assignment.role); setShowCharacterPicker(true); }}
                          className="flex items-center gap-2 px-2 py-1 bg-white/10 rounded-full cursor-pointer hover:bg-white/20"
                        >
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-candy-pink to-candy-purple">
                            {assignedChar.avatar_url ? (
                              <img src={assignedChar.avatar_url} alt={assignedChar.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs">👤</div>
                            )}
                          </div>
                          <span className="text-sm">{assignedChar.name}</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setPickingForRole(assignment.role); setShowCharacterPicker(true); }}
                          className="border-white/20 text-white/70 hover:bg-white/10"
                        >
                          选择好友
                        </Button>
                      )}
                      
                      {/* 我来扮演按钮 */}
                      {!isPlayerRole && (
                        <Button
                          size="sm"
                          variant={assignment.character === null ? "default" : "ghost"}
                          onClick={() => {
                            // 先清除其他角色的"我来扮演"状态
                            setCharacterAssignments(prev => prev.map(a => {
                              if (a.role.id === assignment.role.id) {
                                return { ...a, character: null };
                              }
                              // 如果其他角色被设为玩家扮演，需要重新分配
                              if (a.character === null) {
                                const availableChar = characters.find(c => 
                                  !prev.some(p => p.character?.id === c.id && p.role.id !== assignment.role.id)
                                );
                                return { ...a, character: availableChar || null };
                              }
                              return a;
                            }));
                          }}
                          className="text-xs px-2"
                        >
                          <User className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 可用好友列表 */}
          <div className="bg-white/10 rounded-xl p-4">
            <h3 className="font-semibold mb-3">可用好友角色 ({characters.length}人)</h3>
            <div className="flex flex-wrap gap-2">
              {characters.map(char => {
                const isAssigned = characterAssignments.some(a => a.character?.id === char.id);
                return (
                  <div 
                    key={char.id} 
                    className={`flex items-center gap-2 p-2 rounded-lg transition-opacity ${
                      isAssigned ? 'bg-green-500/20 opacity-60' : 'bg-white/5'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-candy-pink to-candy-purple overflow-hidden">
                      {char.avatar_url ? (
                        <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">👤</div>
                      )}
                    </div>
                    <span className="text-sm">{char.name}</span>
                    {isAssigned && <span className="text-xs text-green-400">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {characters.length < selectedScript.roles.length - 1 && (
            <p className="text-center text-red-400 text-sm">
              需要至少{selectedScript.roles.length - 1}个好友角色，当前只有{characters.length}个
            </p>
          )}
        </div>
      )}

      {/* 好友选择对话框 */}
      <AlertDialog open={showCharacterPicker} onOpenChange={setShowCharacterPicker}>
        <AlertDialogContent className="bg-slate-900 border-white/10 max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              为"{pickingForRole?.name}"选择扮演者
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              选择一个好友角色来扮演这个剧本角色
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-3 my-4">
            {characters.map(char => {
              const isAssigned = characterAssignments.some(a => a.character?.id === char.id && a.role.id !== pickingForRole?.id);
              return (
                <Button
                  key={char.id}
                  onClick={() => pickingForRole && assignCharacterToRole(pickingForRole, char)}
                  disabled={isAssigned}
                  variant="outline"
                  className={`h-auto flex items-center gap-2 p-3 ${
                    isAssigned ? 'opacity-40' : 'border-white/20 text-white hover:bg-white/10'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-candy-pink to-candy-purple flex-shrink-0">
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">👤</div>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{char.name}</div>
                    <div className="text-xs text-white/50 truncate max-w-[80px]">{char.persona || '普通人'}</div>
                  </div>
                </Button>
              );
            })}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white border-white/20">
              取消
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Game Phase */}
      {(gamePhase === 'intro' || gamePhase === 'discuss' || gamePhase === 'vote' || gamePhase === 'reveal') && (
        <div className="flex flex-col h-[calc(100vh-64px)]">
          {/* Players */}
          <div className="p-4 border-b border-white/10">
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {players.map((player) => (
                <div key={player.role.id} className="flex flex-col items-center gap-1 min-w-[60px]">
                  <div className={`w-12 h-12 rounded-full bg-white/20 overflow-hidden ${
                    player.isPlayer ? 'ring-2 ring-pink-500' : ''
                  }`}>
                    {player.isPlayer ? (
                      <div className="w-full h-full flex items-center justify-center bg-pink-500/30">
                        <User className="w-6 h-6 text-pink-400" />
                      </div>
                    ) : player.character.avatar_url ? (
                      <img src={player.character.avatar_url} alt={player.role.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">👤</div>
                    )}
                  </div>
                  <span className="text-xs font-medium">{player.role.name}</span>
                  {player.isPlayer ? (
                    <span className="text-[10px] text-pink-400">(你)</span>
                  ) : (
                    <span className="text-[10px] text-white/50">{player.character.name}</span>
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
                    log.phase === 'system' || log.phase === 'result'
                      ? 'bg-purple-500/20 text-center text-sm'
                      : log.phase === 'story'
                      ? 'bg-amber-500/20 border border-amber-500/30'
                      : log.phase === 'clue'
                      ? 'bg-blue-500/20 border border-blue-500/30 text-sm'
                      : log.phase === 'secret'
                      ? 'bg-red-500/20 border border-red-500/30 text-sm'
                      : log.speaker.includes('我') || players.find(p => p.isPlayer && p.role.name === log.speaker.replace(/【.*】\s*/, ''))
                      ? 'bg-pink-500/20 border border-pink-500/30'
                      : 'bg-white/10'
                  }`}
                >
                  {log.phase !== 'system' && log.phase !== 'story' && log.phase !== 'clue' && log.phase !== 'result' && log.phase !== 'secret' && (
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

          {/* Player Input */}
          {waitingForPlayer && (playerAction === 'intro' || playerAction === 'discuss' || playerAction === 'reveal') && (
            <div className="p-4 border-t border-white/10">
              <div className="text-sm text-white/60 mb-2">
                {playerAction === 'intro' && '请输入你的自我介绍（不要透露秘密）：'}
                {playerAction === 'discuss' && '请发表你的看法或质疑他人：'}
                {playerAction === 'reveal' && '游戏结束，请揭示你的真实身份和秘密：'}
              </div>
              <div className="flex gap-2">
                <Input
                  value={playerInput}
                  onChange={(e) => setPlayerInput(e.target.value)}
                  placeholder="输入你的发言..."
                  className="flex-1 bg-white/10 border-white/20 text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (playerAction === 'intro') handlePlayerIntro();
                      else if (playerAction === 'discuss') handlePlayerDiscuss();
                      else if (playerAction === 'reveal') handlePlayerReveal();
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (playerAction === 'intro') handlePlayerIntro();
                    else if (playerAction === 'discuss') handlePlayerDiscuss();
                    else if (playerAction === 'reveal') handlePlayerReveal();
                  }}
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
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    处理中...
                  </div>
                ) : gamePhase === 'reveal' && logs.some(l => l.phase === 'reveal') ? (
                  <>
                    <RotateCcw className="w-5 h-5 mr-2" />
                    再来一局
                  </>
                ) : gamePhase === 'intro' ? (
                  <>
                    <MessageCircle className="w-5 h-5 mr-2" />
                    开始自我介绍
                  </>
                ) : gamePhase === 'discuss' ? (
                  <>
                    <MessageCircle className="w-5 h-5 mr-2" />
                    {discussionRound === 1 ? '开始讨论' : '继续讨论'}
                  </>
                ) : gamePhase === 'vote' ? (
                  <>
                    <Vote className="w-5 h-5 mr-2" />
                    开始投票
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5 mr-2" />
                    揭晓身份
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Role Selection Dialog */}
      {renderRoleSelection()}

      {/* Vote Dialog */}
      {renderVoteDialog()}
    </div>
  );
};

export default ScriptMurderPage;