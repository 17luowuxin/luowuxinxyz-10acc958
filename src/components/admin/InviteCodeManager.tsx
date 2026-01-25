import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Ticket, Plus, Copy, Trash2, Check, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface InviteCode {
  id: string;
  code: string;
  is_used: boolean;
  used_by_email: string | null;
  used_at: string | null;
  note: string | null;
  created_at: string;
}

// 生成8位随机邀请码，排除容易混淆的字符
const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const InviteCodeManager: React.FC = () => {
  const { user } = useAuth();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [batchCount, setBatchCount] = useState('10');
  const [note, setNote] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCodes((data || []) as InviteCode[]);
    } catch (error) {
      console.error('Error fetching codes:', error);
      toast.error('获取邀请码列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchGenerate = async () => {
    if (!user) return;
    
    const count = parseInt(batchCount) || 10;
    if (count < 1 || count > 100) {
      toast.error('批量生成数量需在1-100之间');
      return;
    }

    setGenerating(true);
    try {
      const newCodes = [];
      for (let i = 0; i < count; i++) {
        newCodes.push({
          code: generateCode(),
          created_by: user.id,
          note: note.trim() || null
        });
      }

      const { error } = await supabase
        .from('invite_codes')
        .insert(newCodes);
      
      if (error) throw error;
      
      toast.success(`成功生成 ${count} 个邀请码`);
      setNote('');
      fetchCodes();
    } catch (error: any) {
      console.error('Error generating codes:', error);
      if (error.code === '23505') {
        toast.error('邀请码重复，请重试');
      } else {
        toast.error('生成邀请码失败');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  const handleCopyAll = async () => {
    const unusedCodes = codes.filter(c => !c.is_used).map(c => c.code);
    if (unusedCodes.length === 0) {
      toast.error('没有可用的邀请码');
      return;
    }
    try {
      await navigator.clipboard.writeText(unusedCodes.join('\n'));
      toast.success(`已复制 ${unusedCodes.length} 个未使用的邀请码`);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invite_codes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('邀请码已删除');
      setCodes(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting code:', error);
      toast.error('删除失败');
    }
  };

  const handleDeleteAllUsed = async () => {
    const usedIds = codes.filter(c => c.is_used).map(c => c.id);
    if (usedIds.length === 0) {
      toast.info('没有已使用的邀请码');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('invite_codes')
        .delete()
        .in('id', usedIds);
      
      if (error) throw error;
      
      toast.success(`已删除 ${usedIds.length} 个已使用的邀请码`);
      fetchCodes();
    } catch (error) {
      console.error('Error deleting used codes:', error);
      toast.error('删除失败');
    }
  };

  // 导出为 CSV
  const handleExportCSV = () => {
    const unusedCodes = codes.filter(c => !c.is_used);
    if (unusedCodes.length === 0) {
      toast.error('没有可用的邀请码可导出');
      return;
    }

    const headers = ['邀请码', '备注', '创建时间'];
    const rows = unusedCodes.map(c => [
      c.code,
      c.note || '',
      new Date(c.created_at).toLocaleString('zh-CN')
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `邀请码_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${unusedCodes.length} 个邀请码`);
  };

  // 导出为 Excel (实际上是 TSV，Excel 可直接打开)
  const handleExportExcel = () => {
    const unusedCodes = codes.filter(c => !c.is_used);
    if (unusedCodes.length === 0) {
      toast.error('没有可用的邀请码可导出');
      return;
    }

    const headers = ['邀请码', '备注', '创建时间'];
    const rows = unusedCodes.map(c => [
      c.code,
      c.note || '',
      new Date(c.created_at).toLocaleString('zh-CN')
    ]);

    const tsvContent = [headers, ...rows]
      .map(row => row.join('\t'))
      .join('\n');

    const blob = new Blob(['\uFEFF' + tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `邀请码_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${unusedCodes.length} 个邀请码`);
  };

  const unusedCount = codes.filter(c => !c.is_used).length;
  const usedCount = codes.filter(c => c.is_used).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-amber-500" />
          邀请码管理
        </CardTitle>
        <CardDescription>
          生成和管理邀请码，用户需要邀请码才能注册
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 统计 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-3">
            <p className="text-2xl font-bold text-green-600">{unusedCount}</p>
            <p className="text-xs text-muted-foreground">可用邀请码</p>
          </div>
          <div className="bg-gradient-to-br from-gray-500/10 to-gray-600/5 border border-gray-500/20 rounded-xl p-3">
            <p className="text-2xl font-bold text-gray-600">{usedCount}</p>
            <p className="text-xs text-muted-foreground">已使用</p>
          </div>
        </div>

        {/* 批量生成 */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-xl">
          <Label className="text-sm font-medium">批量生成邀请码</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="数量"
              value={batchCount}
              onChange={(e) => setBatchCount(e.target.value)}
              className="w-20"
              min={1}
              max={100}
            />
            <Input
              placeholder="备注（可选）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1"
            />
          </div>
          <Button 
            onClick={handleBatchGenerate} 
            disabled={generating}
            className="w-full bg-amber-500 hover:bg-amber-600"
          >
            {generating ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            生成 {batchCount || 10} 个邀请码
          </Button>
        </div>

        {/* 操作按钮 */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyAll}>
            <Copy className="w-4 h-4 mr-1" />
            复制全部可用
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeleteAllUsed} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-1" />
            清理已使用
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1" />
            导出 CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-1" />
            导出 Excel
          </Button>
        </div>

        {/* 邀请码列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : codes.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">暂无邀请码，点击上方按钮生成</p>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {codes.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-2 p-3 rounded-lg border ${
                    item.is_used 
                      ? 'bg-muted/50 opacity-60' 
                      : 'bg-card hover:border-amber-500/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`font-mono text-lg tracking-wider ${item.is_used ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {item.code}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.is_used ? (
                        <span className="text-red-500">
                          已使用 · {item.used_by_email} · {item.used_at ? new Date(item.used_at).toLocaleDateString('zh-CN') : ''}
                        </span>
                      ) : (
                        <span className="text-green-500">可用</span>
                      )}
                      {item.note && <span>· {item.note}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!item.is_used && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(item.code, item.id)}
                        className="h-8 w-8"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default InviteCodeManager;
