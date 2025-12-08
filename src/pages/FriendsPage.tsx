import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, User, MoreVertical, Pencil, Trash2, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const FriendsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [characters, setCharacters] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [persona, setPersona] = useState('');
  const [openingLine, setOpeningLine] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [editingChar, setEditingChar] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) fetchCharacters();
  }, [user]);

  const fetchCharacters = async () => {
    const { data } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', user?.id)
      .order('updated_at', { ascending: false });
    if (data) setCharacters(data);
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarUrl(URL.createObjectURL(file));
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return null;
    
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('avatars')
      .upload(fileName, avatarFile, { upsert: true });
    
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const createCharacter = async () => {
    if (!name.trim()) { 
      toast.error('请输入角色名'); 
      return; 
    }

    let finalAvatarUrl = avatarUrl;
    if (avatarFile) {
      const uploadedUrl = await uploadAvatar();
      if (uploadedUrl) finalAvatarUrl = uploadedUrl;
    }

    const { error } = await supabase.from('characters').insert({ 
      user_id: user?.id, 
      name, 
      persona, 
      opening_line: openingLine || '你好呀~',
      avatar_url: finalAvatarUrl
    });
    
    if (error) {
      toast.error('创建失败');
      return;
    }
    
    toast.success('角色创建成功!');
    resetForm();
    setOpen(false);
    fetchCharacters();
  };

  const updateCharacter = async () => {
    if (!editingChar) return;
    
    let finalAvatarUrl = avatarUrl;
    if (avatarFile) {
      const uploadedUrl = await uploadAvatar();
      if (uploadedUrl) finalAvatarUrl = uploadedUrl;
    }

    await supabase
      .from('characters')
      .update({ 
        name, 
        persona, 
        opening_line: openingLine,
        avatar_url: finalAvatarUrl
      })
      .eq('id', editingChar.id);
    
    toast.success('角色已更新');
    resetForm();
    setEditingChar(null);
    setOpen(false);
    fetchCharacters();
  };

  const deleteCharacter = async (id: string) => {
    await supabase.from('characters').delete().eq('id', id);
    toast.success('角色已删除');
    fetchCharacters();
  };

  const resetForm = () => {
    setName('');
    setPersona('');
    setOpeningLine('');
    setAvatarUrl('');
    setAvatarFile(null);
  };

  const openEditDialog = (char: any) => {
    setEditingChar(char);
    setName(char.name);
    setPersona(char.persona || '');
    setOpeningLine(char.opening_line || '');
    setAvatarUrl(char.avatar_url || '');
    setOpen(true);
  };

  const handleDialogClose = () => {
    setOpen(false);
    setEditingChar(null);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 p-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarSelect}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/')}
          className="rounded-full"
        >
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </Button>
        <h1 className="text-xl font-bold text-gray-700">好友</h1>
        <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleDialogClose()}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-pink-500"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl bg-white/95 backdrop-blur-sm border-0 shadow-2xl max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle className="text-center text-gray-700">
                {editingChar ? '编辑角色' : '创建新角色'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Avatar Upload */}
              <div className="flex justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                  ) : (
                    <Plus className="w-8 h-8 text-white" />
                  )}
                </button>
              </div>
              
              <Input 
                placeholder="角色名称" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="rounded-xl bg-gray-50 border-gray-200"
              />
              <Textarea 
                placeholder="角色人设（性格、背景、说话风格等）" 
                value={persona} 
                onChange={(e) => setPersona(e.target.value)} 
                rows={3}
                className="rounded-xl bg-gray-50 border-gray-200"
              />
              <Input 
                placeholder="你好呀~" 
                value={openingLine} 
                onChange={(e) => setOpeningLine(e.target.value)}
                className="rounded-xl bg-gray-50 border-gray-200"
              />
              <Button 
                className="w-full rounded-xl py-6 bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg" 
                onClick={editingChar ? updateCharacter : createCharacter}
              >
                {editingChar ? '保存修改' : '创建角色'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Character List */}
      <div className="space-y-3">
        <AnimatePresence>
          {characters.map((char, i) => (
            <motion.div 
              key={char.id} 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.05 }} 
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4"
            >
              {/* Avatar with pink border like reference */}
              <button 
                onClick={() => navigate(`/chat/${char.id}`)}
                className="w-14 h-14 rounded-full border-2 border-pink-200 overflow-hidden flex-shrink-0 bg-gradient-to-br from-pink-100 to-purple-100"
              >
                {char.avatar_url ? (
                  <img src={char.avatar_url} className="w-full h-full object-cover" alt={char.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-6 h-6 text-pink-300" />
                  </div>
                )}
              </button>
              
              {/* Info */}
              <button 
                onClick={() => navigate(`/chat/${char.id}`)}
                className="flex-1 text-left min-w-0"
              >
                <h3 className="font-semibold text-gray-700">{char.name}</h3>
                <p className="text-sm text-gray-400 truncate">
                  {char.opening_line || '点击开始聊天'}
                </p>
              </button>
              
              {/* Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="flex-shrink-0 text-gray-400">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={() => openEditDialog(char)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => deleteCharacter(char.id)}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {characters.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <User className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>还没有好友，点击右上角创建</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsPage;
