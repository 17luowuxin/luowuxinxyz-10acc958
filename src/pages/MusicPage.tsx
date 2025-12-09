import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Music, Play, Pause, Upload, Repeat, Repeat1, SkipBack, SkipForward, Edit2, Image, Check, X, Trash2 } from 'lucide-react';
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;

  useEffect(() => {
    if (user) fetchTracks();
  }, [user]);

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

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>, trackId: string) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
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
      audioRef.current?.play();
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
    setLoopMode(modes[(currentIndex + 1) % modes.length]);
  };

  const getLoopIcon = () => {
    if (loopMode === 'single') return <Repeat1 className="w-5 h-5" />;
    return <Repeat className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      {/* Header */}
      <div className="flex items-center p-4 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold ml-2">音乐</h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Rotating Disc */}
        <div className="flex flex-col items-center py-6">
          <div className="relative">
            {/* Vinyl record outer ring */}
            <div className="w-52 h-52 rounded-full bg-gradient-to-br from-muted to-muted/50 p-2 shadow-glow">
              <motion.div
                animate={{ rotate: playing ? 360 : 0 }}
                transition={{ repeat: playing ? Infinity : 0, duration: 4, ease: 'linear' }}
                className="w-full h-full rounded-full overflow-hidden relative"
                style={{
                  background: currentTrack?.cover_url 
                    ? `url(${currentTrack.cover_url}) center/cover` 
                    : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))'
                }}
              >
                {/* Center hole */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-background/90 flex items-center justify-center shadow-inner">
                    <div className="w-4 h-4 rounded-full bg-muted" />
                  </div>
                </div>
                {!currentTrack?.cover_url && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Music className="w-16 h-16 text-primary-foreground/70" />
                  </div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Current Track Title */}
          <p className="mt-4 text-lg font-semibold text-foreground truncate max-w-[200px]">
            {currentTrack?.title || '未选择歌曲'}
          </p>

          {/* Controls */}
          <div className="flex items-center gap-3 mt-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleLoopMode}
              className={loopMode !== 'none' ? 'text-primary' : 'text-muted-foreground'}
            >
              {getLoopIcon()}
            </Button>
            <Button variant="ghost" size="icon" onClick={prevTrack}>
              <SkipBack className="w-6 h-6" />
            </Button>
            <Button
              variant="candy"
              size="lg"
              className="w-14 h-14 rounded-full"
              onClick={togglePlay}
              disabled={!currentTrack}
            >
              {playing ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={nextTrack}>
              <SkipForward className="w-6 h-6" />
            </Button>
            <label>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                className="hidden"
              />
              <Button variant="ghost" size="icon" asChild disabled={uploading}>
                <span><Upload className="w-5 h-5" /></span>
              </Button>
            </label>
          </div>

          {/* Loop Mode Indicator */}
          <p className="text-xs text-muted-foreground mt-2">
            {loopMode === 'single' && '单曲循环'}
            {loopMode === 'all' && '列表循环'}
            {loopMode === 'none' && '顺序播放'}
          </p>
        </div>

        {/* Track List */}
        <div className="mt-4 space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">歌曲列表 ({tracks.length})</h2>
          {tracks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无歌曲，点击上传添加</p>
            </div>
          ) : (
            tracks.map((track, index) => (
              <div
                key={track.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  currentTrackIndex === index 
                    ? 'bg-primary/20 border border-primary/30' 
                    : 'bg-card/60 hover:bg-card/80'
                }`}
              >
                {/* Cover thumbnail */}
                <div
                  className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer relative group"
                  style={{
                    background: track.cover_url 
                      ? `url(${track.cover_url}) center/cover` 
                      : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))'
                  }}
                  onClick={() => coverInputRef.current?.click()}
                >
                  {!track.cover_url && <Music className="w-6 h-6 text-primary-foreground" />}
                  <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Image className="w-4 h-4" />
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleCoverUpload(e, track.id)}
                  />
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
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle(track.id)}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleUpdateTitle(track.id)}>
                        <Check className="w-4 h-4 text-green-500" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className={`font-medium truncate cursor-pointer ${currentTrackIndex === index ? 'text-primary' : 'text-foreground'}`}>
                      {track.title}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {editingId !== track.id && (
                  <div className="flex items-center gap-1">
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
