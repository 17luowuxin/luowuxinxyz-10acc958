import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Users, Sparkles, BookOpen, Upload, Download, Plus, Pencil, Trash2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Preset {
  id: string;
  name: string;
  content: string;
  character_id?: string;
  character_name?: string;
  created_at: string;
}

interface WorldBook {
  id: string;
  name: string;
  content: string;
  is_global: boolean;
  created_at: string;
}

const WorkshopPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('characters');
  const [searchQuery, setSearchQuery] = useState('');
  const [characters, setCharacters] = useState<any[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [worldBooks, setWorldBooks] = useState<WorldBook[]>([]);
  
  // Dialog states
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [showWorldBookDialog, setShowWorldBookDialog] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [editingWorldBook, setEditingWorldBook] = useState<WorldBook | null>(null);
  const [deleteId, setDeleteId] = useState<{ type: string; id: string } | null>(null);
  
  // Form states
  const [presetName, setPresetName] = useState('');
  const [presetContent, setPresetContent] = useState('');
  const [presetCharacter, setPresetCharacter] = useState<string | null>(null);
  
  const [worldBookName, setWorldBookName] = useState('');
  const [worldBookContent, setWorldBookContent] = useState('');
  const [worldBookGlobal, setWorldBookGlobal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCharacters();
      fetchPresets();
      fetchWorldBooks();
    }
  }, [user]);

  const fetchCharacters = async () => {
    const { data } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    if (data) setCharacters(data);
  };

  const fetchPresets = async () => {
    const { data } = await supabase
      .from('presets')
      .select('*, characters(name)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    if (data) {
      setPresets(data.map((p: any) => ({
        ...p,
        character_name: p.characters?.name
      })));
    }
  };

  const fetchWorldBooks = async () => {
    const { data } = await supabase
      .from('world_books')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    if (data) setWorldBooks(data);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim() || !presetContent.trim()) {
      toast.error('请填写名称和内容');
      return;
    }

    const presetData = {
      user_id: user?.id,
      name: presetName.trim(),
      content: presetContent.trim(),
      character_id: presetCharacter
    };

    if (editingPreset) {
      await supabase.from('presets').update(presetData).eq('id', editingPreset.id);
      toast.success('预设已更新');
    } else {
      await supabase.from('presets').insert(presetData);
      toast.success('预设已创建');
    }

    resetPresetForm();
    fetchPresets();
  };

  const handleSaveWorldBook = async () => {
    if (!worldBookName.trim() || !worldBookContent.trim()) {
      toast.error('请填写名称和内容');
      return;
    }

    const worldBookData = {
      user_id: user?.id,
      name: worldBookName.trim(),
      content: worldBookContent.trim(),
      is_global: worldBookGlobal
    };

    if (editingWorldBook) {
      await supabase.from('world_books').update(worldBookData).eq('id', editingWorldBook.id);
      toast.success('世界书已更新');
    } else {
      await supabase.from('world_books').insert(worldBookData);
      toast.success('世界书已创建');
    }

    resetWorldBookForm();
    fetchWorldBooks();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    if (deleteId.type === 'preset') {
      await supabase.from('presets').delete().eq('id', deleteId.id);
      toast.success('预设已删除');
      fetchPresets();
    } else if (deleteId.type === 'worldbook') {
      await supabase.from('world_books').delete().eq('id', deleteId.id);
      toast.success('世界书已删除');
      fetchWorldBooks();
    }
    
    setDeleteId(null);
  };

  const exportCharacter = (char: any) => {
    const data = JSON.stringify({
      name: char.name,
      persona: char.persona,
      opening_line: char.opening_line
    }, null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${char.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('角色已导出');
  };

  const exportPreset = (preset: Preset) => {
    const data = JSON.stringify({
      name: preset.name,
      content: preset.content
    }, null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preset-${preset.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('预设已导出');
  };

  const exportWorldBook = (wb: WorldBook) => {
    const data = JSON.stringify({
      name: wb.name,
      content: wb.content,
      is_global: wb.is_global
    }, null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worldbook-${wb.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('世界书已导出');
  };

  const handleImportCharacter = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.name) {
        toast.error('无效的角色文件');
        return;
      }
      
      await supabase.from('characters').insert({
        user_id: user?.id,
        name: data.name,
        persona: data.persona || '',
        opening_line: data.opening_line || ''
      });
      
      toast.success('角色已导入');
      fetchCharacters();
    } catch (err) {
      toast.error('导入失败，请检查文件格式');
    }
    
    e.target.value = '';
  };

  const resetPresetForm = () => {
    setShowPresetDialog(false);
    setEditingPreset(null);
    setPresetName('');
    setPresetContent('');
    setPresetCharacter(null);
  };

  const resetWorldBookForm = () => {
    setShowWorldBookDialog(false);
    setEditingWorldBook(null);
    setWorldBookName('');
    setWorldBookContent('');
    setWorldBookGlobal(false);
  };

  const openEditPreset = (preset: Preset) => {
    setEditingPreset(preset);
    setPresetName(preset.name);
    setPresetContent(preset.content);
    setPresetCharacter(preset.character_id || null);
    setShowPresetDialog(true);
  };

  const openEditWorldBook = (wb: WorldBook) => {
    setEditingWorldBook(wb);
    setWorldBookName(wb.name);
    setWorldBookContent(wb.content);
    setWorldBookGlobal(wb.is_global);
    setShowWorldBookDialog(true);
  };

  const filteredCharacters = characters.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.persona?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPresets = presets.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWorldBooks = worldBooks.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50/80 to-purple-50/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center p-4 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold ml-2">角色工坊</h1>
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索..."
            className="pl-10 rounded-full"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3 rounded-full">
            <TabsTrigger value="characters" className="rounded-full gap-1">
              <Users className="w-4 h-4" />角色卡
            </TabsTrigger>
            <TabsTrigger value="presets" className="rounded-full gap-1">
              <Sparkles className="w-4 h-4" />预设
            </TabsTrigger>
            <TabsTrigger value="worldbooks" className="rounded-full gap-1">
              <BookOpen className="w-4 h-4" />世界书
            </TabsTrigger>
          </TabsList>

          {/* Characters Tab */}
          <TabsContent value="characters" className="mt-4 space-y-3">
            <label className="block">
              <input type="file" accept=".json" onChange={handleImportCharacter} className="hidden" />
              <Button variant="outline" className="w-full rounded-full" asChild>
                <span><Upload className="w-4 h-4 mr-2" />导入角色卡</span>
              </Button>
            </label>

            <AnimatePresence>
              {filteredCharacters.map((char, i) => (
                <motion.div
                  key={char.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/60 flex-shrink-0 overflow-hidden">
                      {char.avatar_url ? (
                        <img src={char.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl text-primary-foreground">
                          {char.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{char.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{char.persona || '暂无人设'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 rounded-full"
                      onClick={() => navigate(`/friends`)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />编辑
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 rounded-full"
                      onClick={() => exportCharacter(char)}
                    >
                      <Download className="w-3 h-3 mr-1" />导出
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredCharacters.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                暂无角色，去好友页面创建吧~
              </div>
            )}
          </TabsContent>

          {/* Presets Tab */}
          <TabsContent value="presets" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 rounded-full"
                onClick={() => setShowPresetDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />创建新预设
              </Button>
              <Button variant="outline" className="rounded-full">
                <Upload className="w-4 h-4 mr-2" />导入
              </Button>
            </div>

            <AnimatePresence>
              {filteredPresets.map((preset, i) => (
                <motion.div
                  key={preset.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold">{preset.name}</h3>
                      {preset.character_name && (
                        <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-1">
                          <Users className="w-3 h-3" />{preset.character_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{preset.content}</p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 rounded-full"
                      onClick={() => openEditPreset(preset)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />编辑
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="w-8 h-8"
                      onClick={() => exportPreset(preset)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="w-8 h-8 text-destructive"
                      onClick={() => setDeleteId({ type: 'preset', id: preset.id })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredPresets.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                暂无预设，创建一个吧~
              </div>
            )}
          </TabsContent>

          {/* World Books Tab */}
          <TabsContent value="worldbooks" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 rounded-full"
                onClick={() => setShowWorldBookDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />创建世界书
              </Button>
              <Button variant="outline" className="rounded-full">
                <Upload className="w-4 h-4 mr-2" />导入
              </Button>
            </div>

            <AnimatePresence>
              {filteredWorldBooks.map((wb, i) => (
                <motion.div
                  key={wb.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${wb.is_global ? 'bg-amber-100' : 'bg-blue-100'}`}>
                      {wb.is_global ? (
                        <Globe className="w-5 h-5 text-amber-600" />
                      ) : (
                        <BookOpen className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold truncate">{wb.name}</h3>
                        {wb.is_global && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">全局</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3 mt-1">{wb.content}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 rounded-full"
                      onClick={() => openEditWorldBook(wb)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />编辑
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="w-8 h-8"
                      onClick={() => exportWorldBook(wb)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="w-8 h-8 text-destructive"
                      onClick={() => setDeleteId({ type: 'worldbook', id: wb.id })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredWorldBooks.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                暂无世界书，创建一个吧~
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Preset Dialog */}
      <Dialog open={showPresetDialog} onOpenChange={resetPresetForm}>
        <DialogContent className="max-w-[95%] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingPreset ? '编辑预设' : '创建预设'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="预设名称"
            />
            <Textarea
              value={presetContent}
              onChange={(e) => setPresetContent(e.target.value)}
              placeholder="预设内容..."
              rows={6}
            />
            {characters.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">关联角色（可选）</p>
                <div className="flex flex-wrap gap-2">
                  {characters.map((char) => (
                    <button
                      key={char.id}
                      className={`px-3 py-1 rounded-full text-sm ${
                        presetCharacter === char.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}
                      onClick={() => setPresetCharacter(presetCharacter === char.id ? null : char.id)}
                    >
                      {char.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={resetPresetForm}>取消</Button>
              <Button variant="candy" className="flex-1" onClick={handleSavePreset}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* World Book Dialog */}
      <Dialog open={showWorldBookDialog} onOpenChange={resetWorldBookForm}>
        <DialogContent className="max-w-[95%] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingWorldBook ? '编辑世界书' : '创建世界书'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={worldBookName}
              onChange={(e) => setWorldBookName(e.target.value)}
              placeholder="世界书名称"
            />
            <Textarea
              value={worldBookContent}
              onChange={(e) => setWorldBookContent(e.target.value)}
              placeholder="世界书内容..."
              rows={6}
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={worldBookGlobal}
                onChange={(e) => setWorldBookGlobal(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">全局应用（对所有角色生效）</span>
            </label>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={resetWorldBookForm}>取消</Button>
              <Button variant="candy" className="flex-1" onClick={handleSaveWorldBook}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
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

export default WorkshopPage;