import React, { useRef, useCallback, useEffect, memo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageItem } from './ChatMessageList';
import { Loader2 } from 'lucide-react';

interface VirtualMessageListProps {
  messages: any[];
  character: any;
  profile: any;
  customization: any;
  replyMode: 'novel' | 'online';
  pendingTransfers: any[];
  blockedAt: string | null;
  userAvatarFrame: string | null;
  friendAvatarFrame: string | null;
  userBubbleColor: string;
  friendBubbleColor: string;
  fontColor: string;
  friendFontColor: string;
  bubbleOpacity: number;
  bubbleSize: number;
  userBubbleDecor: string | null;
  userBubbleDecorImage: string | null;
  friendBubbleDecor: string | null;
  friendBubbleDecorImage: string | null;
  longPressedMsg: any;
  loading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onMessageTouchStart: (msg: any) => void;
  onMessageTouchEnd: () => void;
  onMessageTouchMove: () => void;
  onMessageClick: (msg: any, e: React.MouseEvent) => void;
  onReceiveTransfer: (id: string) => void;
  onDeleteTransfer: (id: string) => void;
  onQuoteMessage: (msg: any) => void;
  onCopyMessage: (msg: any) => void;
  onDeleteFromMessage: (msg: any) => void;
  onClearLongPress: () => void;
  parseTransferCommand: (content: string) => { amount: number; message: string } | null;
  removeTransferCommand: (content: string) => string;
  getBubbleStyle: (isUser: boolean) => string;
  getBubbleBackgroundStyle: (isUser: boolean) => React.CSSProperties;
  getBubblePadding: (size: number) => string;
}

// 加载更多提示组件
const LoadMoreIndicator = memo(({ isLoading, hasMore }: { isLoading: boolean; hasMore: boolean }) => {
  if (!hasMore) {
    return (
      <div className="flex justify-center py-3">
        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
          已经是最早的消息了
        </span>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }
  
  return null;
});

LoadMoreIndicator.displayName = 'LoadMoreIndicator';

// AI输入中气泡
const TypingIndicator = memo(({ character, friendAvatarFrame }: { character: any; friendAvatarFrame: string | null }) => (
  <div className="flex items-end gap-2 px-3 py-1">
    <div className="relative w-9 h-9 flex-shrink-0">
      {friendAvatarFrame && (
        <img src={friendAvatarFrame} alt="" className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" />
      )}
      <div className={`absolute rounded-full overflow-hidden ${friendAvatarFrame ? 'inset-[15%]' : 'inset-0'}`}>
        {character?.avatar_url ? (
          <img src={character.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-[10px] text-gray-500">
            {character?.name?.charAt(0) || '?'}
          </div>
        )}
      </div>
    </div>
    <div className="px-3 py-2 rounded-2xl bg-white/80 dark:bg-muted/80 text-muted-foreground text-sm">
      <span className="inline-flex gap-1">
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
    </div>
  </div>
));

TypingIndicator.displayName = 'TypingIndicator';

const VirtualMessageList: React.FC<VirtualMessageListProps> = ({
  messages,
  character,
  profile,
  customization,
  replyMode,
  pendingTransfers,
  blockedAt,
  userAvatarFrame,
  friendAvatarFrame,
  userBubbleColor,
  friendBubbleColor,
  fontColor,
  friendFontColor,
  bubbleOpacity,
  bubbleSize,
  userBubbleDecor,
  userBubbleDecorImage,
  friendBubbleDecor,
  friendBubbleDecorImage,
  longPressedMsg,
  loading,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onMessageTouchStart,
  onMessageTouchEnd,
  onMessageTouchMove,
  onMessageClick,
  onReceiveTransfer,
  onDeleteTransfer,
  onQuoteMessage,
  onCopyMessage,
  onDeleteFromMessage,
  onClearLongPress,
  parseTransferCommand,
  removeTransferCommand,
  getBubbleStyle,
  getBubbleBackgroundStyle,
  getBubblePadding,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);
  const prevMessageCountRef = useRef(messages.length);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // 计算总项目数（包括加载更多指示器和输入中指示器）
  const itemCount = messages.length + (hasMore || isLoadingMore ? 1 : 0) + (loading ? 1 : 0);

  // 虚拟列表配置
  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 80, []), // 预估每条消息高度
    overscan: 5, // 预渲染可视区域外的5条消息
    getItemKey: useCallback((index: number) => {
      const loadMoreOffset = hasMore || isLoadingMore ? 1 : 0;
      if (index === 0 && loadMoreOffset) return 'load-more';
      const msgIndex = index - loadMoreOffset;
      if (msgIndex >= 0 && msgIndex < messages.length) {
        return messages[msgIndex].id;
      }
      return 'typing-indicator';
    }, [messages, hasMore, isLoadingMore]),
  });

  // 检测滚动位置，接近顶部时加载更多
  const handleScroll = useCallback(() => {
    if (!parentRef.current || scrollingRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    
    // 检查是否接近底部（用于自动滚动判断）
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldAutoScroll(isNearBottom);
    
    // 接近顶部时加载更多
    if (scrollTop < 100 && hasMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  // 新消息时自动滚动到底部
  useEffect(() => {
    const currentCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    
    if (currentCount > prevCount && shouldAutoScroll) {
      // 新消息到达，平滑滚动到底部
      requestAnimationFrame(() => {
        if (parentRef.current) {
          parentRef.current.scrollTo({
            top: parentRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    }
    
    prevMessageCountRef.current = currentCount;
  }, [messages.length, shouldAutoScroll]);

  // 初始加载时滚动到底部
  useEffect(() => {
    if (messages.length > 0 && prevMessageCountRef.current === 0) {
      requestAnimationFrame(() => {
        if (parentRef.current) {
          parentRef.current.scrollTop = parentRef.current.scrollHeight;
        }
      });
    }
  }, [messages.length]);

  // 加载更多历史消息后保持滚动位置
  useEffect(() => {
    if (isLoadingMore) {
      scrollingRef.current = true;
    } else {
      // 延迟重置，让虚拟列表有时间更新
      setTimeout(() => {
        scrollingRef.current = false;
      }, 100);
    }
  }, [isLoadingMore]);

  const virtualItems = virtualizer.getVirtualItems();
  const loadMoreOffset = hasMore || isLoadingMore ? 1 : 0;

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto overscroll-none touch-pan-y"
      onScroll={handleScroll}
    >
      <div
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualItem) => {
          const index = virtualItem.index;
          
          // 加载更多指示器
          if (index === 0 && loadMoreOffset) {
            return (
              <div
                key={virtualItem.key}
                className="absolute top-0 left-0 w-full"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
              >
                <LoadMoreIndicator isLoading={isLoadingMore} hasMore={hasMore} />
              </div>
            );
          }
          
          const msgIndex = index - loadMoreOffset;
          
          // 输入中指示器
          if (msgIndex >= messages.length) {
            return (
              <div
                key={virtualItem.key}
                className="absolute top-0 left-0 w-full"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
              >
                <TypingIndicator character={character} friendAvatarFrame={friendAvatarFrame} />
              </div>
            );
          }
          
          // 消息项
          const msg = messages[msgIndex];
          const prevMsg = msgIndex > 0 ? messages[msgIndex - 1] : null;
          const isUser = msg.role === 'user';
          
          return (
            <div
              key={virtualItem.key}
              className="absolute top-0 left-0 w-full px-3 py-1.5"
              style={{
                transform: `translateY(${virtualItem.start}px)`,
              }}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
            >
              <MessageItem
                msg={msg}
                prevMsg={prevMsg}
                isUser={isUser}
                character={character}
                profile={profile}
                customization={customization}
                replyMode={replyMode}
                pendingTransfers={pendingTransfers}
                blockedAt={blockedAt}
                userAvatarFrame={userAvatarFrame}
                friendAvatarFrame={friendAvatarFrame}
                userBubbleColor={userBubbleColor}
                friendBubbleColor={friendBubbleColor}
                fontColor={fontColor}
                friendFontColor={friendFontColor}
                bubbleOpacity={bubbleOpacity}
                bubbleSize={bubbleSize}
                userBubbleDecor={userBubbleDecor}
                userBubbleDecorImage={userBubbleDecorImage}
                friendBubbleDecor={friendBubbleDecor}
                friendBubbleDecorImage={friendBubbleDecorImage}
                isLongPressed={longPressedMsg?.id === msg.id}
                onTouchStart={() => onMessageTouchStart(msg)}
                onTouchEnd={onMessageTouchEnd}
                onTouchMove={onMessageTouchMove}
                onClick={(e) => onMessageClick(msg, e)}
                onReceiveTransfer={onReceiveTransfer}
                onDeleteTransfer={onDeleteTransfer}
                onQuoteMessage={() => onQuoteMessage(msg)}
                onCopyMessage={() => onCopyMessage(msg)}
                onDeleteFromMessage={() => onDeleteFromMessage(msg)}
                onClearLongPress={onClearLongPress}
                parseTransferCommand={parseTransferCommand}
                removeTransferCommand={removeTransferCommand}
                getBubbleStyle={getBubbleStyle}
                getBubbleBackgroundStyle={getBubbleBackgroundStyle}
                getBubblePadding={getBubblePadding}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(VirtualMessageList);
