import React, { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Upload, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Character {
  id: string;
  name: string;
  avatar_url: string | null;
  sprite_url: string | null;
}

const SpriteManager: React.FC = () => {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [uploading, setUploading] = useState(false);
  const mainSpriteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchCharacters = async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("id, name, avatar_url, sprite_url")
        .eq("user_id", user.id);

      if (error) {
        console.error(error);
        toast.error("角色加载失败");
        return;
      }

      setCharacters(data ?? []);
      if (!selectedCharacter && (data?.length ?? 0) > 0) {
        setSelectedCharacter(data![0]);
      }
    };

    fetchCharacters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const refreshSelected = async (characterId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("characters")
      .select("id, name, avatar_url, sprite_url")
      .eq("user_id", user.id)
      .eq("id", characterId)
      .maybeSingle();

    if (data) setSelectedCharacter(data);

    const { data: list } = await supabase
      .from("characters")
      .select("id, name, avatar_url, sprite_url")
      .eq("user_id", user.id);

    if (list) setCharacters(list);
  };

  const handleMainSpriteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedCharacter) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    setUploading(true);
    toast.loading("上传立绘中...");

    try {
      const fileName = `${user.id}/sprites/${selectedCharacter.id}/main-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("backgrounds")
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("backgrounds").getPublicUrl(fileName);

      const spriteUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("characters")
        .update({ sprite_url: spriteUrl })
        .eq("id", selectedCharacter.id)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      await refreshSelected(selectedCharacter.id);
      toast.dismiss();
      toast.success("立绘上传成功");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("上传失败");
    } finally {
      setUploading(false);
      if (mainSpriteInputRef.current) mainSpriteInputRef.current.value = "";
    }
  };

  const handleClearMainSprite = async () => {
    if (!user || !selectedCharacter) return;

    try {
      const { error } = await supabase
        .from("characters")
        .update({ sprite_url: null })
        .eq("id", selectedCharacter.id)
        .eq("user_id", user.id);

      if (error) throw error;

      await refreshSelected(selectedCharacter.id);
      toast.success("已清除立绘");
    } catch (err) {
      console.error(err);
      toast.error("清除失败");
    }
  };

  if (characters.length === 0) {
    return (
      <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">立绘管理</h2>
        </div>
        <p className="text-muted-foreground text-center py-8">暂无角色，请先创建角色</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-3xl p-5 shadow-card border border-primary/10">
      <div className="flex items-center gap-2 mb-1">
        <ImageIcon className="w-5 h-5 text-primary" />
        <h2 className="font-bold text-lg">立绘管理</h2>
      </div>
      <p className="text-muted-foreground text-sm mb-4">上传角色立绘，用于视觉小说对话展示</p>

      {/* 角色选择 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {characters.map((char) => (
          <button
            key={char.id}
            onClick={() => setSelectedCharacter(char)}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
              selectedCharacter?.id === char.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 hover:bg-muted"
            }`}
          >
            {char.avatar_url ? (
              <img
                src={char.avatar_url}
                alt={char.name}
                className="w-6 h-6 rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <User className="w-5 h-5" />
            )}
            <span className="text-sm whitespace-nowrap">{char.name}</span>
          </button>
        ))}
      </div>

      {selectedCharacter && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">当前立绘</p>
            {selectedCharacter.sprite_url && (
              <Button
                type="button"
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
            className="border-2 border-dashed border-primary/30 rounded-2xl p-4 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-primary/5 min-h-[180px]"
          >
            {selectedCharacter.sprite_url ? (
              <div className="relative w-full flex items-center justify-center">
                <img
                  src={selectedCharacter.sprite_url}
                  alt={`${selectedCharacter.name} 立绘`}
                  className="max-h-[260px] object-contain"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-sm text-primary">点击更换</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-primary">
                <Upload className="w-8 h-8 mb-2" />
                <span className="text-sm">{uploading ? "上传中..." : "点击上传立绘"}</span>
                <span className="text-xs text-muted-foreground mt-1">建议使用透明 PNG</span>
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
      )}
    </div>
  );
};

export default SpriteManager;
