export interface StickerImportItem {
  lineNumber: number;
  url: string;
  keywords: string[];
}

// 微信等应用复制的文本可能包含中文冒号、空格、空行或零宽空格。
export function parseStickerImport(text: string) {
  const items: StickerImportItem[] = [];
  const invalidLines: number[] = [];
  const lines = text.split(/\r\n?|\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.replace(/[\u200B\uFEFF]/g, '').trim();
    if (!line) return;

    const match = line.match(/^(?:(.*?)[:：]\s*)?(https?:\/\/\S+)$/i);
    if (!match) {
      invalidLines.push(index + 1);
      return;
    }

    let url: URL;
    try {
      url = new URL(match[2]);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
        throw new Error('Invalid image URL');
      }
    } catch {
      invalidLines.push(index + 1);
      return;
    }

    const keywords = (match[1] || '').split(/[\/、,，]/).map(word => word.trim()).filter(Boolean);
    if (keywords.length === 0) {
      const fileName = url.pathname.split('/').pop() || '';
      const name = fileName.replace(/\.[^/.]+$/, '');
      keywords.push(name && name.length < 20 ? name : '自定义表情');
    }
    items.push({
      lineNumber: index + 1,
      url: match[2],
      keywords: [...new Set([...keywords, '表情', '表情包'])],
    });
  });

  return { items, invalidLines, lines };
}
