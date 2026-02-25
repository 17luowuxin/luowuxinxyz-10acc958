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

// 获取用户API配置
const fetchApiConfig = async (userId: string) => {
  const { data: apiSettings } = await supabase
    .from('api_keys')
    .select('api_key, provider')
    .eq('user_id', userId);

  const customUrl = apiSettings?.find(s => s.provider === 'custom_base_url');
  const customKey = apiSettings?.find(s => s.provider === 'custom');
  const customModel = apiSettings?.find(s => s.provider === 'custom_model');

  return {
    apiUrl: customUrl?.api_key || '',
    apiKey: customKey?.api_key || '',
    model: customModel?.api_key || '',
  };
};

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
      // 1. 快速更新/创建拉黑记录
      const { data: existingBlock } = await supabase
        .from('character_blocks')
        .select('id, message_count')
        .eq('user_id', user.id)
        .eq('character_id', characterId)
        .maybeSingle();

      if (existingBlock?.id) {
        await supabase
          .from('character_blocks')
          .update({
            is_active: true,
            blocked_at: new Date().toISOString(),
            message_count: 0,
            last_message_at: null,
          })
          .eq('id', existingBlock.id);
      } else {
        await supabase
          .from('character_blocks')
          .insert({
            user_id: user.id,
            character_id: characterId,
            is_active: true,
            blocked_at: new Date().toISOString(),
            message_count: 0,
            last_message_at: null,
          });
      }

      // 2. 立即关闭弹窗、更新状态，不等AI生成
      toast.success(`已将 ${characterName} 移出好友列表`);
      onBlockStatusChange(true);
      onOpenChange(false);
      setLoading(false);

      // 3. 后台异步生成AI消息（不阻塞UI）
      const userId = user.id;
      const charId = characterId;
      (async () => {
        try {
          const apiConfig = await fetchApiConfig(userId);
          const { data, error: invokeError } = await supabase.functions.invoke('block-message', {
            body: {
              action: 'generate_block_message',
              ...apiConfig,
              batchCount: 3, // 减少到3条，加快速度
              characterName,
              characterPersona,
              characterReplyMode,
              messageCount: 0,
            },
          });

          if (invokeError) {
            console.error('block-message invoke error:', invokeError);
            return;
          }

          const messages = (data as any)?.messages as string[] | undefined;
          if (Array.isArray(messages) && messages.length > 0) {
            for (let i = 0; i < messages.length; i++) {
              await supabase.from('chat_messages').insert({
                user_id: userId,
                character_id: charId,
                role: 'assistant',
                content: messages[i],
                created_at: new Date(Date.now() + i * 1000).toISOString(),
              });
            }
            await supabase
              .from('character_blocks')
              .update({
                message_count: messages.length,
                last_message_at: new Date().toISOString(),
              })
              .eq('user_id', userId)
              .eq('character_id', charId);
          }
        } catch (e) {
          console.error('Background block message error:', e);
        }
      })();
    } catch (error: any) {
      console.error('Block error:', error);
      toast.error('操作失败: ' + (error?.message || '未知错误'));
      setLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. 获取消息数 + 更新记录（并行）
      const [{ data: blockRecord }] = await Promise.all([
        supabase
          .from('character_blocks')
          .select('message_count')
          .eq('user_id', user.id)
          .eq('character_id', characterId)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('character_blocks')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('character_id', characterId),
      ]);

      const messageCount = blockRecord?.message_count || 0;

      // 2. 立即关闭弹窗
      toast.success(`已重新添加 ${characterName} 为好友`);
      onBlockStatusChange(false);
      onOpenChange(false);
      setLoading(false);

      // 3. 后台生成欢迎回来消息
      const userId = user.id;
      const charId = characterId;
      (async () => {
        try {
          const apiConfig = await fetchApiConfig(userId);
          const { data, error: invokeError } = await supabase.functions.invoke('block-message', {
            body: {
              action: 'generate_unblock_message',
              ...apiConfig,
              batchCount: 3, // 生成3条加回消息
              characterName,
              characterPersona,
              characterReplyMode,
              messageCount,
            },
          });

          if (invokeError) {
            console.error('unblock-message invoke error:', invokeError);
            return;
          }

          // 优先使用 messages 数组，向后兼容 message 字段
          const messages = (data as any)?.messages as string[] | undefined;
          const singleMsg = (data as any)?.message as string | undefined;
          const allMsgs = Array.isArray(messages) && messages.length > 0 ? messages : (singleMsg ? [singleMsg] : []);
          
          for (let i = 0; i < allMsgs.length; i++) {
            await supabase.from('chat_messages').insert({
              user_id: userId,
              character_id: charId,
              role: 'assistant',
              content: allMsgs[i],
              created_at: new Date(Date.now() + i * 1000).toISOString(),
            });
          }
        } catch (e) {
          console.error('Background unblock message error:', e);
        }
      })();
    } catch (error) {
      console.error('Unblock error:', error);
      toast.error('操作失败');
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
