import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Row { id: string; content: string; category: string | null; created_at: string | null }
interface Summary { id: string; summary: string; created_at: string | null }

const CATEGORY: Record<string, string> = {
  personal: '个人信息', preference: '喜好', event: '重要事件', relationship: '关系', other: '其他', scene_log: '场景经历（朋友圈/游戏）',
};

interface Props { userId: string; characterId: string; onSummaryCleared: () => void }

const CharacterMemoryManager: React.FC<Props> = ({ userId, characterId, onSummaryCleared }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [m, s] = await Promise.all([
      supabase.from('character_extracted_memories').select('id, content, category, created_at')
        .eq('user_id', userId).eq('character_id', characterId).order('created_at', { ascending: false }),
      supabase.from('character_summaries').select('id, summary, created_at')
        .eq('user_id', userId).eq('character_id', characterId).order('created_at', { ascending: false }),
    ]);
    setRows((m.data as Row[]) || []);
    setSummaries((s.data as Summary[]) || []);
    setLoading(false);
  }, [userId, characterId]);

  useEffect(() => { void load(); }, [load]);

  const saveEdit = async (table: 'character_extracted_memories' | 'character_summaries', id: string) => {
    const field = table === 'character_summaries' ? { summary: editText } : { content: editText, updated_at: new Date().toISOString() };
    const { error } = await supabase.from(table).update(field as any).eq('id', id).eq('user_id', userId);
    if (error) return toast.error('保存失败');
    toast.success('已保存'); setEditId(null); void load();
  };

  const remove = async (table: 'character_extracted_memories' | 'character_summaries', id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId);
    if (error) return toast.error('删除失败');
    void load();
  };

  const clearAll = async () => {
    if (!confirm('确定清除这个角色的全部记忆吗？清除后无法恢复，聊天记录不会被删除。')) return;
    const results = await Promise.all([
      supabase.from('character_extracted_memories').delete().eq('user_id', userId).eq('character_id', characterId),
      supabase.from('character_summaries').delete().eq('user_id', userId).eq('character_id', characterId),
      supabase.from('character_memories').delete().eq('user_id', userId).eq('character_id', characterId),
    ]);
    if (results.some((r) => r.error)) toast.error('部分记忆清除失败');
    else toast.success('已清除全部记忆');
    onSummaryCleared();
    void load();
  };

  const renderItem = (table: 'character_extracted_memories' | 'character_summaries', id: string, text: string, label: string) => (
    <div key={id} className="rounded-xl bg-gray-50 border border-gray-200 p-2 text-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-purple-500">{label}</span>
        {editId !== id && (
          <div className="flex gap-1">
            <button onClick={() => { setEditId(id); setEditText(text); }} aria-label="编辑"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
            <button onClick={() => remove(table, id)} aria-label="删除"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
          </div>
        )}
      </div>
      {editId === id ? (
        <div className="space-y-1">
          <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={4} className="text-sm" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditId(null)} aria-label="取消"><X className="w-4 h-4 text-gray-400" /></button>
            <button onClick={() => saveEdit(table, id)} aria-label="保存"><Check className="w-4 h-4 text-green-500" /></button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-gray-700 max-h-40 overflow-y-auto">{text}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-3 pt-2 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">记忆条目（{rows.length + summaries.length}）</p>
        <button onClick={load} aria-label="刷新"><RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      {!loading && rows.length === 0 && summaries.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-3">还没有自动提取的记忆</p>
      )}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {rows.map((r) => renderItem('character_extracted_memories', r.id, r.content, CATEGORY[r.category || 'other'] || r.category || '其他'))}
        {summaries.map((s) => renderItem('character_summaries', s.id, s.summary, '阶段摘要'))}
      </div>
      <Button variant="outline" className="w-full rounded-xl text-red-500 border-red-200" onClick={clearAll}>
        <Trash2 className="w-4 h-4 mr-1" />清除全部记忆
      </Button>
    </div>
  );
};

export default CharacterMemoryManager;
