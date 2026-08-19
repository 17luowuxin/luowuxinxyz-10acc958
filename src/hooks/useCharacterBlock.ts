import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalTable } from '@/lib/localDataStore';

interface BlockStatus {
  isBlocked: boolean;
  messageCount: number;
  lastMessageAt: string | null;
  blockedAt: string | null;
}

export const useCharacterBlock = (characterId: string | null, localMode = false) => {
  const { user } = useAuth();
  const [blockStatus, setBlockStatus] = useState<BlockStatus>({
    isBlocked: false,
    messageCount: 0,
    lastMessageAt: null,
    blockedAt: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchBlockStatus = useCallback(async () => {
    if (!user || !characterId) {
      setLoading(false);
      return;
    }

    try {
      if (localMode) {
        const data = (await getLocalTable(user.id, 'character_blocks')).find(
          (row) => row.character_id === characterId && row.is_active === true,
        );
        setBlockStatus({
          isBlocked: !!data,
          messageCount: Number(data?.message_count || 0),
          lastMessageAt: data?.last_message_at ? String(data.last_message_at) : null,
          blockedAt: data?.blocked_at ? String(data.blocked_at) : null,
        });
        return;
      }

      const { data, error } = await supabase
        .from('character_blocks')
        .select('is_active, message_count, last_message_at, blocked_at')
        .eq('user_id', user.id)
        .eq('character_id', characterId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      setBlockStatus({
        isBlocked: !!data,
        messageCount: data?.message_count || 0,
        lastMessageAt: data?.last_message_at || null,
        blockedAt: data?.blocked_at || null,
      });
    } catch (error) {
      console.error('Error fetching block status:', error);
    } finally {
      setLoading(false);
    }
  }, [user, characterId, localMode]);

  useEffect(() => {
    fetchBlockStatus();
  }, [fetchBlockStatus]);

  // 订阅实时更新
  useEffect(() => {
    if (!user || !characterId || localMode) return;

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
  }, [user, characterId, fetchBlockStatus, localMode]);

  const setBlocked = (blocked: boolean) => {
    setBlockStatus(prev => ({
      ...prev,
      isBlocked: blocked,
      messageCount: blocked ? 0 : prev.messageCount,
      blockedAt: blocked ? new Date().toISOString() : null,
    }));
  };

  return {
    ...blockStatus,
    loading,
    setBlocked,
    refetch: fetchBlockStatus,
  };
};
