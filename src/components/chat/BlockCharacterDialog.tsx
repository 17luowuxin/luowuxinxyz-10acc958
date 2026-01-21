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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Ban, UserPlus } from 'lucide-react';

interface BlockCharacterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string;
  characterName: string;
  isBlocked: boolean;
  onBlockStatusChange: (blocked: boolean) => void;
}

export const BlockCharacterDialog: React.FC<BlockCharacterDialogProps> = ({
  open,
  onOpenChange,
  characterId,
  characterName,
  isBlocked,
  onBlockStatusChange,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 创建或更新拉黑记录
      const { error } = await supabase
        .from('character_blocks')
        .upsert({
          user_id: user.id,
          character_id: characterId,
          is_active: true,
          blocked_at: new Date().toISOString(),
          message_count: 0,
          last_message_at: null,
        }, {
          onConflict: 'user_id,character_id',
        });

      if (error) throw error;

      // 获取用户API配置 - 需要获取完整配置
      const { data: apiSettings } = await supabase
        .from('api_keys')
        .select('api_key, provider')
        .eq('user_id', user.id);

      // 解析API配置
      let apiUrl = '';
      let apiKey = '';
      let model = '';
      
      if (apiSettings) {
        const customUrl = apiSettings.find(s => s.provider === 'custom_url');
        const customKey = apiSettings.find(s => s.provider === 'custom');
        const customModel = apiSettings.find(s => s.provider === 'custom_model');
        
        apiUrl = customUrl?.api_key || '';
        apiKey = customKey?.api_key || '';
        model = customModel?.api_key || '';
      }

      await supabase.functions.invoke('block-message', {
        body: {
          action: 'generate_block_message',
          userId: user.id,
          characterId,
          apiUrl,
          apiKey,
          model,
          batchCount: 5, // 拉黑时连续发5条消息
        },
      });

      toast.success(`已将 ${characterName} 移出好友列表`);
      onBlockStatusChange(true);
      onOpenChange(false);
    } catch (error) {
      console.error('Block error:', error);
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 获取用户API配置
      const { data: apiConfig } = await supabase
        .from('api_keys')
        .select('api_key, provider')
        .eq('user_id', user.id)
        .maybeSingle();

      // 触发角色发送解除拉黑消息
      await supabase.functions.invoke('block-message', {
        body: {
          action: 'generate_unblock_message',
          userId: user.id,
          characterId,
          apiKey: apiConfig?.api_key,
        },
      });

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