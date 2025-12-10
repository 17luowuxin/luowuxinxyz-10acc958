import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MusicTrack {
  id: string;
  title: string;
  audio_url: string;
  cover_url: string | null;
  user_id: string;
  created_at: string;
}

interface Customization {
  music_cover_url?: string | null;
  [key: string]: any;
}

type LoopMode = 'none' | 'single' | 'all';

interface MusicContextType {
  tracks: MusicTrack[];
  currentTrack: MusicTrack | null;
  currentTrackIndex: number;
  playing: boolean;
  loopMode: LoopMode;
  currentTime: number;
  duration: number;
  defaultCoverUrl: string | null;
  setTracks: (tracks: MusicTrack[]) => void;
  setPlaying: (playing: boolean) => void;
  setLoopMode: (mode: LoopMode) => void;
  setDefaultCoverUrl: (url: string | null) => void;
  saveDefaultCover: (url: string) => Promise<void>;
  playTrack: (index: number) => void;
  togglePlay: () => void;
  prevTrack: () => void;
  nextTrack: () => void;
  cycleLoopMode: () => void;
  seekTo: (time: number) => void;
  fetchTracks: () => Promise<void>;
  audioRef: React.RefObject<HTMLAudioElement>;
}

const MusicContext = createContext<MusicContextType | null>(null);

export const useMusicPlayer = () => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusicPlayer must be used within a MusicProvider');
  }
  return context;
};

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>('none');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [defaultCoverUrl, setDefaultCoverUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 根据 currentTrackId 找到当前歌曲，这样即使 tracks 更新后也能获取最新的封面
  const currentTrack = currentTrackId ? tracks.find(t => t.id === currentTrackId) || null : null;
  const currentTrackIndex = currentTrackId ? tracks.findIndex(t => t.id === currentTrackId) : -1;

  // Fetch tracks
  const fetchTracks = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('music')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setTracks(data);
    }
    if (error) console.error(error);
  }, [user]);

  // 加载默认封面
  const loadDefaultCover = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('customization')
      .select('music_cover_url')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data && (data as Customization).music_cover_url) {
      setDefaultCoverUrl((data as Customization).music_cover_url);
    }
  }, [user]);

  // 保存默认封面到数据库
  const saveDefaultCover = useCallback(async (url: string) => {
    if (!user) return;
    await supabase
      .from('customization')
      .update({ music_cover_url: url } as any)
      .eq('user_id', user.id);
    setDefaultCoverUrl(url);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTracks();
      loadDefaultCover();
    }
  }, [user, fetchTracks, loadDefaultCover]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleEnded = () => {
      if (loopMode === 'single') {
        audio.currentTime = 0;
        audio.play();
      } else if (loopMode === 'all' && tracks.length > 0) {
        const nextIndex = (currentTrackIndex + 1) % tracks.length;
        playTrack(nextIndex);
      } else if (currentTrackIndex < tracks.length - 1) {
        playTrack(currentTrackIndex + 1);
      } else {
        setPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [loopMode, currentTrackIndex, tracks.length]);

  // Update audio source when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    
    audio.src = currentTrack.audio_url;
    if (playing) {
      audio.play().catch(console.error);
    }

    // Update Media Session metadata for lock screen controls
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: '我的音乐',
        album: '本地音乐',
        artwork: currentTrack.cover_url ? [
          { src: currentTrack.cover_url, sizes: '512x512', type: 'image/jpeg' }
        ] : []
      });

      navigator.mediaSession.setActionHandler('play', () => togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    }
  }, [currentTrack?.id]);

  const playTrack = useCallback((index: number) => {
    const track = tracks[index];
    if (track) {
      setCurrentTrackId(track.id);
      setPlaying(true);
      setCurrentTime(0);
      setTimeout(() => {
        audioRef.current?.play().catch(console.error);
      }, 100);
    }
  }, [tracks]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  }, [playing, currentTrack]);

  const prevTrack = useCallback(() => {
    if (tracks.length === 0) return;
    const prevIndex = currentTrackIndex <= 0 ? tracks.length - 1 : currentTrackIndex - 1;
    playTrack(prevIndex);
  }, [tracks.length, currentTrackIndex, playTrack]);

  const nextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    playTrack(nextIndex);
  }, [tracks.length, currentTrackIndex, playTrack]);

  const cycleLoopMode = useCallback(() => {
    const modes: LoopMode[] = ['none', 'single', 'all'];
    const currentIdx = modes.indexOf(loopMode);
    setLoopMode(modes[(currentIdx + 1) % modes.length]);
  }, [loopMode]);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  return (
    <MusicContext.Provider
      value={{
        tracks,
        currentTrack,
        currentTrackIndex,
        playing,
        loopMode,
        currentTime,
        duration,
        defaultCoverUrl,
        setTracks,
        setPlaying,
        setLoopMode,
        setDefaultCoverUrl,
        saveDefaultCover,
        playTrack,
        togglePlay,
        prevTrack,
        nextTrack,
        cycleLoopMode,
        seekTo,
        fetchTracks,
        audioRef,
      }}
    >
      {children}
      {/* 全局音频元素 - 后台播放 */}
      <audio ref={audioRef} />
    </MusicContext.Provider>
  );
};
