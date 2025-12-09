import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Music, Play, Pause, Upload, Repeat, Repeat1, SkipBack, SkipForward, Edit2, Image, Check, X, Trash2, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface MusicTrack {
  id: string;
  title: string;
  audio_url: string;
  cover_url: string | null;
  user_id: string;
  created_at: string;
}

type LoopMode = 'none' | 'single' | 'all';

const MusicPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>('none');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [selectedTrackIdForCover, setSelectedTrackIdForCover] = useState<string | null>(null);

  const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;

  useEffect(() => {
    if (user) fetchTracks();
  }, [user]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
      }
    };

    const updateDuration = () => {
      setDuration(audio.duration || 0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
    };
  }, [isDragging, currentTrack]);

  const fetchTracks = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('music')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setTracks(data);
    if (error) console.error(error);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('music')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from('music').getPublicUrl(fileName);
      
      const title = file.name.replace(/\.[^/.]+$/, '');
      const { error: insertError } = await supabase
        .from('music')
        .insert({ title, audio_url: urlData.publicUrl, user_id: user.id });
      
      if (insertError) throw insertError;
      
      toast.success('音乐上传成功');
      fetchTracks();
    } catch (err: any) {
      toast.error('上传失败: ' + err.message);
    } finally {
      setUploading(false);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const trackId = selectedTrackIdForCover;
    if (!file || !user || !trackId) return;
    
    try {
      const fileName = `covers/${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('music')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from('music').getPublicUrl(fileName);
      
      await supabase
        .from('music')
        .update({ cover_url: urlData.publicUrl })
        .eq('id', trackId);
      
      toast.success('封面已更新');
      fetchTracks();
    } catch (err: any) {
      toast.error('封面上传失败');
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
    if (currentTrack?.id === trackId) {
      setCurrentTrackIndex(-1);
      setPlaying(false);
    }
    fetchTracks();
    toast.success('已删除');
  };

  const playTrack = (index: number) => {
    setCurrentTrackIndex(index);
    setPlaying(true);
    setCurrentTime(0);
    setTimeout(() => audioRef.current?.play(), 100);
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleEnded = () => {
    if (loopMode === 'single') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else if (loopMode === 'all' && tracks.length > 0) {
      const nextIndex = (currentTrackIndex + 1) % tracks.length;
      playTrack(nextIndex);
    } else if (currentTrackIndex < tracks.length - 1) {
      playTrack(currentTrackIndex + 1);
    } else {
      setPlaying(false);
    }
  };

  const prevTrack = () => {
    if (tracks.length === 0) return;
    const prevIndex = currentTrackIndex <= 0 ? tracks.length - 1 : currentTrackIndex - 1;
    playTrack(prevIndex);
  };

  const nextTrack = () => {
    if (tracks.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    playTrack(nextIndex);
  };

  const cycleLoopMode = () => {
    const modes: LoopMode[] = ['none', 'single', 'all'];
    const currentIndex = modes.indexOf(loopMode);
    const newMode = modes[(currentIndex + 1) % modes.length];
    setLoopMode(newMode);
    const modeNames = { none: '顺序播放', single: '单曲循环', all: '列表循环' };
    toast.success(modeNames[newMode]);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressDrag = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const newTime = percent * duration;
    setCurrentTime(newTime);
  };

  const handleProgressDragEnd = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = currentTime;
    }
    setIsDragging(false);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const triggerCoverUpload = (trackId: string) => {
    setSelectedTrackIdForCover(trackId);
    setTimeout(() => coverInputRef.current?.click(), 0);
  };

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
        {/* Upload Button in Header */}
        <label className="cursor-pointer">
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={handleAudioUpload}
            className="hidden"
          />
          <Button variant="ghost" size="icon" disabled={uploading} asChild>
            <span>
              {uploading ? (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </span>
          </Button>
        </label>
      </div>

      {/* Hidden cover input */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverUpload}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Rotating Disc - 网易云/QQ音乐风格 */}
        <div className="flex flex-col items-center py-4">
          <div className="relative">
            {/* 唱片背景光晕 */}
            <div className="absolute inset-0 w-56 h-56 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-xl" />
            
            {/* 旋转唱片 */}
            <motion.div
              animate={{ rotate: playing ? 360 : 0 }}
              transition={{ repeat: playing ? Infinity : 0, duration: 8, ease: 'linear' }}
              className="relative w-56 h-56 rounded-full shadow-2xl overflow-hidden"
            >
              {/* 封面图片铺满整个唱片 */}
              {currentTrack?.cover_url ? (
                <img 
                  src={currentTrack.cover_url} 
                  alt="封面"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Music className="w-16 h-16 text-primary-foreground/70" />
                </div>
              )}
              
              {/* 唱片纹路叠加层 */}
              <div className="absolute inset-0 rounded-full pointer-events-none">
                <div className="absolute inset-0 rounded-full border-4 border-black/20" />
                <div className="absolute inset-[15%] rounded-full border border-black/10" />
                <div className="absolute inset-[30%] rounded-full border border-black/10" />
              </div>
              
              {/* 中心小孔 */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-900 border-2 border-zinc-600 shadow-inner" />
            </motion.div>
          </div>

          {/* Current Track Title */}
          <p className="mt-6 text-lg font-bold text-foreground truncate max-w-[250px]">
            {currentTrack?.title || '未选择歌曲'}
          </p>
          
          {/* 进度条 */}
          <div className="w-full max-w-xs mt-6 px-2">
            <div 
              ref={progressRef}
              className="relative h-1.5 bg-muted rounded-full cursor-pointer group"
              onClick={handleProgressClick}
              onTouchStart={() => setIsDragging(true)}
              onTouchMove={handleProgressDrag}
              onTouchEnd={handleProgressDragEnd}
            >
              {/* 进度 */}
              <div 
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
              {/* 拖动点 */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress}% - 8px)` }}
              />
            </div>
            {/* 时间显示 */}
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 mt-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleLoopMode}
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
              {playing ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </Button>
            
            <Button variant="ghost" size="icon" onClick={nextTrack} className="w-12 h-12">
              <SkipForward className="w-6 h-6" />
            </Button>
            
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Shuffle className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Track List */}
        <div className="mt-6 space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">歌曲列表 ({tracks.length})</h2>
          {tracks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Music className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无歌曲</p>
              <p className="text-xs mt-1">点击右上角上传音乐文件</p>
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
                {/* Cover thumbnail */}
                <div
                  className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer relative group"
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
                  {!track.cover_url && <Music className="w-5 h-5 text-primary-foreground" />}
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Image className="w-4 h-4" />
                  </div>
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0" onClick={() => playTrack(index)}>
                  {editingId === track.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle(track.id)}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleUpdateTitle(track.id); }}>
                        <Check className="w-4 h-4 text-green-500" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="cursor-pointer">
                      <p className={`font-medium truncate ${currentTrackIndex === index ? 'text-primary' : 'text-foreground'}`}>
                        {track.title}
                      </p>
                      {currentTrackIndex === index && playing && (
                        <p className="text-xs text-primary/70 flex items-center gap-1">
                          <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse" />
                          正在播放
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {editingId !== track.id && (
                  <div className="flex items-center gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(track.id);
                        setEditTitle(track.title);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(track.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Hidden Audio Element */}
      {currentTrack && (
        <audio
          ref={audioRef}
          src={currentTrack.audio_url}
          onEnded={handleEnded}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      )}
    </div>
  );
};

export default MusicPage;
