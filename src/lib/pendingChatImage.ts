import { createContext, useContext } from 'react';

export const PENDING_IMAGE_PREFIX = '[PENDING_IMAGE]';

export const buildPendingImageContent = (prompt: string) => `${PENDING_IMAGE_PREFIX}${prompt}`;

export const parsePendingImagePrompt = (content: unknown): string | null => {
  if (typeof content !== 'string') return null;
  if (!content.startsWith(PENDING_IMAGE_PREFIX)) return null;
  const prompt = content.slice(PENDING_IMAGE_PREFIX.length).trim();
  return prompt || '（无描述）';
};

export interface PendingImageActions {
  generatingIds: Array<string | number>;
  onGenerate: (msg: any) => void;
  onDiscard: (msg: any) => void;
}

export const PendingImageContext = createContext<PendingImageActions | null>(null);

export const usePendingImageActions = () => useContext(PendingImageContext);
