import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Ban, UserPlus } from 'lucide-react';

interface BlockCharacterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string;
  characterName: string;
  characterPersona?: string;
  characterReplyMode?: 'online' | 'novel';
  isBlocked: boolean;
  onBlockStatusChange: (blocked: boolean) => void;
}

export const BlockCharacterDialog: React.FC<BlockCharacterDialogProps> = ({
  open,
  onOpenChange,
  characterId,
  characterName,
  characterPersona,
  characterReplyMode,
  isBlocked,
  onBlockStatusChange,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 兼容无唯一约束的后端：先查再更新/插入，避免 onConflict 报错
      const { data: existingBlock, error: existingError } = await supabase
        .from('character_blocks')
        .select('id')
        .eq('user_id', user.id)
        .eq('character_id', characterId)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingBlock?.id) {
        const { error } = await supabase
          .from('character_blocks')
          .update({
            is_active: true,
            blocked_at: new Date().toISOString(),
            message_count: 0,
            last_message_at: null,
          })
          .eq('id', existingBlock.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('character_blocks')
          .insert({
            user_id: user.id,
            character_id: characterId,
            is_active: true,
            blocked_at: new Date().toISOString(),
            message_count: 0,
            last_message_at: null,
          });

        if (error) throw error;
      }

      // 获取用户API配置 - 需要获取完整配置
      const { data: apiSettings } = await supabase
        .from('api_keys')
        .select('api_key, provider, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // 解析API配置 - 正确的provider名称
      let apiUrl = '';
      let apiKey = '';
      let model = '';
      
      if (apiSettings) {
        // 使用正确的provider名称: custom_base_url (不是 custom_url)
        const customUrl = apiSettings.find(s => s.provider === 'custom_base_url');
        const customKey = apiSettings.find(s => s.provider === 'custom');
        const customModel = apiSettings.find(s => s.provider === 'custom_model');
        
        apiUrl = customUrl?.api_key || '';
        apiKey = customKey?.api_key || '';
        model = customModel?.api_key || '';
      }

      const { data, error: invokeError } = await supabase.functions.invoke('block-message', {
        body: {
          action: 'generate_block_message',
          userId: user.id,
          characterId,
          apiUrl,
          apiKey,
          model,
          batchCount: 5,
          characterName,
          characterPersona,
          characterReplyMode,
        },
      });

      if (invokeError) {
        console.error('block-message invoke error:', invokeError);
      }

      // 如果后端因FK约束无法保存消息，前端用客户端插入（外部数据库场景）
      const messages = (data as any)?.messages as string[] | undefined;
      const savedToDb = (data as any)?.savedToDb;
      if (Array.isArray(messages) && messages.length > 0 && !savedToDb) {
        for (let i = 0; i < messages.length; i++) {
          await supabase.from('chat_messages').insert({
            user_id: user.id,
            character_id: characterId,
            role: 'assistant',
            content: messages[i],
            created_at: new Date(Date.now() + i * 1000).toISOString(),
          }).then(({ error }) => {
            if (error) console.warn('Client-side insert fallback failed:', error.message);
          });
        }
      }

      toast.success(`已将 ${characterName} 移出好友列表`);
      onBlockStatusChange(true);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Block error:', error);
      toast.error('操作失败: ' + (error?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 更新拉黑记录
      const { error } = await supabase
        .from('character_blocks')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('character_id', characterId);

      if (error) throw error;

      // 获取用户API配置
      const { data: apiSettings } = await supabase
        .from('api_keys')
        .select('api_key, provider')
        .eq('user_id', user.id);

      const customKey = apiSettings?.find(s => s.provider === 'custom');
      const customUrl = apiSettings?.find(s => s.provider === 'custom_base_url');
      const customModel = apiSettings?.find(s => s.provider === 'custom_model');

      // 触发角色发送解除拉黑消息
      const { data, error: invokeError } = await supabase.functions.invoke('block-message', {
        body: {
          action: 'generate_unblock_message',
          userId: user.id,
          characterId,
          apiKey: customKey?.api_key,
          apiUrl: customUrl?.api_key,
          model: customModel?.api_key,
          characterName,
          characterPersona,
          characterReplyMode,
        },
      });

      if (invokeError) {
        console.error('unblock-message invoke error:', invokeError);
      }

      // 如果后端因FK约束无法保存消息，前端用客户端插入
      const unblockMsg = (data as any)?.message as string | undefined;
      const savedToDb = (data as any)?.savedToDb;
      if (unblockMsg && !savedToDb) {
        await supabase.from('chat_messages').insert({
          user_id: user.id,
          character_id: characterId,
          role: 'assistant',
          content: unblockMsg,
        }).then(({ error }) => {
          if (error) console.warn('Client-side unblock insert fallback failed:', error.message);
        });
      }

      toast.success(`已重新添加 ${characterName} 为好友`);
      onBlockStatusChange(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Unblock error:', error);
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass-bubble">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isBlocked ? (
              <>
                <UserPlus className="w-5 h-5 text-green-500" />
                重新添加好友
              </>
            ) : (
              <>
                <Ban className="w-5 h-5 text-destructive" />
                删除好友
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBlocked ? (
              <>
                确定要重新添加 <span className="font-semibold text-foreground">{characterName}</span> 为好友吗？
                <br />
                <span className="text-xs text-muted-foreground">
                  {characterName} 会知道你重新添加了ta，可能会很开心哦~
                </span>
              </>
            ) : (
              <>
                确定要将 <span className="font-semibold text-foreground">{characterName}</span> 移出好友列表吗？
                <br />
                <span className="text-xs text-muted-foreground">
                  {characterName} 会知道被删除，可能会发消息挽留你...
                </span>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={isBlocked ? handleUnblock : handleBlock}
            disabled={loading}
            className={isBlocked ? 'bg-green-500 hover:bg-green-600' : 'bg-destructive hover:bg-destructive/90'}
          >
            {loading ? '处理中...' : (isBlocked ? '添加好友' : '删除好友')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};