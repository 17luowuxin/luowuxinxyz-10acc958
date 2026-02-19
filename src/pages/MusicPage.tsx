import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Music, Play, Pause, Upload, Repeat, Repeat1, SkipBack, SkipForward, Edit2, Image, Check, X, Trash2, Shuffle, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useMusicPlayer } from '@/contexts/MusicContext';
import { toast } from 'sonner';

const MusicPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    tracks,
    currentTrack,
    currentTrackIndex,
    playing,
    isLoading,
    loopMode,
    currentTime,
    duration,
    defaultCoverUrl,
    saveDefaultCover,
    playTrack,
    togglePlay,
    prevTrack,
    nextTrack,
    cycleLoopMode,
    seekTo,
    fetchTracks,
  } = useMusicPlayer();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [selectedTrackIdForCover, setSelectedTrackIdForCover] = useState<string | null>(null);
  const [showTrackList, setShowTrackList] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    // 限制文件大小为 500MB
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('音乐文件过大，最大支持 500MB');
      if (audioInputRef.current) audioInputRef.current.value = '';
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${user.id}/${Date.now()}_${safeName}`;
      
      // 使用SDK上传，显示简单进度动画
      const uploadPromise = supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });
      
      // 简单进度动画，每秒+1，最多到95
      const progressTimer = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) { clearInterval(progressTimer); return 95; }
          return prev + 1;
        });
      }, 1000);
      
      const { error: uploadError } = await uploadPromise;
      clearInterval(progressTimer);
      
      if (uploadError) throw uploadError;
      setUploadProgress(100);
      
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      
      const title = file.name.replace(/\.[^/.]+$/, '');
      const { error: insertError } = await supabase
        .from('music')
        .insert({ 
          title, 
          audio_url: urlData.publicUrl, 
          user_id: user.id,
          cover_url: defaultCoverUrl
        });
      
      if (insertError) throw insertError;
      
      toast.success('音乐上传成功');
      fetchTracks();
    } catch (err: any) {
      toast.error('上传失败: ' + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  const [uploadingCover, setUploadingCover] = useState(false);

  // 压缩图片函数
  const compressImage = (file: File, maxWidth = 800, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('压缩失败')),
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const trackId = selectedTrackIdForCover;
    if (!file || !user) return;
    
    setUploadingCover(true);
    
    try {
      // 压缩图片
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
      
      const fileName = `${user.id}/covers/${Date.now()}_${compressedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedFile);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;
      
      if (trackId) {
        const { error: updateError } = await supabase
          .from('music')
          .update({ cover_url: publicUrl })
          .eq('id', trackId)
          .eq('user_id', user.id);
        
        if (updateError) throw updateError;
        
        await fetchTracks();
        toast.success('封面已更新');
      } else {
        await saveDefaultCover(publicUrl);
        toast.success('唱片封面已保存');
      }
    } catch (err: any) {
      console.error('Cover upload error:', err);
      toast.error('封面上传失败: ' + err.message);
    } finally {
      setUploadingCover(false);
    }
    if (coverInputRef.current) coverInputRef.current.value = '';
    setSelectedTrackIdForCover(null);
  };

  const handleUpdateTitle = async (trackId: string) => {
    if (!editTitle.trim()) return;
    await supabase.from('music').update({ title: editTitle }).eq('id', trackId);
    setEditingId(null);
    setEditTitle('');
    fetchTracks();
    toast.success('歌曲名已更新');
  };

  const handleDelete = async (trackId: string) => {
    await supabase.from('music').delete().eq('id', trackId);
    fetchTracks();
    toast.success('已删除');
  };

  const handleLoopMode = () => {
    cycleLoopMode();
    const modeNames = { none: '顺序播放', single: '单曲循环', all: '列表循环' };
    const modes = ['none', 'single', 'all'] as const;
    const currentIdx = modes.indexOf(loopMode);
    const newMode = modes[(currentIdx + 1) % modes.length];
    toast.success(modeNames[newMode]);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    seekTo(newTime);
  };

  const handleProgressDrag = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const newTime = percent * duration;
    seekTo(newTime);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const triggerCoverUpload = (trackId: string | null) => {
    setSelectedTrackIdForCover(trackId);
    setTimeout(() => coverInputRef.current?.click(), 0);
  };

  const displayCoverUrl = currentTrack?.cover_url || defaultCoverUrl;

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 flex-shrink-0">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold ml-2">音乐</h1>
        </div>
        <label className="cursor-pointer">
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={handleAudioUpload}
            className="hidden"
          />
          <Button variant="ghost" size="icon" disabled={uploading} asChild>
            <span className="relative">
              {uploading ? (
                <div className="flex items-center gap-1">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-primary">{uploadProgress}%</span>
                </div>
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </span>
          </Button>
        </label>
      </div>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverUpload}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col items-center py-4">
          <div className="relative">
            <div className="absolute inset-0 w-40 h-40 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-xl" />
            
            <motion.div
              animate={{ rotate: playing ? 360 : 0 }}
              transition={{ repeat: playing ? Infinity : 0, duration: 8, ease: 'linear' }}
              className="relative w-40 h-40 rounded-full shadow-2xl overflow-hidden cursor-pointer group"
              onClick={() => triggerCoverUpload(currentTrack?.id || null)}
            >
              {displayCoverUrl ? (
                <img 
                  src={displayCoverUrl} 
                  alt="封面"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Music className="w-12 h-12 text-primary-foreground/70" />
                </div>
              )}
              
              {uploadingCover ? (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                  <div className="text-center text-white">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                    <span className="text-xs">上传中...</span>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <div className="text-center text-white">
                    <Image className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-xs">点击上传封面</span>
                  </div>
                </div>
              )}
              
              <div className="absolute inset-0 rounded-full pointer-events-none">
                <div className="absolute inset-0 rounded-full border-2 border-black/20" />
                <div className="absolute inset-[15%] rounded-full border border-black/10" />
                <div className="absolute inset-[30%] rounded-full border border-black/10" />
              </div>
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-zinc-900 border-2 border-zinc-600 shadow-inner" />
            </motion.div>
          </div>

          <p className="mt-4 text-lg font-bold text-foreground truncate max-w-[250px]">
            {currentTrack?.title || '未选择歌曲'}
          </p>
          
          <div className="w-full max-w-xs mt-4 px-2">
            <div 
              ref={progressRef}
              className="relative h-1.5 bg-muted rounded-full cursor-pointer group"
              onClick={handleProgressClick}
              onTouchStart={() => setIsDragging(true)}
              onTouchMove={handleProgressDrag}
              onTouchEnd={() => setIsDragging(false)}
            >
              <div 
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress}% - 8px)` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLoopMode}
              className={loopMode !== 'none' ? 'text-primary' : 'text-muted-foreground'}
            >
              {loopMode === 'single' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </Button>
            
            <Button variant="ghost" size="icon" onClick={prevTrack} className="w-12 h-12">
              <SkipBack className="w-6 h-6" />
            </Button>
            
            <Button
              variant="candy"
              size="lg"
              className="w-16 h-16 rounded-full shadow-lg"
              onClick={togglePlay}
              disabled={!currentTrack}
            >
              {isLoading ? (
                <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : playing ? (
                <Pause className="w-8 h-8" />
              ) : (
                <Play className="w-8 h-8 ml-1" />
              )}
            </Button>
            
            <Button variant="ghost" size="icon" onClick={nextTrack} className="w-12 h-12">
              <SkipForward className="w-6 h-6" />
            </Button>
            
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Shuffle className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={() => setShowTrackList(!showTrackList)}
            className="w-full flex items-center justify-between p-3 bg-card/60 rounded-2xl mb-2"
          >
            <span className="text-sm font-semibold text-muted-foreground">
              歌曲列表 ({tracks.length})
            </span>
            {showTrackList ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          
          {showTrackList && (
            <div className="space-y-2">
              {tracks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Music className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">暂无歌曲</p>
                  <p className="text-xs mt-1">点击右上角上传音乐</p>
                </div>
              ) : (
                tracks.map((track, index) => (
                  <div
                    key={track.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                      currentTrackIndex === index 
                        ? 'bg-primary/20 border border-primary/30' 
                        : 'bg-card/60 hover:bg-card/80'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer relative group"
                      style={{
                        background: track.cover_url 
                          ? `url(${track.cover_url}) center/cover` 
                          : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerCoverUpload(track.id);
                      }}
                    >
                      {!track.cover_url && <Music className="w-4 h-4 text-primary-foreground" />}
                      <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Image className="w-3 h-3" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0" onClick={() => playTrack(index)}>
                      {editingId === track.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle(track.id)}
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleUpdateTitle(track.id); }}>
                            <Check className="w-3 h-3 text-green-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="cursor-pointer">
                          <p className={`text-sm font-medium truncate ${currentTrackIndex === index ? 'text-primary' : 'text-foreground'}`}>
                            {track.title}
                          </p>
                          {currentTrackIndex === index && playing && (
                            <p className="text-xs text-primary/70 flex items-center gap-1">
                              <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                              正在播放
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {editingId !== track.id && (
                      <div className="flex items-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(track.id);
                            setEditTitle(track.title);
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(track.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MusicPage;
