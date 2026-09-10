import { supabase } from '@/lib/supabase';
import { deleteLocalRows, getLocalTable, insertLocalRow, isLocalModeEnabled } from '@/lib/localDataStore';

export interface CharacterImageConfig {
  referenceImage: string;
  appearance: string;
  artStyle: string;
}

export const EMPTY_CHARACTER_IMAGE_CONFIG: CharacterImageConfig = {
  referenceImage: '',
  appearance: '',
  artStyle: '',
};

export const ART_STYLE_PRESETS: Array<{ id: string; name: string; prompt: string }> = [
  { id: 'anime', name: '日系动漫', prompt: 'anime style, japanese anime illustration, clean lineart, vibrant colors' },
  { id: 'guofeng', name: '国风古风', prompt: 'chinese ancient style illustration, guofeng, ink wash accents, elegant hanfu' },
  { id: 'realistic', name: '真人写实', prompt: 'photorealistic, real person photography, natural lighting, 85mm lens' },
  { id: 'jkpainting', name: '厚涂插画', prompt: 'semi-realistic digital painting, thick brush strokes, cinematic lighting' },
  { id: 'watercolor', name: '水彩清新', prompt: 'soft watercolor illustration, pastel palette, gentle light' },
  { id: 'cute', name: 'Q版可爱', prompt: 'chibi cute style, big eyes, soft shading, kawaii' },
];

const providerKey = (characterId: string) => `char_image_${characterId}`;

const parseConfig = (raw: unknown): CharacterImageConfig => {
  if (typeof raw !== 'string' || !raw.trim()) return { ...EMPTY_CHARACTER_IMAGE_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<CharacterImageConfig>;
    return {
      referenceImage: typeof parsed.referenceImage === 'string' ? parsed.referenceImage : '',
      appearance: typeof parsed.appearance === 'string' ? parsed.appearance : '',
      artStyle: typeof parsed.artStyle === 'string' ? parsed.artStyle : '',
    };
  } catch {
    return { ...EMPTY_CHARACTER_IMAGE_CONFIG };
  }
};

export async function loadCharacterImageConfig(userId: string, characterId: string): Promise<CharacterImageConfig> {
  if (!userId || !characterId) return { ...EMPTY_CHARACTER_IMAGE_CONFIG };
  const provider = providerKey(characterId);

  try {
    if (await isLocalModeEnabled(userId)) {
      const rows = await getLocalTable(userId, 'api_keys');
      const row = rows.filter((item: any) => item.provider === provider).pop();
      return parseConfig(row?.api_key);
    }
    const { data } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('user_id', userId)
      .eq('provider', provider)
      .limit(1);
    return parseConfig(data?.[0]?.api_key);
  } catch {
    return { ...EMPTY_CHARACTER_IMAGE_CONFIG };
  }
}

export async function saveCharacterImageConfig(
  userId: string,
  characterId: string,
  config: CharacterImageConfig,
): Promise<Error | null> {
  if (!userId || !characterId) return new Error('缺少角色信息');
  const provider = providerKey(characterId);
  const value = JSON.stringify(config);

  if (await isLocalModeEnabled(userId)) {
    await deleteLocalRows(userId, 'api_keys', (row: any) => row.user_id === userId && row.provider === provider);
    await insertLocalRow(userId, 'api_keys', { user_id: userId, provider, api_key: value });
    return null;
  }

  const { error: upsertError } = await supabase
    .from('api_keys')
    .upsert({ user_id: userId, provider, api_key: value }, { onConflict: 'user_id,provider' } as any)
    .select();
  if (!upsertError) return null;

  await supabase.from('api_keys').delete().eq('user_id', userId).eq('provider', provider);
  const { error: insertError } = await supabase.from('api_keys').insert({ user_id: userId, provider, api_key: value });
  return insertError ? new Error(insertError.message) : null;
}
