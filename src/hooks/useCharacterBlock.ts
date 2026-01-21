import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface BlockStatus {
  isBlocked: boolean;
  messageCount: number;
  lastMessageAt: string | null;
}

export const useCharacterBlock = (characterId: string | null) => {
  const { user } = useAuth();
  const [blockStatus, setBlockStatus] = useState<BlockStatus>({
    isBlocked: false,
    messageCount: 0,
    lastMessageAt: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchBlockStatus = useCallback(async () => {
    if (!user || !characterId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('character_blocks')
        .select('is_active, message_count, last_message_at')
        .eq('user_id', user.id)
        .eq('character_id', characterId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      setBlockStatus({
        isBlocked: !!data,
        messageCount: data?.message_count || 0,
        lastMessageAt: data?.last_message_at || null,
      });
    } catch (error) {
      console.error('Error fetching block status:', error);
    } finally {
      setLoading(false);
    }
  }, [user, characterId]);

  useEffect(() => {
    fetchBlockStatus();
  }, [fetchBlockStatus]);

  // 订阅实时更新
  useEffect(() => {
    if (!user || !characterId) return;

    const channel = supabase
      .channel(`block_${characterId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'character_blocks',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchBlockStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, characterId, fetchBlockStatus]);

  const setBlocked = (blocked: boolean) => {
    setBlockStatus(prev => ({
      ...prev,
      isBlocked: blocked,
      messageCount: blocked ? 0 : prev.messageCount,
    }));
  };

  return {
    ...blockStatus,
    loading,
    setBlocked,
    refetch: fetchBlockStatus,
  };
};