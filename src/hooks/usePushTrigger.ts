import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to trigger push notifications when user is not actively viewing the chat
 */
export function usePushTrigger() {
  const { user } = useAuth();
  const isPageVisible = useRef(true);
  const currentChatId = useRef<string | null>(null);

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisible.current = !document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    isPageVisible.current = !document.hidden;

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Set the current chat being viewed
  const setCurrentChat = useCallback((characterId: string | null) => {
    currentChatId.current = characterId;
  }, []);

  // Trigger push notification for new message
  const triggerPush = useCallback(async (
    characterId: string,
    characterName: string,
    messageContent: string
  ) => {
    if (!user) return;

    // Don't send push if user is actively viewing this chat
    if (isPageVisible.current && currentChatId.current === characterId) {
      console.log('[Push] User is viewing this chat, skipping push');
      return;
    }

    // Truncate message for notification
    const truncatedBody = messageContent.length > 100 
      ? messageContent.slice(0, 100) + '...' 
      : messageContent;

    try {
      console.log('[Push] Triggering push notification for', characterName);
      
      const { error } = await supabase.functions.invoke('send-push', {
        body: {
          userId: user.id,
          title: `${characterName}发来消息`,
          body: truncatedBody,
          url: `/chat/${characterId}`,
          characterId,
          characterName
        }
      });

      if (error) {
        console.error('[Push] Failed to send push:', error);
      } else {
        console.log('[Push] Push notification sent');
      }
    } catch (err) {
      console.error('[Push] Error triggering push:', err);
    }
  }, [user]);

  return {
    setCurrentChat,
    triggerPush,
    isPageVisible
  };
}
