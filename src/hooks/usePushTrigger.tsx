import { useCallback, useRef, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getLocalAssetUrl, getLocalTable, isLocalModeEnabled } from '@/lib/localDataStore';

/**
 * Hook to trigger push notifications when user is not actively viewing the chat
 * AND show in-app notification banners when user is on a different page
 */
export function usePushTrigger() {
  const { user } = useAuth();
  const isPageVisible = useRef(true);
  const currentChatId = useRef<string | null>(null);
  const navigateRef = useRef<((path: string) => void) | null>(null);
  const [localMode, setLocalMode] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setLocalMode(false);
      return;
    }
    isLocalModeEnabled(user.id).then(setLocalMode);
  }, [user]);

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

  // Show in-app notification banner (WeChat style with avatar)
  const showInAppNotification = useCallback(async (
    characterId: string,
    characterName: string,
    messageContent: string
  ) => {
    // Fetch avatar for better notification
    let avatarUrl: string | undefined;
    try {
      const data = localMode && user
        ? (await getLocalTable(user.id, 'characters')).find((row) => row.id === characterId)
        : (await supabase.from('characters').select('avatar_url').eq('id', characterId).single()).data;
      const storedAvatar = data?.avatar_url ? String(data.avatar_url) : undefined;
      avatarUrl = storedAvatar && localMode && user
        ? await getLocalAssetUrl(user.id, storedAvatar)
        : storedAvatar;
    } catch {
      // Ignore errors
    }

    const truncatedContent = messageContent.length > 50 
      ? messageContent.slice(0, 50) + '...' 
      : messageContent;

    const handleClick = () => {
      if (navigateRef.current) {
        navigateRef.current('/chat/' + characterId);
      } else {
        window.location.href = '/chat/' + characterId;
      }
      toast.dismiss();
    };

    // WeChat style notification with avatar
    toast.custom(
      () => (
        <div
          onClick={handleClick}
          className="flex items-center gap-3 w-full max-w-sm bg-card/95 backdrop-blur-md border border-border rounded-2xl p-3 shadow-lg cursor-pointer hover:bg-accent/50 transition-colors"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Avatar */}
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={characterName}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-lg">
                {characterName.charAt(0)}
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground truncate">
              {characterName}
            </div>
            <div className="text-sm text-muted-foreground truncate mt-0.5">
              {truncatedContent}
            </div>
          </div>
          
          {/* Time indicator */}
          <div className="flex-shrink-0 text-xs text-muted-foreground">
            刚刚
          </div>
        </div>
      ),
      {
        duration: 4000,
        position: 'top-center',
      }
    );
  }, [localMode, user]);

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

    // 本机模式不向云端上传推送订阅或消息内容。
    if (localMode) return;

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
  }, [user, showInAppNotification, localMode]);

  return {
    setCurrentChat,
    setNavigate,
    triggerPush,
    isPageVisible
  };
}
