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
      // 1. 更新/创建拉黑记录（通过代理→外部DB）
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

      // 2. 调用边缘函数生成AI消息（纯生成，不操作DB）
      const apiConfig = await fetchApiConfig(user.id);

      const { data, error: invokeError } = await supabase.functions.invoke('block-message', {
        body: {
          action: 'generate_block_message',
          ...apiConfig,
          batchCount: 5,
          characterName,
          characterPersona,
          characterReplyMode,
          messageCount: 0, // 刚拉黑，从0开始
        },
      });

      if (invokeError) {
        console.error('block-message invoke error:', invokeError);
      }

      // 3. 前端保存消息到DB（通过代理→外部DB）
      const messages = (data as any)?.messages as string[] | undefined;
      if (Array.isArray(messages) && messages.length > 0) {
        for (let i = 0; i < messages.length; i++) {
          const { error } = await supabase.from('chat_messages').insert({
            user_id: user.id,
            character_id: characterId,
            role: 'assistant',
            content: messages[i],
            created_at: new Date(Date.now() + i * 1000).toISOString(),
          });
          if (error) console.warn('Insert block message failed:', error.message);
        }

        // 4. 更新拉黑记录的消息计数
        await supabase
          .from('character_blocks')
          .update({
            message_count: messages.length,
            last_message_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('character_id', characterId);
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
      // 1. 获取拉黑期间的消息数（用于情绪判断）
      const { data: blockRecord } = await supabase
        .from('character_blocks')
        .select('message_count')
        .eq('user_id', user.id)
        .eq('character_id', characterId)
        .eq('is_active', true)
        .maybeSingle();

      const messageCount = blockRecord?.message_count || 0;

      // 2. 更新拉黑记录为不活跃
      await supabase
        .from('character_blocks')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('character_id', characterId);

      // 3. 调用边缘函数生成解除拉黑消息
      const apiConfig = await fetchApiConfig(user.id);

      const { data, error: invokeError } = await supabase.functions.invoke('block-message', {
        body: {
          action: 'generate_unblock_message',
          ...apiConfig,
          characterName,
          characterPersona,
          characterReplyMode,
          messageCount,
        },
      });

      if (invokeError) {
        console.error('unblock-message invoke error:', invokeError);
      }

      // 4. 前端保存消息到DB
      const unblockMsg = (data as any)?.message as string | undefined;
      if (unblockMsg) {
        const { error } = await supabase.from('chat_messages').insert({
          user_id: user.id,
          character_id: characterId,
          role: 'assistant',
          content: unblockMsg,
        });
        if (error) console.warn('Insert unblock message failed:', error.message);
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
