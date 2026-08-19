import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Heart, Smile, Meh, Frown, Star, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { deleteLocalRows, getLocalTable, insertLocalRow, isLocalModeEnabled, updateLocalRows } from '@/lib/localDataStore';

interface DiaryEntry {
  id: string;
  title: string;
  content: string;
  mood: string;
  character_id?: string;
  character_name?: string;
  character_avatar?: string;
  created_at: string;
}

const MOODS = [
  { id: 'happy', icon: Smile, color: 'text-pink-500 bg-pink-100' },
  { id: 'love', icon: Heart, color: 'text-red-500 bg-red-100' },
  { id: 'neutral', icon: Meh, color: 'text-blue-500 bg-blue-100' },
  { id: 'sad', icon: Frown, color: 'text-purple-500 bg-purple-100' },
  { id: 'special', icon: Star, color: 'text-yellow-500 bg-yellow-100' },
];

const DiaryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('happy');
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [localMode, setLocalMode] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLocalMode(null);
      return;
    }
    isLocalModeEnabled(user.id).then(setLocalMode).catch(() => setLocalMode(false));
  }, [user?.id]);

  useEffect(() => {
    if (user && localMode !== null) {
      fetchEntries();
      fetchCharacters();
    }
  }, [user, localMode]);

  const fetchEntries = async () => {
    if (localMode && user?.id) {
      const [diaries, localCharacters] = await Promise.all([
        getLocalTable(user.id, 'diaries'),
        getLocalTable(user.id, 'characters'),
      ]);
      setEntries(diaries
        .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
        .map((diary: any) => {
          const character = localCharacters.find((item) => item.id === diary.character_id);
          return { ...diary, character_name: character?.name, character_avatar: character?.avatar_url };
        }));
      return;
    }

    const { data } = await (supabase
      .from('diaries' as any)
      .select('*, characters(name, avatar_url)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false }) as any);
    
    if (data) {
      setEntries(data.map((d: any) => ({
        ...d,
        character_name: d.characters?.name,
        character_avatar: d.characters?.avatar_url
      })));
    }
  };

  const fetchCharacters = async () => {
    if (localMode && user?.id) {
      setCharacters(await getLocalTable(user.id, 'characters'));
      return;
    }
    const { data } = await supabase
      .from('characters')
      .select('id, name, avatar_url')
      .eq('user_id', user?.id);
    if (data) setCharacters(data);
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('请输入日记内容');
      return;
    }

    const diaryData = {
      user_id: user?.id,
      title: title.trim() || null,
      content: content.trim(),
      mood,
      character_id: selectedCharacter
    };

    if (localMode && user?.id) {
      if (editingEntry) {
        await updateLocalRows(user.id, 'diaries', (row) => row.id === editingEntry.id, diaryData);
        toast.success('日记已更新');
      } else {
        await insertLocalRow(user.id, 'diaries', diaryData);
        toast.success('日记已保存');
      }
    } else if (editingEntry) {
      await (supabase.from('diaries' as any) as any).update(diaryData).eq('id', editingEntry.id);
      toast.success('日记已更新');
    } else {
      await (supabase.from('diaries' as any) as any).insert(diaryData);
      toast.success('日记已保存');
    }

    resetForm();
    fetchEntries();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    if (localMode && user?.id) {
      await deleteLocalRows(user.id, 'diaries', (row) => row.id === deleteId);
    } else {
      await (supabase.from('diaries' as any) as any).delete().eq('id', deleteId);
    }
    toast.success('日记已删除');
    setDeleteId(null);
    fetchEntries();
  };

  const openEdit = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setTitle(entry.title || '');
    setContent(entry.content);
    setMood(entry.mood);
    setSelectedCharacter(entry.character_id || null);
    setShowDialog(true);
  };

  const resetForm = () => {
    setShowDialog(false);
    setEditingEntry(null);
    setTitle('');
    setContent('');
    setMood('happy');
    setSelectedCharacter(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getMoodIcon = (moodId: string) => {
    const m = MOODS.find(mood => mood.id === moodId);
    if (!m) return null;
    const Icon = m.icon;
    return <Icon className={`w-5 h-5 ${m.color.split(' ')[0]}`} />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50/80 to-purple-50/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold text-pink-600">日记</h1>
        </div>
        <Button variant="candy" onClick={() => setShowDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />
          写日记
        </Button>
      </div>

      {/* Entries */}
      <div className="p-4 space-y-4">
        <AnimatePresence>
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {getMoodIcon(entry.mood)}
                  <span>{formatDate(entry.created_at)}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(entry)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => setDeleteId(entry.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {entry.title && (
                <h3 className="font-bold text-lg mb-1">{entry.title}</h3>
              )}
              <p className="text-foreground/80 whitespace-pre-wrap">{entry.content}</p>
              
              {entry.character_name && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                  <div className="w-6 h-6 rounded-full bg-primary/20 overflow-hidden">
                    {entry.character_avatar ? (
                      <img src={entry.character_avatar} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs">
                        {entry.character_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">与 {entry.character_name} 的回忆</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {entries.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Star className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>还没有日记，记录今天的心情吧~</p>
          </div>
        )}
      </div>

      {/* Write Dialog */}
      <Dialog open={showDialog} onOpenChange={resetForm}>
        <DialogContent className="max-w-[95%] rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? '编辑日记' : '写日记'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="标题（可选）"
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="记录今天的心情..."
              rows={5}
            />
            
            <div>
              <p className="text-sm text-muted-foreground mb-2">今日心情</p>
              <div className="flex gap-2">
                {MOODS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        mood === m.id ? m.color + ' scale-110 ring-2 ring-offset-2 ring-primary' : 'bg-muted hover:bg-muted/80'
                      }`}
                      onClick={() => setMood(m.id)}
                    >
                      <Icon className={`w-6 h-6 ${mood === m.id ? m.color.split(' ')[0] : 'text-muted-foreground'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {characters.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">关联角色（可选）</p>
                <div className="flex flex-wrap gap-2">
                  {characters.map((char) => (
                    <button
                      key={char.id}
                      className={`px-4 py-2 rounded-full text-sm transition-all ${
                        selectedCharacter === char.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                      onClick={() => setSelectedCharacter(selectedCharacter === char.id ? null : char.id)}
                    >
                      {char.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={resetForm}>
                取消
              </Button>
              <Button variant="candy" className="flex-1" onClick={handleSave}>
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除日记？</AlertDialogTitle>
            <AlertDialogDescription>此操作不可撤销</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DiaryPage;
