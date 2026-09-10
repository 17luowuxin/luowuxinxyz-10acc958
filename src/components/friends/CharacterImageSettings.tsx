import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { isLocalModeEnabled } from '@/lib/localDataStore';
import {
  ART_STYLE_PRESETS,
  CharacterImageConfig,
  EMPTY_CHARACTER_IMAGE_CONFIG,
  loadCharacterImageConfig,
  saveCharacterImageConfig,
} from '@/lib/characterImageConfig';

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsDataURL(blob);
  });

interface Props {
  userId: string;
  characterId: string;
}

const CharacterImageSettings: React.FC<Props> = ({ userId, characterId }) => {
  const [config, setConfig] = useState<CharacterImageConfig>(EMPTY_CHARACTER_IMAGE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadCharacterImageConfig(userId, characterId)
      .then((value) => { if (active) setConfig(value); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [characterId, userId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setUploading(true);
    try {
      const { compressImage, blobToFile } = await import('@/utils/imageCompressor');
      const compressed = await compressImage(file, 768, 0.8);
      let url: string;

      if (await isLocalModeEnabled(userId)) {
        url = await blobToDataUrl(compressed);
      } else {
        const path = `${userId}/character-ref/${characterId}-${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from('avatars')
          .upload(path, blobToFile(compressed, 'ref.jpg'), { upsert: true });
        if (error) throw error;
        url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }

      setConfig((prev) => ({ ...prev, referenceImage: url }));
      toast.success('垫图已上传，记得点击保存');
    } catch (error) {
      toast.error('垫图上传失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const error = await saveCharacterImageConfig(userId, characterId, config);
    setSaving(false);
    if (error) {
      toast.error('保存失败：' + error.message);
      return;
    }
    toast.success('角色形象已保存', { duration: 1500 });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-pink-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium text-gray-700 text-sm mb-1">垫图（参考图）</p>
        <p className="text-xs text-gray-400 mb-2">用于自拍类配图的图生图参考，接口不支持时会自动改用文字生成</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => inputRef.current?.click()}
            className="w-24 h-24 rounded-2xl bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center overflow-hidden"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            ) : config.referenceImage ? (
              <img src={config.referenceImage} alt="垫图" className="w-full h-full object-cover" />
            ) : (
              <Plus className="w-6 h-6 text-gray-400" />
            )}
          </button>
          {config.referenceImage && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 rounded-xl"
              onClick={() => setConfig((prev) => ({ ...prev, referenceImage: '' }))}
            >
              <X className="w-4 h-4 mr-1" /> 移除
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </div>

      <div>
        <p className="font-medium text-gray-700 text-sm mb-1">角色形象描述</p>
        <Textarea
          rows={3}
          placeholder="例如：黑色长发，浅琥珀色眼睛，白衬衫，清冷少年感"
          value={config.appearance}
          onChange={(e) => setConfig((prev) => ({ ...prev, appearance: e.target.value }))}
          className="rounded-xl bg-gray-50 border-gray-200"
        />
      </div>

      <div>
        <p className="font-medium text-gray-700 text-sm mb-2">画风</p>
        <div className="grid grid-cols-3 gap-2">
          {ART_STYLE_PRESETS.map((style) => {
            const active = config.artStyle === style.prompt;
            return (
              <button
                key={style.id}
                onClick={() => setConfig((prev) => ({ ...prev, artStyle: active ? '' : style.prompt }))}
                className={`py-2 rounded-xl text-xs font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {style.name}
              </button>
            );
          })}
        </div>
        <Input
          placeholder="自定义画风提示词（可选）"
          value={config.artStyle}
          onChange={(e) => setConfig((prev) => ({ ...prev, artStyle: e.target.value }))}
          className="mt-2 rounded-xl bg-gray-50 border-gray-200"
        />
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-400">
        <ImageIcon className="w-4 h-4 mt-0.5 shrink-0" />
        <span>发空间动态时会自动配图，由AI判断这条动态适合自拍还是场景图。</span>
      </div>

      <Button
        className="w-full rounded-xl py-6 bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? '保存中...' : '保存形象设置'}
      </Button>
    </div>
  );
};

export default CharacterImageSettings;
