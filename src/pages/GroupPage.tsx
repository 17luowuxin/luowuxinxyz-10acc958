import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Users, MessageCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const GroupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchGroups();
      fetchCharacters();
    }
  }, [user]);

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('group_chats')
      .select('*, group_members(character_id, characters(id, name, avatar_url))')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    if (data) setGroups(data);
  };

  const fetchCharacters = async () => {
    const { data } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', user?.id);
    if (data) setCharacters(data);
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      toast.error('请输入群名称');
      return;
    }
    if (selectedCharacters.length < 2) {
      toast.error('请至少选择2个角色');
      return;
    }

    const { data: group, error } = await supabase
      .from('group_chats')
      .insert({ user_id: user?.id, name: groupName })
      .select()
      .single();

    if (error || !group) {
      toast.error('创建失败');
      return;
    }

    // 添加群成员
    const members = selectedCharacters.map(charId => ({
      group_id: group.id,
      character_id: charId
    }));

    await supabase.from('group_members').insert(members);

    toast.success('群聊创建成功!');
    setGroupName('');
    setSelectedCharacters([]);
    setOpen(false);
    fetchGroups();
  };

  const toggleCharacter = (charId: string) => {
    setSelectedCharacters(prev => 
      prev.includes(charId) 
        ? prev.filter(id => id !== charId)
        : [...prev, charId]
    );
  };

  return (
    <div className="min-h-screen bg-background/80 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold">群聊</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Plus className="w-6 h-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>创建群聊</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input 
                placeholder="群名称" 
                value={groupName} 
                onChange={(e) => setGroupName(e.target.value)} 
              />
              
              <div>
                <p className="text-sm font-medium mb-3">选择群成员 (至少2个)</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {characters.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      请先在"好友"中创建角色
                    </p>
                  ) : (
                    characters.map(char => (
                      <div 
                        key={char.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => toggleCharacter(char.id)}
                      >
                        <Checkbox 
                          checked={selectedCharacters.includes(char.id)}
                          onCheckedChange={() => toggleCharacter(char.id)}
                        />
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-candy-pink to-candy-purple flex items-center justify-center">
                          {char.avatar_url ? (
                            <img src={char.avatar_url} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <span className="font-medium">{char.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <Button 
                variant="candy" 
                className="w-full" 
                onClick={createGroup}
                disabled={characters.length < 2}
              >
                创建群聊 ({selectedCharacters.length}人)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <AnimatePresence>
        <div className="space-y-3">
          {groups.map((group, i) => {
            const members = group.group_members || [];
            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-2xl p-4 shadow-card cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/group-chat/${group.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-candy-blue to-candy-purple flex items-center justify-center relative">
                    <Users className="w-6 h-6 text-white" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-candy-pink text-white text-xs flex items-center justify-center font-bold">
                      {members.length}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{group.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {members.map((m: any) => m.characters?.name).filter(Boolean).join('、') || '暂无成员'}
                    </p>
                  </div>
                  <MessageCircle className="w-5 h-5 text-muted-foreground" />
                </div>
              </motion.div>
            );
          })}

          {groups.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>还没有群聊</p>
              <p className="text-sm mt-2">点击右上角创建群聊</p>
            </div>
          )}
        </div>
      </AnimatePresence>
    </div>
  );
};

export default GroupPage;
