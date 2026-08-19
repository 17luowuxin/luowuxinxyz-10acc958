import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Wallet, TrendingUp, History, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { deleteLocalRows, getLocalTable, isLocalModeEnabled, updateLocalRows } from '@/lib/localDataStore';

interface Transaction {
  id: string;
  character_name: string;
  amount: number;
  message: string | null;
  is_received: boolean;
  created_at: string;
}

const FinancePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [showDeleteMode, setShowDeleteMode] = useState(false);
  const [deleteClickCount, setDeleteClickCount] = useState(0);
  const [localMode, setLocalMode] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setLocalMode(false);
      return;
    }
    isLocalModeEnabled(user.id).then(setLocalMode);
  }, [user]);

  useEffect(() => {
    if (user && localMode !== null) {
      fetchTransactions();
    }
  }, [user, localMode]);

  const fetchTransactions = async () => {
    if (!user) return;
    const result = localMode
      ? {
          data: (await getLocalTable(user.id, 'dream_transactions'))
            .filter((row) => row.user_id === user.id)
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
          error: null,
        }
      : await supabase
          .from('dream_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
    const { data, error } = result;

    if (!error && data) {
      const typedData = data as Transaction[];
      setTransactions(typedData);
      
      // Calculate totals
      const received = typedData.filter(t => t.is_received);
      const balance = received.reduce((sum, t) => sum + Number(t.amount), 0);
      const total = typedData.reduce((sum, t) => sum + Number(t.amount), 0);
      
      setTotalBalance(balance);
      setTotalReceived(total);
    }
    setLoading(false);
  };

  const handleReceive = async (transactionId: string) => {
    if (!user) return;
    const error = localMode
      ? (await updateLocalRows(user.id, 'dream_transactions', (row) => row.id === transactionId, { is_received: true }), null)
      : (await supabase.from('dream_transactions').update({ is_received: true }).eq('id', transactionId)).error;

    if (!error) {
      fetchTransactions();
    }
  };

  // 隐藏的删除模式触发 - 连续点击余额5次
  const handleBalanceClick = () => {
    const newCount = deleteClickCount + 1;
    setDeleteClickCount(newCount);
    if (newCount >= 5) {
      setShowDeleteMode(!showDeleteMode);
      setDeleteClickCount(0);
      toast.info(showDeleteMode ? '已退出管理模式' : '已进入管理模式');
    }
    // 2秒后重置计数
    setTimeout(() => setDeleteClickCount(0), 2000);
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!user) return;
    const error = localMode
      ? (await deleteLocalRows(user.id, 'dream_transactions', (row) => row.id === transactionId), null)
      : (await supabase.from('dream_transactions').delete().eq('id', transactionId)).error;

    if (!error) {
      toast.success('已删除');
      fetchTransactions();
    } else {
      toast.error('删除失败');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('确定要清空所有转账记录吗？此操作不可撤销！')) return;
    
    if (!user) return;
    const error = localMode
      ? (await deleteLocalRows(user.id, 'dream_transactions', (row) => row.user_id === user.id), null)
      : (await supabase.from('dream_transactions').delete().eq('user_id', user.id)).error;

    if (!error) {
      toast.success('已清空所有记录');
      fetchTransactions();
    } else {
      toast.error('清空失败');
    }
  };

  return (
    <div className="min-h-screen bg-background/70 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/home')}
          className="rounded-full"
        >
          <ChevronLeft className="w-6 h-6 text-purple-600" />
        </Button>
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-purple-500" />
          <h1 className="text-lg font-bold text-purple-700">梦境财务</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-3xl p-5 text-white shadow-lg cursor-pointer select-none"
          onClick={handleBalanceClick}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-white/90 text-sm">梦境余额</span>
            </div>
            {showDeleteMode && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); handleClearAll(); }}
                className="text-white/80 hover:text-white hover:bg-white/20 text-xs"
              >
                清空全部
              </Button>
            )}
          </div>
          <p className="text-4xl font-bold">¥{totalBalance.toFixed(2)}</p>
          <div className="mt-4 pt-4 border-t border-white/20 flex justify-between text-sm">
            <div>
              <p className="text-white/70">累计收到</p>
              <p className="font-semibold">¥{totalReceived.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-white/70">转账次数</p>
              <p className="font-semibold">{transactions.length} 笔</p>
            </div>
          </div>
        </motion.div>

        {/* Pending Transfers */}
        {transactions.filter(t => !t.is_received).length > 0 && (
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 shadow-lg border border-orange-100/50">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <h2 className="font-bold text-gray-800">待收款</h2>
            </div>
            <div className="space-y-2">
              {transactions.filter(t => !t.is_received).map((tx) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between bg-orange-50 rounded-xl p-3"
                >
                  <div>
                    <p className="font-medium text-gray-800">{tx.character_name}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(tx.created_at), 'MM-dd HH:mm')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-orange-500">¥{Number(tx.amount).toFixed(2)}</span>
                    <Button
                      size="sm"
                      onClick={() => handleReceive(tx.id)}
                      className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-4"
                    >
                      收款
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 shadow-lg border border-purple-100/50">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-purple-500" />
            <h2 className="font-bold text-gray-800">转账记录</h2>
          </div>
          
          {loading ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">暂无转账记录</p>
              <p className="text-gray-300 text-xs mt-1">与角色聊天时可能会收到转账哦~</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {transactions.map((tx, index) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between bg-white/50 rounded-xl p-3"
                >
                  <div className="flex items-center gap-3">
                    {showDeleteMode && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteTransaction(tx.id)}
                        className="w-6 h-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
                      <span className="text-white text-sm">💰</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{tx.character_name}</p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm')}
                      </p>
                      {tx.message && (
                        <p className="text-xs text-gray-500 mt-0.5">{tx.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-500">+¥{Number(tx.amount).toFixed(2)}</p>
                    <p className={`text-xs ${tx.is_received ? 'text-green-500' : 'text-gray-400'}`}>
                      {tx.is_received ? '已收款' : '待收款'}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancePage;
