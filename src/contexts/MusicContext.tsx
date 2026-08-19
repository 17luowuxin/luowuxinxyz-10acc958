import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalAssetUrl, getLocalTable, isLocalModeEnabled, upsertLocalRow } from '@/lib/localDataStore';

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
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>('none');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [defaultCoverUrl, setDefaultCoverUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [localMode, setLocalMode] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLocalMode(null);
      return;
    }
    isLocalModeEnabled(user.id).then(setLocalMode).catch(() => setLocalMode(false));
  }, [user?.id]);

  // 根据 currentTrackId 找到当前歌曲，这样即使 tracks 更新后也能获取最新的封面
  const currentTrack = currentTrackId ? tracks.find(t => t.id === currentTrackId) || null : null;
  const currentTrackIndex = currentTrackId ? tracks.findIndex(t => t.id === currentTrackId) : -1;

  // Fetch tracks
  const fetchTracks = useCallback(async () => {
    if (!user || localMode === null) return;
    if (localMode) {
      const localTracks = await getLocalTable(user.id, 'music');
      const resolvedTracks = await Promise.all(localTracks.map(async (track) => ({
        ...track,
        audio_url: await getLocalAssetUrl(user.id, String(track.audio_url || '')),
      })));
      setTracks(resolvedTracks
        .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime()) as unknown as MusicTrack[]);
      return;
    }
    const { data, error } = await supabase
      .from('music')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setTracks(data);
    }
    if (error) console.error(error);
  }, [user, localMode]);

  // 加载默认封面
  const loadDefaultCover = useCallback(async () => {
    if (!user || localMode === null) return;
    if (localMode) {
      const customization = (await getLocalTable(user.id, 'customization'))[0];
      setDefaultCoverUrl(customization?.music_cover_url ? String(customization.music_cover_url) : null);
      return;
    }
    const { data } = await supabase
      .from('customization')
      .select('music_cover_url')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data && (data as Customization).music_cover_url) {
      setDefaultCoverUrl((data as Customization).music_cover_url);
    }
  }, [user, localMode]);

  // 保存默认封面到数据库
  const saveDefaultCover = useCallback(async (url: string) => {
    if (!user) return;
    if (localMode) {
      await upsertLocalRow(user.id, 'customization', () => true, { user_id: user.id, music_cover_url: url });
      setDefaultCoverUrl(url);
      return;
    }
    await supabase
      .from('customization')
      .update({ music_cover_url: url } as any)
      .eq('user_id', user.id);
    setDefaultCoverUrl(url);
  }, [user, localMode]);

  useEffect(() => {
    if (user && localMode !== null) {
      fetchTracks();
      loadDefaultCover();
    }
  }, [user, localMode, fetchTracks, loadDefaultCover]);

  const playTrack = useCallback((index: number) => {
    const track = tracks[index];
    if (track) {
      setIsLoading(true);
      setCurrentTrackId(track.id);
      setPlaying(true);
      setCurrentTime(0);
      setTimeout(() => {
        audioRef.current?.play().catch((err) => {
          console.error('Play failed:', err);
          setIsLoading(false);
        });
      }, 100);
    }
  }, [tracks]);

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

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };
    const handlePlay = () => {
      setPlaying(true);
      setIsLoading(false);
    };
    const handlePause = () => setPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = () => {
      setIsLoading(false);
      console.error('Audio playback error');
    };
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
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [loopMode, currentTrackIndex, tracks.length, playTrack]);

  // Wake lock for background playback
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && playing) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          console.log('Wake lock released');
        });
      } catch (err) {
        console.log('Wake lock failed:', err);
      }
    }
  }, [playing]);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  // Manage wake lock based on playing state
  useEffect(() => {
    if (playing) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => releaseWakeLock();
  }, [playing, requestWakeLock, releaseWakeLock]);

  // Re-acquire wake lock when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && playing) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [playing, requestWakeLock]);

  // Update audio source when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    
    // Preload audio for smoother playback
    audio.preload = 'auto';
    if (audio.getAttribute('src') !== currentTrack.audio_url) {
      audio.src = currentTrack.audio_url;
    }
    
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

      navigator.mediaSession.setActionHandler('play', () => {
        audioRef.current?.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
        }
      });
    }
  }, [currentTrack, nextTrack, playing, prevTrack]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  }, [playing, currentTrack]);

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
        isLoading,
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
      {/* 全局音频元素 - 后台播放，启用预加载 */}
      <audio ref={audioRef} preload="auto" />
    </MusicContext.Provider>
  );
};
