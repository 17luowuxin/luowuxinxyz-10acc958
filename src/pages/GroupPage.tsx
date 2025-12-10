import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Users, MessageCircle, User, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

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

    setCreating(true);
    try {
      const { data: group, error } = await supabase
        .from('group_chats')
        .insert({ user_id: user?.id, name: groupName })
        .select()
        .single();

      if (error) {
        console.error('创建群聊失败:', error);
        toast.error('创建群聊失败: ' + error.message);
        return;
      }

      if (!group) {
        toast.error('创建群聊失败: 未返回数据');
        return;
      }

      // 添加群成员
      const members = selectedCharacters.map(charId => ({
        group_id: group.id,
        character_id: charId
      }));

      const { error: membersError } = await supabase.from('group_members').insert(members);
      
      if (membersError) {
        console.error('添加群成员失败:', membersError);
        toast.error('添加群成员失败: ' + membersError.message);
        return;
      }

      toast.success('群聊创建成功!');
      setGroupName('');
      setSelectedCharacters([]);
      setOpen(false);
      fetchGroups();
    } catch (err) {
      console.error('创建群聊异常:', err);
      toast.error('创建群聊失败');
    } finally {
      setCreating(false);
    }
  };

  const deleteGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(groupId);
    try {
      // 先删除群成员
      await supabase.from('group_members').delete().eq('group_id', groupId);
      // 删除群消息
      await supabase.from('group_messages').delete().eq('group_id', groupId);
      // 删除群聊
      const { error } = await supabase.from('group_chats').delete().eq('id', groupId);
      
      if (error) {
        toast.error('删除失败: ' + error.message);
        return;
      }
      
      toast.success('群聊已删除');
      fetchGroups();
    } catch (err) {
      console.error('删除群聊异常:', err);
      toast.error('删除失败');
    } finally {
      setDeleting(null);
    }
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
                disabled={creating || selectedCharacters.length < 2 || !groupName.trim()}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : (
                  `创建群聊 (${selectedCharacters.length}人)`
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <AnimatePresence>
        <div className="space-y-3">
          {groups.map((group, i) => {
            const members = group.group_members || [];
            const memberChars = members.map((m: any) => m.characters).filter(Boolean);
            const displayMembers = memberChars.slice(0, 4);
            const gridSize = displayMembers.length <= 1 ? 1 : 2;
            
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
                  {/* 四宫格头像 */}
                  <div 
                    className="w-14 h-14 rounded-xl overflow-hidden bg-muted grid gap-0.5 flex-shrink-0"
                    style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
                  >
                    {displayMembers.map((member: any) => (
                      <div key={member.id} className="w-full h-full bg-muted overflow-hidden">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} className="w-full h-full object-cover" alt={member.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-candy-pink to-candy-purple">
                            <User className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                    {displayMembers.length < 4 && displayMembers.length > 1 && 
                      Array(4 - displayMembers.length).fill(0).map((_, idx) => (
                        <div key={`empty-${idx}`} className="w-full h-full bg-muted/50" />
                      ))
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{group.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {memberChars.map((m: any) => m.name).join('、') || '暂无成员'}
                    </p>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {deleting === group.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>删除群聊</AlertDialogTitle>
                        <AlertDialogDescription>
                          确定要删除"{group.name}"吗？所有聊天记录将被清除，此操作无法撤销。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => deleteGroup(group.id, e)}>
                          删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
