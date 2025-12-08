import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Lightbulb, RotateCcw, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Riddle {
  index: number;
  question: string;
  hint: string;
}

const RiddlePage: React.FC = () => {
  const navigate = useNavigate();
  const [riddle, setRiddle] = useState<Riddle | null>(null);
  const [answer, setAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; message: string; answer?: string } | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetchRiddle();
  }, []);

  const fetchRiddle = async () => {
    setLoading(true);
    setResult(null);
    setAnswer('');
    setShowHint(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('riddle-game', {
        body: { action: 'get_riddle' }
      });

      if (error) throw error;
      if (data.success) {
        setRiddle(data.riddle);
      }
    } catch (err) {
      console.error(err);
      toast.error('获取谜题失败');
    } finally {
      setLoading(false);
    }
  };

  const checkAnswer = async () => {
    if (!answer.trim() || !riddle) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('riddle-game', {
        body: { 
          action: 'check_answer',
          riddleIndex: riddle.index,
          userAnswer: answer
        }
      });

      if (error) throw error;
      
      setResult({
        correct: data.correct,
        message: data.message,
        answer: data.answer
      });

      if (data.correct) {
        setScore(prev => prev + 10 + streak * 5);
        setStreak(prev => prev + 1);
        toast.success('答对了！+' + (10 + streak * 5) + '分');
      } else {
        setStreak(0);
      }
    } catch (err) {
      console.error(err);
      toast.error('检查答案失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/games')}
          className="rounded-full bg-white/60 backdrop-blur-sm shadow-sm"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-amber-800">🧩 猜谜语</h1>
        <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="font-bold text-amber-700">{score}</span>
        </div>
      </div>

      {/* Streak indicator */}
      {streak > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-4"
        >
          <span className="bg-gradient-to-r from-orange-400 to-rose-400 text-white px-4 py-1 rounded-full text-sm font-medium">
            🔥 连对 {streak} 题！
          </span>
        </motion.div>
      )}

      {/* Riddle Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={riddle?.index}
          initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.9, rotateY: 10 }}
          className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/50 mb-6"
        >
          <div className="text-center mb-6">
            <span className="text-6xl mb-4 block">🤔</span>
            <h2 className="text-xl font-bold text-gray-800 leading-relaxed">
              {loading && !riddle ? '正在出题...' : riddle?.question}
            </h2>
          </div>

          {/* Hint */}
          {showHint && riddle && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-amber-50 rounded-2xl p-4 mb-4 border border-amber-200"
            >
              <div className="flex items-center gap-2 text-amber-700">
                <Lightbulb className="w-5 h-5" />
                <span className="font-medium">提示：{riddle.hint}</span>
              </div>
            </motion.div>
          )}

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`rounded-2xl p-4 mb-4 text-center ${
                  result.correct 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <p className={`font-bold text-lg ${result.correct ? 'text-green-600' : 'text-red-600'}`}>
                  {result.message}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Answer Input */}
          {!result && (
            <div className="flex gap-2">
              <Input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="输入你的答案..."
                onKeyPress={(e) => e.key === 'Enter' && checkAnswer()}
                className="flex-1 rounded-xl bg-gray-50 border-gray-200 text-lg py-6"
              />
              <Button
                onClick={checkAnswer}
                disabled={loading || !answer.trim()}
                className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white px-6 shadow-lg"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!result && !showHint && (
          <Button
            variant="outline"
            onClick={() => setShowHint(true)}
            className="flex-1 rounded-xl py-6 bg-white/60 border-amber-200 text-amber-700"
          >
            <Lightbulb className="w-5 h-5 mr-2" />
            看提示
          </Button>
        )}
        <Button
          onClick={fetchRiddle}
          disabled={loading}
          className={`rounded-xl py-6 bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-lg ${
            result ? 'flex-1' : 'flex-1'
          }`}
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          {result ? '下一题' : '换一题'}
        </Button>
      </div>

      {/* Fun decorations */}
      <div className="fixed bottom-20 left-4 text-4xl opacity-20">🎯</div>
      <div className="fixed bottom-32 right-4 text-3xl opacity-20">💡</div>
      <div className="fixed top-40 right-6 text-2xl opacity-15">✨</div>
    </div>
  );
};

export default RiddlePage;
