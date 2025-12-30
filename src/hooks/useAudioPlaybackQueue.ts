import { useCallback, useEffect, useRef, useState } from "react";

type QueueItem = {
  id: string;
  src: string;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
};

type QueueItemInternal = QueueItem & {
  resolve: () => void;
};

const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

export function useAudioPlaybackQueue() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<QueueItemInternal[]>([]);
  const currentRef = useRef<QueueItemInternal | null>(null);
  const playingRef = useRef(false);
  const unlockedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
    }
    return audioRef.current;
  }, []);

  const stop = useCallback(() => {
    const pending = queueRef.current;
    queueRef.current = [];

    const current = currentRef.current;
    currentRef.current = null;

    playingRef.current = false;
    setIsPlaying(false);

    const audio = audioRef.current;
    if (audio) {
      try {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.currentTime = 0;
        audio.src = "";
      } catch {
        // ignore
      }
    }

    // resolve promises so callers don't hang
    try {
      current?.resolve();
    } catch {
      // ignore
    }
    for (const item of pending) {
      try {
        item.resolve();
      } catch {
        // ignore
      }
    }
  }, []);

  const playNext = useCallback(async () => {
    if (playingRef.current) return;

    const next = queueRef.current.shift();
    if (!next) {
      setIsPlaying(false);
      return;
    }

    currentRef.current = next;
    playingRef.current = true;
    setIsPlaying(true);

    const audio = ensureAudio();
    audio.src = next.src;
    audio.volume = typeof next.volume === "number" ? next.volume : 1;

    const finish = () => {
      playingRef.current = false;
      setIsPlaying(false);
      currentRef.current = null;

      try {
        next.resolve();
      } catch {
        // ignore
      }

      void playNext();
    };

    audio.onended = () => {
      try {
        next.onEnd?.();
      } finally {
        finish();
      }
    };

    audio.onerror = (e) => {
      try {
        next.onError?.(e);
      } finally {
        finish();
      }
    };

    try {
      next.onStart?.();
      await audio.play();
    } catch (err) {
      try {
        next.onError?.(err);
      } finally {
        finish();
      }
    }
  }, [ensureAudio]);

  const enqueue = useCallback(
    (item: Omit<QueueItem, "id">) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

      return new Promise<void>((resolve) => {
        queueRef.current.push({ id, ...item, resolve });
        void playNext();
      });
    },
    [playNext]
  );

  const unlock = useCallback(async () => {
    if (unlockedRef.current) return true;

    try {
      const a = new Audio(SILENT_WAV_DATA_URI);
      a.volume = 0;
      await a.play();
      a.pause();
      unlockedRef.current = true;
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isPlaying,
    enqueue,
    stop,
    unlock,
  };
}
