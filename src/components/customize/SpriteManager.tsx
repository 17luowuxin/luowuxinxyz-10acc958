import React, { useState, useEffect, useRef } from 'react';
import { User, Upload, X, Image, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { deleteLocalRows, getLocalTable, insertLocalRow, isLocalModeEnabled, updateLocalRows } from '@/lib/localDataStore';

const fileToDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('读取本机文件失败'));
    reader.readAsDataURL(file);
  });

interface Character {
  id: string;
  name: string;
  avatar_url: string | null;
  sprite_url: string | null;
}

interface Sprite {
  id: string;
  character_id: string;
  emotion: string;
  sprite_url: string;
}

const emotions = [
  { id: 'normal', name: '普通', emoji: '😐' },
  { id: 'happy', name: '开心', emoji: '😊' },
  { id: 'sad', name: '难过', emoji: '😢' },
  { id: 'angry', name: '生气', emoji: '😠' },
  { id: 'shy', name: '害羞', emoji: '😳' },
  { id: 'surprised', name: '惊讶', emoji: '😮' },
];

const SpriteManager: React.FC = () => {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState('normal');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainSpriteInputRef = useRef<HTMLInputElement>(null);
  const [localMode, setLocalMode] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLocalMode(null);
      return;
    }
    isLocalModeEnabled(user.id).then(setLocalMode).catch(() => setLocalMode(false));
  }, [user?.id]);

  useEffect(() => {
    if (user && localMode !== null) {
      fetchCharacters();
    }
  }, [user, localMode]);

  useEffect(() => {
    if (selectedCharacter) {
      fetchSprites(selectedCharacter.id);
    }
  }, [selectedCharacter]);

  const fetchCharacters = async () => {
    if (localMode && user?.id) {
      const data = await getLocalTable(user.id, 'characters');
      setCharacters(data as unknown as Character[]);
      if (data.length > 0 && !selectedCharacter) setSelectedCharacter(data[0] as unknown as Character);
      return;
    }
    const { data } = await supabase
      .from('characters')
      .select('id, name, avatar_url, sprite_url')
      .eq('user_id', user?.id);
    if (data) {
      setCharacters(data);
      if (data.length > 0 && !selectedCharacter) {
        setSelectedCharacter(data[0]);
      }
    }
  };

  const fetchSprites = async (characterId: string) => {
    if (localMode && user?.id) {
      const data = (await getLocalTable(user.id, 'character_sprites')).filter((row) => row.character_id === characterId);
      setSprites(data as unknown as Sprite[]);
      return;
    }
    const { data } = await supabase
      .from('character_sprites')
      .select('*')
      .eq('character_id', characterId)
      .eq('user_id', user?.id);
    if (data) {
      setSprites(data);
    }
  };

  const handleMainSpriteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedCharacter) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setUploading(true);
    toast.loading('上传立绘中...');

    try {
      if (localMode) {
        const localUrl = await fileToDataUrl(file);
        await updateLocalRows(user.id, 'characters', (row) => row.id === selectedCharacter.id, { sprite_url: localUrl });
        setSelectedCharacter({ ...selectedCharacter, sprite_url: localUrl });
        await fetchCharacters();
        toast.dismiss();
        toast.success('主立绘已保存到本机');
        return;
      }

      const fileName = `${user.id}/sprites/${selectedCharacter.id}/main-${Date.now()}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // 更新角色主立绘
      await supabase
        .from('characters')
        .update({ sprite_url: publicUrl })
        .eq('id', selectedCharacter.id);

      setSelectedCharacter({ ...selectedCharacter, sprite_url: publicUrl });
      fetchCharacters();
      toast.dismiss();
      toast.success('主立绘上传成功');
    } catch (error) {
      toast.dismiss();
      toast.error('上传失败');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleEmotionSpriteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedCharacter) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setUploading(true);
    toast.loading('上传表情立绘中...');

    try {
      if (localMode) {
        const localUrl = await fileToDataUrl(file);
        const existing = sprites.find((sprite) => sprite.emotion === selectedEmotion);
        if (existing) {
          await updateLocalRows(user.id, 'character_sprites', (row) => row.id === existing.id, { sprite_url: localUrl });
        } else {
          await insertLocalRow(user.id, 'character_sprites', {
            character_id: selectedCharacter.id,
            user_id: user.id,
            emotion: selectedEmotion,
            sprite_url: localUrl,
          });
        }
        await fetchSprites(selectedCharacter.id);
        toast.dismiss();
        toast.success(`${emotions.find((emotion) => emotion.id === selectedEmotion)?.name}表情已保存到本机`);
        return;
      }

      const fileName = `${user.id}/sprites/${selectedCharacter.id}/${selectedEmotion}-${Date.now()}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // 检查是否已有该表情
      const existing = sprites.find(s => s.emotion === selectedEmotion);
      
      if (existing) {
        await supabase
          .from('character_sprites')
          .update({ sprite_url: publicUrl })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('character_sprites')
          .insert({
            character_id: selectedCharacter.id,
            user_id: user.id,
            emotion: selectedEmotion,
            sprite_url: publicUrl
          });
      }

      fetchSprites(selectedCharacter.id);
      toast.dismiss();
      toast.success(`${emotions.find(e => e.id === selectedEmotion)?.name}表情上传成功`);
    } catch (error) {
      toast.dismiss();
      toast.error('上传失败');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSprite = async (spriteId: string) => {
    try {
      if (localMode && user?.id) await deleteLocalRows(user.id, 'character_sprites', (row) => row.id === spriteId);
      else await supabase.from('character_sprites').delete().eq('id', spriteId);
      setSprites(sprites.filter(s => s.id !== spriteId));
      toast.success('已删除');
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const handleClearMainSprite = async () => {
    if (!selectedCharacter) return;
    if (localMode && user?.id) {
      await updateLocalRows(user.id, 'characters', (row) => row.id === selectedCharacter.id, { sprite_url: null });
    } else {
      await supabase.from('characters').update({ sprite_url: null }).eq('id', selectedCharacter.id);
    }
    
    setSelectedCharacter({ ...selectedCharacter, sprite_url: null });
    fetchCharacters();
    toast.success('已清除主立绘');
  };

  if (characters.length === 0) {
    return (
      <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
        <div className="flex items-center gap-2 mb-4">
          <Image className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg">角色立绘管理</h3>
        </div>
        <p className="text-muted-foreground text-center py-8">
          暂无角色，请先创建角色
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
      <div className="flex items-center gap-2 mb-4">
        <Image className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-lg">角色立绘管理</h3>
      </div>
      <p className="text-muted-foreground text-sm mb-4">
        为角色上传立绘，用于视觉小说模式
      </p>

      {/* 角色选择 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {characters.map(char => (
          <button
            key={char.id}
            onClick={() => setSelectedCharacter(char)}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
              selectedCharacter?.id === char.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 hover:bg-muted'
            }`}
          >
            {char.avatar_url ? (
              <img src={char.avatar_url} alt={char.name} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <User className="w-5 h-5" />
            )}
            <span className="text-sm whitespace-nowrap">{char.name}</span>
          </button>
        ))}
      </div>

      {selectedCharacter && (
        <div className="space-y-4">
          {/* 主立绘 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">主立绘（默认）</p>
              {selectedCharacter.sprite_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearMainSprite}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full h-7 px-2"
                >
                  <X className="w-3 h-3 mr-1" />
                  清除
                </Button>
              )}
            </div>
            <div
              onClick={() => mainSpriteInputRef.current?.click()}
              className="border-2 border-dashed border-primary/30 rounded-2xl p-4 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-primary/5 min-h-[150px]"
            >
              {selectedCharacter.sprite_url ? (
                <div className="relative">
                  <img
                    src={selectedCharacter.sprite_url}
                    alt="主立绘"
                    className="max-h-[200px] object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-sm">点击更换</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-primary">
                  <Upload className="w-8 h-8 mb-2" />
                  <span className="text-sm">{uploading ? '上传中...' : '点击上传主立绘'}</span>
                  <span className="text-xs text-muted-foreground mt-1">建议使用透明PNG</span>
                </div>
              )}
            </div>
            <input
              ref={mainSpriteInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleMainSpriteUpload}
            />
          </div>

          {/* 表情立绘 */}
          <div>
            <p className="text-sm font-medium mb-2">表情立绘（可选）</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {emotions.map(emotion => {
                const hasSprite = sprites.some(s => s.emotion === emotion.id);
                return (
                  <button
                    key={emotion.id}
                    onClick={() => setSelectedEmotion(emotion.id)}
                    className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 transition-all ${
                      selectedEmotion === emotion.id
                        ? 'bg-primary text-primary-foreground'
                        : hasSprite
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <span>{emotion.emoji}</span>
                    <span>{emotion.name}</span>
                  </button>
                );
              })}
            </div>

            {/* 当前表情预览/上传 */}
            <div className="grid grid-cols-3 gap-2">
              {emotions.map(emotion => {
                const sprite = sprites.find(s => s.emotion === emotion.id);
                return (
                  <div
                    key={emotion.id}
                    className={`relative border-2 rounded-xl p-2 min-h-[80px] flex flex-col items-center justify-center ${
                      selectedEmotion === emotion.id ? 'border-primary' : 'border-muted'
                    }`}
                  >
                    {sprite ? (
                      <>
                        <img
                          src={sprite.sprite_url}
                          alt={emotion.name}
                          className="max-h-[60px] object-contain"
                        />
                        <button
                          onClick={() => handleDeleteSprite(sprite.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedEmotion(emotion.id);
                          fileInputRef.current?.click();
                        }}
                        className="flex flex-col items-center text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="text-xs">{emotion.emoji}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleEmotionSpriteUpload}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SpriteManager;
