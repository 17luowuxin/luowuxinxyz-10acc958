import React from 'react';
import { Loader2, X, ImageIcon } from 'lucide-react';
import { usePendingImageActions } from '@/lib/pendingChatImage';

interface Props {
  msg: any;
  prompt: string;
}

const PendingImageCard: React.FC<Props> = ({ msg, prompt }) => {
  const actions = usePendingImageActions();
  const isGenerating = actions ? actions.generatingIds.some((id) => String(id) === String(msg.id)) : false;

  return (
    <div
      className="relative mb-1.5 w-[180px] rounded-xl border-2 border-dashed border-primary/35 bg-primary/5 p-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="删除这张待生成配图"
        disabled={isGenerating}
        onClick={() => actions?.onDiscard(msg)}
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm hover:text-destructive disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <ImageIcon className="h-3.5 w-3.5" />
        <span>待生成配图</span>
      </div>
      <p className="line-clamp-4 break-words pr-5 text-[11px] leading-relaxed text-muted-foreground">
        {prompt}
      </p>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={isGenerating}
          onClick={() => actions?.onGenerate(msg)}
          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground shadow-sm disabled:opacity-70"
        >
          {isGenerating && <Loader2 className="h-3 w-3 animate-spin" />}
          {isGenerating ? '生成中' : '生成'}
        </button>
      </div>
    </div>
  );
};

export default PendingImageCard;
