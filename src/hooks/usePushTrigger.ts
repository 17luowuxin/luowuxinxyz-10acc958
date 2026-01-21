import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Hook to trigger push notifications when user is not actively viewing the chat
 * AND show in-app notification banners when user is on a different page
 */
export function usePushTrigger() {
  const { user } = useAuth();
  const isPageVisible = useRef(true);
  const currentChatId = useRef<string | null>(null);
  const navigateRef = useRef<((path: string) => void) | null>(null);

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

  // Set navigate function (called from component)
  const setNavigate = useCallback((navigateFn: (path: string) => void) => {
    navigateRef.current = navigateFn;
  }, []);

  // Show in-app notification banner
  const showInAppNotification = useCallback(async (
    characterId: string,
    characterName: string,
    messageContent: string
  ) => {
    // Fetch avatar for better notification
    let avatarUrl: string | undefined;
    try {
      const { data } = await supabase
        .from('characters')
        .select('avatar_url')
        .eq('id', characterId)
        .single();
      avatarUrl = data?.avatar_url || undefined;
    } catch {
      // Ignore errors
    }

    const truncatedContent = messageContent.length > 60 
      ? messageContent.slice(0, 60) + '...' 
      : messageContent;

    const handleClick = () => {
      if (navigateRef.current) {
        navigateRef.current('/chat/' + characterId);
      } else {
        window.location.href = '/chat/' + characterId;
      }
      toast.dismiss();
    };

    toast(characterName + ' 发来消息', {
      description: truncatedContent,
      duration: 4000,
      position: 'top-center',
      action: {
        label: '查看',
        onClick: handleClick,
      },
    });
  }, []);

  // Trigger push notification for new message
  const triggerPush = useCallback(async (
    characterId: string,
    characterName: string,
    messageContent: string
  ) => {
    if (!user) return;

    // Don't send notification if user is actively viewing this chat
    if (currentChatId.current === characterId) {
      console.log('[Push] User is viewing this chat, skipping notification');
      return;
    }

    // If page is visible but user is on a different page, show in-app notification
    if (isPageVisible.current) {
      console.log('[Push] Showing in-app notification');
      await showInAppNotification(characterId, characterName, messageContent);
      return;
    }

    // Page is hidden (background), send system push notification
    const truncatedBody = messageContent.length > 100 
      ? messageContent.slice(0, 100) + '...' 
      : messageContent;

    try {
      console.log('[Push] Triggering push notification for', characterName);
      
      const { error } = await supabase.functions.invoke('send-push', {
        body: {
          userId: user.id,
          title: characterName + '发来消息',
          body: truncatedBody,
          url: '/chat/' + characterId,
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
  }, [user, showInAppNotification]);

  return {
    setCurrentChat,
    setNavigate,
    triggerPush,
    isPageVisible
  };
}
