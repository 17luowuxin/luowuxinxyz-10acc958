import React, { useState } from 'react';
import dreamFrame from '@/assets/avatar-frames/dream-frame.png';

// 内置资源的构建文件名会变化；只兼容旧内置头像框，不替换用户图片。
export function resolveAvatarFrame(source: string | null | undefined): string {
  if (!source) return '';
  try {
    const path = new URL(source, 'https://local.invalid').pathname;
    if (/^\/assets\/dream-frame(?:-[\w-]+)?\.png$/.test(path)) return dreamFrame;
  } catch {
    // 不改写自定义链接，加载失败时由图片组件隐藏装饰。
  }
  return source;
}

const FrameImage = ({ src, className }: { src: string; className: string }) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  if (status === 'error') return null;
  return (
    <img
      src={src}
      alt=""
      className={className}
      style={{ visibility: status === 'loaded' ? 'visible' : 'hidden' }}
      onLoad={() => setStatus('loaded')}
      onError={() => setStatus('error')}
    />
  );
};

export const AvatarFrameImage = ({ source, className }: { source: string | null; className: string }) => {
  const src = resolveAvatarFrame(source);
  return src ? <FrameImage key={src} src={src} className={className} /> : null;
};
