import { getLocalAssetUrl, getLocalTable } from '@/lib/localDataStore';

export interface FontChoice {
  id: string;
  name: string;
  family: string;
  preview: string;
  sourceUrl?: string;
}

export const BUILT_IN_FONTS: FontChoice[] = [
  { id: 'default', name: '默认', family: 'Nunito, sans-serif', preview: 'Aa 你好' },
  { id: 'kuaile', name: '快乐体', family: '"ZCOOL KuaiLe", cursive', preview: 'Aa 你好' },
  { id: 'mashan', name: '马善政楷', family: '"Ma Shan Zheng", cursive', preview: 'Aa 你好' },
  { id: 'xiaowei', name: '小薇体', family: '"ZCOOL XiaoWei", serif', preview: 'Aa 你好' },
  { id: 'liujian', name: '刘建毛草', family: '"Liu Jian Mao Cao", cursive', preview: 'Aa 你好' },
  { id: 'longcang', name: '龙藏体', family: '"Long Cang", cursive', preview: 'Aa 你好' },
];

const customFontFamily = (id: string) => `dream-font-${id.replace(/[^a-zA-Z0-9-]/g, '')}`;

export async function loadCustomFonts(userId: string): Promise<FontChoice[]> {
  const rows = await getLocalTable(userId, 'custom_fonts');
  return Promise.all(rows.map(async (row) => {
    const id = String(row.id || '');
    const sourceUrl = String(row.source_url || '');
    return {
      id,
      name: String(row.name || '自定义字体'),
      family: `"${customFontFamily(id)}", sans-serif`,
      preview: 'Aa 你好',
      sourceUrl: sourceUrl ? await getLocalAssetUrl(userId, sourceUrl) : undefined,
    };
  }));
}

export function applyFontChoice(font: FontChoice): void {
  const oldFontFace = document.getElementById('custom-font-face-style');
  oldFontFace?.remove();

  if (font.sourceUrl) {
    const fontFace = document.createElement('style');
    fontFace.id = 'custom-font-face-style';
    fontFace.textContent = `@font-face { font-family: ${font.family.split(',')[0]}; src: url("${font.sourceUrl}"); font-display: swap; }`;
    document.head.appendChild(fontFace);
  }

  document.documentElement.style.fontFamily = font.family;
  document.body.style.fontFamily = font.family;
  const style = document.getElementById('global-font-style') || document.createElement('style');
  style.id = 'global-font-style';
  style.textContent = `*:not([data-font-preview]) { font-family: ${font.family} !important; }`;
  if (!style.parentNode) document.head.appendChild(style);
  localStorage.setItem('selectedFont', font.id);
}

export async function applyStoredFont(fontId: string, userId?: string): Promise<void> {
  const builtIn = BUILT_IN_FONTS.find((font) => font.id === fontId);
  if (builtIn) {
    applyFontChoice(builtIn);
    return;
  }
  if (!userId) return;
  const custom = (await loadCustomFonts(userId)).find((font) => font.id === fontId);
  if (custom) applyFontChoice(custom);
}
