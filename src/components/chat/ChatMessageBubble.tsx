import React, { memo, useMemo, useState } from 'react';
import { Phone, Video, Quote, Copy, RotateCcw, Trash2, X } from 'lucide-react';
import VoiceMessageBubble from './VoiceMessageBubble';
import TransferCard from './TransferCard';
import UserTransferCard from './UserTransferCard';
import { NovelModeText } from '@/utils/novelModeParser';
import { sanitizeMessageContent } from '@/utils/messageParser';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface ChatMessageBubbleProps {
  msg: any;
  prevMsg: any | null;
  isUser: boolean;
  character: any;
  profile: any;
  customization: any;
  replyMode: 'novel' | 'online';
  pendingTransfers: any[];
  blockedAt: string | null;
  // Styles
  userAvatarFrame: string | null;
  friendAvatarFrame: string | null;
  userBubbleColor: string;
  friendBubbleColor: string;
  fontColor: string;
  friendFontColor: string;
  bubbleOpacity: number;
  bubbleSize: number;
  // Bubble decorations
  userBubbleDecor: string | null;
  userBubbleDecorImage: string | null;
  friendBubbleDecor: string | null;
  friendBubbleDecorImage: string | null;
  // Long press state
  isLongPressed: boolean;
  // Handlers
  onMessageTouchStart: () => void;
  onMessageTouchEnd: () => void;
  onMessageTouchMove: () => void;
  onMessageClick: (e: React.MouseEvent) => void;
  onReceiveTransfer: (id: string) => void;
  onDeleteTransfer: (id: string) => void;
  onQuoteMessage: () => void;
  onCopyMessage: () => void;
  onDeleteFromMessage: () => void;
  onDeleteSingleMessage: () => void;
  onClearLongPress: () => void;
  parseTransferCommand: (content: string) => { amount: number; message: string } | null;
  removeTransferCommand: (content: string) => string;
  getBubbleStyle: (isUser: boolean) => string;
  getBubbleBackgroundStyle: (isUser: boolean) => React.CSSProperties;
  getBubblePadding: (size: number) => string;
}

// 格式化时间 - 放在组件外避免重复创建
const formatTime = (date: Date) => {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  if (isToday) {
    return `${hours}:${minutes}`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`;
};

// Avatar 组件 - 单独 memo
const MessageAvatar = memo(({ 
  isUser, 
  avatarUrl, 
  avatarFrame, 
  fallbackText 
}: { 
  isUser: boolean; 
  avatarUrl: string | null; 
  avatarFrame: string | null; 
  fallbackText: string;
}) => (
  <div className="relative w-9 h-9 flex-shrink-0 mt-0.5">
    {avatarFrame && (
      <img src={avatarFrame} alt="" className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" />
    )}
    <div className={`absolute rounded-full overflow-hidden ${avatarFrame ? 'inset-[15%]' : 'inset-0'}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className={`w-full h-full flex items-center justify-center text-[10px] text-gray-${isUser ? '600' : '500'} ${
          isUser ? 'bg-gradient-to-br from-pink-200 to-rose-200' : 'bg-gradient-to-br from-pink-100 to-purple-100'
        }`}>
          {fallbackText}
        </div>
      )}
    </div>
  </div>
));

MessageAvatar.displayName = 'MessageAvatar';

// 通话记录组件
const CallRecordBubble = memo(({ callType, duration }: { callType: string; duration: string }) => (
  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-green-100 to-emerald-100 border border-green-200/50 shadow-sm">
    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
      {callType === '视频通话' ? (
        <Video className="w-4 h-4 text-white" />
      ) : (
        <Phone className="w-4 h-4 text-white" />
      )}
    </div>
    <div className="flex flex-col">
      <span className="text-sm font-medium text-green-800">{callType}</span>
      <span className="text-xs text-green-600">{duration}</span>
    </div>
  </div>
));

CallRecordBubble.displayName = 'CallRecordBubble';

// 长按菜单组件
const LongPressMenu = memo(({ 
  isUser, 
  onQuote, 
  onCopy, 
  onDelete, 
  onDeleteSingle,
  onClose 
}: { 
  isUser: boolean; 
  onQuote: () => void; 
  onCopy: () => void; 
  onDelete: () => void; 
  onDeleteSingle: () => void;
  onClose: () => void;
}) => (
  <>
    {/* 点击空白处关闭的透明遮罩 */}
    <div 
      className="fixed inset-0 z-40" 
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
      onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
    />
    <div
      className={`absolute bottom-full mb-1 bg-background border rounded-xl shadow-lg p-1.5 flex gap-1 z-50 ${isUser ? 'right-0' : 'left-0'}`}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-9 px-3 text-xs gap-1.5 rounded-lg"
        onClick={onQuote}
      >
        <Quote className="w-4 h-4" />
        引用
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-9 px-3 text-xs gap-1.5 rounded-lg"
        onClick={onCopy}
      >
        <Copy className="w-4 h-4" />
        复制
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-9 px-3 text-xs gap-1.5 rounded-lg text-destructive"
        onClick={onDeleteSingle}
      >
        <Trash2 className="w-4 h-4" />
        删除
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 px-3 text-xs gap-1.5 rounded-lg text-destructive">
            <RotateCcw className="w-4 h-4" />
            回溯
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>回溯删除？</AlertDialogTitle>
            <AlertDialogDescription>
              这将删除该消息及之后的所有消息，以便重新开始对话。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onClose}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </>
));

LongPressMenu.displayName = 'LongPressMenu';

// 主消息气泡组件
const ChatMessageBubble = memo(({
  msg,
  prevMsg,
  isUser,
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
  isLongPressed,
  onMessageTouchStart,
  onMessageTouchEnd,
  onMessageTouchMove,
  onMessageClick,
  onReceiveTransfer,
  onDeleteTransfer,
  onQuoteMessage,
  onCopyMessage,
  onDeleteFromMessage,
  onDeleteSingleMessage,
  onClearLongPress,
  parseTransferCommand,
  removeTransferCommand,
  getBubbleStyle,
  getBubbleBackgroundStyle,
  getBubblePadding,
}: ChatMessageBubbleProps) => {
  // 计算时间分隔
  const { showTimeDivider, formattedTime } = useMemo(() => {
    const currentTime = new Date(msg.created_at);
    const prevTime = prevMsg ? new Date(prevMsg.created_at) : null;
    const shouldShow = prevTime && (currentTime.getTime() - prevTime.getTime() > 60000);
    return {
      showTimeDivider: shouldShow,
      formattedTime: shouldShow ? formatTime(currentTime) : '',
    };
  }, [msg.created_at, prevMsg?.created_at]);

  // 处理转账消息
  if (msg.role === 'transfer') {
    const transfer = msg.transferData || pendingTransfers.find((t: any) => msg.content.includes(t.id));
    if (!transfer) return null;
    
    const isUserGift = (transfer as any).is_user_transfer === true;
    const avatarFrame = isUserGift ? userAvatarFrame : friendAvatarFrame;
    const avatarUrl = isUserGift ? profile?.avatar_url : character?.avatar_url;
    const fallbackText = isUserGift ? (profile?.nickname?.charAt(0) || '我') : (character?.name?.charAt(0) || '?');
    
    return (
      <div key={msg.id} className={`flex items-end gap-2 ${isUserGift ? 'flex-row-reverse' : 'flex-row'}`}>
        <MessageAvatar 
          isUser={isUserGift}
          avatarUrl={avatarUrl}
          avatarFrame={avatarFrame}
          fallbackText={fallbackText}
        />
        {isUserGift ? (
          <UserTransferCard
            amount={Math.abs(Number(transfer.amount))}
            giftName={transfer.message?.replace('赠送了', '') || ''}
            characterName={character?.name || '角色'}
            message=""
          />
        ) : (
          <TransferCard
            amount={Number(transfer.amount)}
            characterName={transfer.character_name || character?.name || '角色'}
            message={transfer.message}
            isReceived={transfer.is_received}
            onReceive={() => onReceiveTransfer(transfer.id)}
            onDelete={() => onDeleteTransfer(transfer.id)}
          />
        )}
      </div>
    );
  }

  // 计算显示内容
  const { displayContent, transferData, isCallRecord, callType, callDuration, showBubble } = useMemo(() => {
    const transferCmd = msg.role === 'assistant' ? parseTransferCommand(msg.content) : null;
    const rawContent = transferCmd ? removeTransferCommand(msg.content) : msg.content;
    const content = msg.role === 'assistant' ? sanitizeMessageContent(rawContent) : rawContent;
    const shouldShowBubble = content && !content.startsWith('[STICKER:') && !(msg.image_url && content.startsWith('[图片]'));
    
    const callMatch = content?.match(/^\[((语音通话|视频通话))\]\s*通话时长\s*(\d{2}:\d{2})$/);
    
    return {
      displayContent: content,
      transferData: transferCmd,
      isCallRecord: !!callMatch,
      callType: callMatch?.[1],
      callDuration: callMatch?.[3],
      showBubble: shouldShowBubble,
    };
  }, [msg.content, msg.role, msg.image_url, parseTransferCommand, removeTransferCommand]);

  const avatarFrame = isUser ? userAvatarFrame : friendAvatarFrame;
  const avatarUrl = isUser ? profile?.avatar_url : character?.avatar_url;
  const fallbackText = isUser ? (profile?.nickname?.charAt(0) || '我') : (character?.name?.charAt(0) || '?');

  return (
    <React.Fragment key={msg.id}>
      {showTimeDivider && (
        <div className="flex justify-center py-2">
          <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {formattedTime}
          </span>
        </div>
      )}
      <div 
        className={`relative overflow-visible flex items-start gap-2 cursor-pointer select-none ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
        onTouchStart={onMessageTouchStart}
        onTouchEnd={onMessageTouchEnd}
        onTouchMove={onMessageTouchMove}
        onClick={onMessageClick}
      >
        <MessageAvatar 
          isUser={isUser}
          avatarUrl={avatarUrl}
          avatarFrame={avatarFrame}
          fallbackText={fallbackText}
        />
        
        <div className={`flex flex-col flex-1 min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
          {/* 图片消息 */}
          {msg.image_url && (
            <div className="mb-1.5 rounded-lg overflow-hidden bg-background shadow-sm max-w-[140px]">
              <img 
                src={msg.image_url} 
                alt="图片" 
                loading="lazy"
                decoding="async"
                className="w-full rounded-lg object-cover cursor-pointer hover:brightness-95 transition-all"
                style={{ maxHeight: '140px' }}
                onClick={() => window.open(msg.image_url, '_blank')}
              />
            </div>
          )}
          
          {/* 通话记录 */}
          {isCallRecord && callType && callDuration && (
            <CallRecordBubble callType={callType} duration={callDuration} />
          )}
          
          {/* 语音消息 */}
          {msg.audioBase64 && showBubble && !isCallRecord && (
            <VoiceMessageBubble
              audioBase64={msg.audioBase64}
              transcript={displayContent}
              isUser={isUser}
              bubbleColor={isUser ? userBubbleColor : friendBubbleColor}
              fontColor={isUser ? fontColor : friendFontColor}
              bubbleStyle={{
                ...getBubbleBackgroundStyle(isUser),
                opacity: bubbleOpacity,
              }}
            />
          )}
          
          {/* 普通文本气泡 */}
          {showBubble && !msg.audioBase64 && !isCallRecord && (
            <div
              className={getBubbleStyle(isUser)}
              style={{
                ...getBubbleBackgroundStyle(isUser),
                opacity: bubbleOpacity,
                color: isUser ? fontColor : friendFontColor,
                fontSize: `${bubbleSize}px`,
                writingMode: 'horizontal-tb',
                textOrientation: 'mixed',
                direction: 'ltr',
                textAlign: 'left',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                width: 'fit-content',
                padding: getBubblePadding(bubbleSize),
              }}
            >
              {/* 气泡装饰 */}
              {isUser && userBubbleDecorImage && (
                <img src={userBubbleDecorImage} alt="" className="absolute -top-2 -right-2 w-5 h-5 object-contain z-20 pointer-events-none drop-shadow-sm" />
              )}
              {isUser && !userBubbleDecorImage && userBubbleDecor && (
                <span className="absolute -top-2 -right-2 text-sm drop-shadow-sm z-20">{userBubbleDecor}</span>
              )}
              {!isUser && friendBubbleDecorImage && (
                <img src={friendBubbleDecorImage} alt="" className="absolute -top-2 -left-2 w-5 h-5 object-contain z-20 pointer-events-none drop-shadow-sm" />
              )}
              {!isUser && !friendBubbleDecorImage && friendBubbleDecor && (
                <span className="absolute -top-2 -left-2 text-sm drop-shadow-sm z-20">{friendBubbleDecor}</span>
              )}

              {/* 引用内容 */}
              {msg.quotedMessage && (
                <div 
                  className="mb-1.5 pb-1.5 border-b border-current/20 text-xs opacity-70"
                  style={{ fontSize: `${Math.max(bubbleSize - 2, 10)}px` }}
                >
                  <span className="text-pink-500 font-medium">
                    回复 {msg.quotedMessage.role === 'user' ? (profile?.nickname || '我') : character?.name}：
                  </span>
                  <span className="ml-1">
                    {msg.quotedMessage.content?.slice(0, 30)}{(msg.quotedMessage.content?.length || 0) > 30 ? '...' : ''}
                  </span>
                </div>
              )}

              <span className="relative z-10" style={{ display: 'inline' }}>
                {!isUser && replyMode === 'novel' ? (
                  <NovelModeText
                    content={displayContent.replace(/^\[引用: ".*?"\]\n?/s, '')}
                    baseColor={friendFontColor}
                    dialogueColor={(customization as any)?.novel_dialogue_color || '#e91e63'}
                    narrationColor={(customization as any)?.novel_narration_color || '#666666'}
                    actionColor={(customization as any)?.novel_action_color || '#9c27b0'}
                    thoughtColor={(customization as any)?.novel_thought_color || '#607d8b'}
                    fontSize={bubbleSize}
                  />
                ) : (
                  displayContent.replace(/^\[引用: ".*?"\]\n?/s, '')
                )}
              </span>
            </div>
          )}
          
          {/* 内联转账卡片 */}
          {transferData && (
            <div className="mt-2">
              <TransferCard
                amount={transferData.amount}
                characterName={character?.name || '角色'}
                message={transferData.message}
                isReceived={false}
                onReceive={() => {}}
              />
            </div>
          )}
          
          {/* 已读状态 */}
          {isUser && (
            <span className="text-[10px] text-muted-foreground/70 mt-0.5">已读</span>
          )}
          
          {/* 拉黑期间消息标记 */}
          {!isUser && blockedAt && new Date(msg.created_at) >= new Date(blockedAt) && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-muted-foreground/50">发送失败</span>
              <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">!</span>
            </div>
          )}
        </div>
        
        {/* 长按菜单 */}
        {isLongPressed && (
          <LongPressMenu
            isUser={isUser}
            onQuote={onQuoteMessage}
            onCopy={onCopyMessage}
            onDelete={onDeleteFromMessage}
            onDeleteSingle={onDeleteSingleMessage}
            onClose={onClearLongPress}
          />
        )}
      </div>
    </React.Fragment>
  );
});

ChatMessageBubble.displayName = 'ChatMessageBubble';

export default ChatMessageBubble;
