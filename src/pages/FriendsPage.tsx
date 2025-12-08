import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) fetchCharacters();
  }, [user]);

  const fetchCharacters = async () => {
    const { data } = await supabase.from('characters').select('*').eq('user_id', user?.id).order('created_at', { ascending: false });
    if (data) setCharacters(data);
  };

  const createCharacter = async () => {
    if (!name.trim()) { toast.error('请输入角色名'); return; }
    await supabase.from('characters').insert({ user_id: user?.id, name, persona, opening_line: openingLine || '你好呀~' });
    toast.success('角色创建成功!');
    setName(''); setPersona(''); setOpeningLine(''); setOpen(false);
    fetchCharacters();
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-xl font-bold">好友</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="ghost" size="icon"><Plus className="w-6 h-6" /></Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>创建新角色</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="角色昵称" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea placeholder="角色人设 (性格、背景等)" value={persona} onChange={(e) => setPersona(e.target.value)} rows={3} />
              <Input placeholder="开场白" value={openingLine} onChange={(e) => setOpeningLine(e.target.value)} />
              <Button variant="candy" className="w-full" onClick={createCharacter}>创建</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {characters.map((char, i) => (
          <motion.div key={char.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-4 cursor-pointer active:scale-98" onClick={() => navigate(`/chat/${char.id}`)}>
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-candy-pink to-candy-purple flex items-center justify-center">
              {char.avatar_url ? <img src={char.avatar_url} className="w-full h-full rounded-full object-cover" /> : <User className="w-6 h-6 text-white" />}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{char.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{char.opening_line || '点击开始聊天'}</p>
            </div>
          </motion.div>
        ))}
        {characters.length === 0 && <div className="text-center py-20 text-muted-foreground"><User className="w-16 h-16 mx-auto mb-4 opacity-50" /><p>还没有好友，点击右上角创建</p></div>}
      </div>
    </div>
  );
};

export default FriendsPage;
