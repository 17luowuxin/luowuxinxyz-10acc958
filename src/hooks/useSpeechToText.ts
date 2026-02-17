import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/types/speech-recognition.d.ts";

type UseSpeechToTextOptions = {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  /** If true, recognition will restart automatically when it ends (persistent mode) */
  persistent?: boolean;
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (message: string) => void;
  /** Callback when audio starts being detected */
  onAudioStart?: () => void;
  /** Callback when audio stops being detected */
  onAudioEnd?: () => void;
};

const getSpeechRecognitionCtor = (): (new () => SpeechRecognition) | null => {
  const w = window as Window;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

const mapSpeechError = (err: string) => {
  switch (err) {
    case "not-allowed":
    case "service-not-allowed":
      return "麦克风权限被拒绝，请在浏览器设置里允许麦克风";
    case "audio-capture":
      return "未检测到麦克风设备";
    case "network":
      return "语音识别网络异常，请稍后重试";
    case "no-speech":
      return "没有听到声音，请再试一次";
    default:
      return `语音识别失败：${err}`;
  }
};

export function useSpeechToText(options: UseSpeechToTextOptions = {}) {
  const { 
    lang = "zh-CN", 
    continuous = false, 
    interimResults = true,
    persistent = false, // New option for persistent mode
  } = options;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const permissionStreamRef = useRef<MediaStream | null>(null);
  const persistentModeRef = useRef(false); // Track if persistent mode is enabled
  const shouldRestartRef = useRef(false); // Track if we should restart after end
  const restartCountRef = useRef(0); // Track restart attempts
  const lastRestartTimeRef = useRef(0); // Prevent rapid restarts

  const onFinalRef = useRef(options.onFinal);
  const onInterimRef = useRef(options.onInterim);
  const onErrorRef = useRef(options.onError);
  const onAudioStartRef = useRef(options.onAudioStart);
  const onAudioEndRef = useRef(options.onAudioEnd);

  useEffect(() => {
    onFinalRef.current = options.onFinal;
  }, [options.onFinal]);

  useEffect(() => {
    onInterimRef.current = options.onInterim;
  }, [options.onInterim]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  useEffect(() => {
    onAudioStartRef.current = options.onAudioStart;
  }, [options.onAudioStart]);

  useEffect(() => {
    onAudioEndRef.current = options.onAudioEnd;
  }, [options.onAudioEnd]);

  const isSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);
  const [isListening, setIsListening] = useState(false);
  const [isPersistentEnabled, setIsPersistentEnabled] = useState(false);
  const [hasAudioActivity, setHasAudioActivity] = useState(false);

  const cleanupPermissionStream = useCallback(() => {
    const stream = permissionStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      permissionStreamRef.current = null;
    }
  }, []);

  /**
   * 在“用户手势”里提前触发麦克风权限弹窗（重要：很多浏览器会拦截非手势回调中的权限请求）
   */
  const prime = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 这里只是为了触发权限授权，立刻释放，避免占用麦克风导致识别服务拿不到音频
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      onErrorRef.current?.("无法获取麦克风权限");
      return false;
    }
  }, []);

  const isStartingRef = useRef(false); // Prevent double-start

  const restartRecognition = useCallback(() => {
    if (!shouldRestartRef.current || !recognitionRef.current) return;
    if (isStartingRef.current) return; // Already starting

    const now = Date.now();
    const timeSinceLastRestart = now - lastRestartTimeRef.current;

    // Prevent rapid restarts - wait at least 500ms between restarts
    const delay = Math.max(500, 800 - timeSinceLastRestart);

    setTimeout(() => {
      if (shouldRestartRef.current && recognitionRef.current && !isStartingRef.current) {
        try {
          console.log('[SpeechToText] Restarting recognition...');
          isStartingRef.current = true;
          lastRestartTimeRef.current = Date.now();
          restartCountRef.current++;
          recognitionRef.current.start();
        } catch (e: any) {
          isStartingRef.current = false;
          const msg = String(e?.message || '');
          if (msg.includes('already started')) {
            console.log('[SpeechToText] Already running, skip restart');
            setIsListening(true);
            return;
          }
          console.log('[SpeechToText] Restart failed, will retry:', e);
          if (shouldRestartRef.current) {
            setTimeout(() => restartRecognition(), 1000);
          }
        }
      }
    }, delay);
  }, []);

  const ensureRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true; // Always use continuous for persistent mode
    rec.interimResults = interimResults;

    rec.onstart = () => {
      console.log('[SpeechToText] Recognition started');
      isStartingRef.current = false;
      setIsListening(true);
      restartCountRef.current = 0;
    };

    rec.onend = () => {
      console.log('[SpeechToText] Recognition ended, shouldRestart:', shouldRestartRef.current);
      isStartingRef.current = false;
      setIsListening(false);
      setHasAudioActivity(false);
      if (shouldRestartRef.current) {
        restartRecognition();
      }
    };

    rec.onaudiostart = () => {
      console.log('[SpeechToText] Audio detected');
      setHasAudioActivity(true);
      onAudioStartRef.current?.();
    };

    rec.onaudioend = () => {
      console.log('[SpeechToText] Audio ended');
      setHasAudioActivity(false);
      onAudioEndRef.current?.();
    };

    rec.onspeechstart = () => {
      console.log('[SpeechToText] Speech detected');
    };

    rec.onerror = (e: any) => {
      const errorType = String(e?.error || "unknown");
      console.log('[SpeechToText] Error:', errorType, 'shouldRestart:', shouldRestartRef.current);

      // Don't show error for no-speech in persistent mode, just restart
      if (errorType === "no-speech" && shouldRestartRef.current) {
        console.log('[SpeechToText] No speech detected, restarting...');
        restartRecognition();
        return;
      }
      // Don't show error for aborted (happens on restart)
      if (errorType === "aborted" && shouldRestartRef.current) {
        restartRecognition();
        return;
      }
      // Handle network errors gracefully in persistent mode
      if (errorType === "network" && shouldRestartRef.current) {
        console.log('[SpeechToText] Network error, will retry...');
        setTimeout(() => restartRecognition(), 1000);
        return;
      }

      const message = mapSpeechError(errorType);
      onErrorRef.current?.(message);
      cleanupPermissionStream();
      shouldRestartRef.current = false;
      setIsPersistentEnabled(false);
    };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const txt = result?.[0]?.transcript || "";
        if (result.isFinal) {
          finalText += txt;
        } else {
          interimText += txt;
        }
      }

      // Emit interim text for real-time display
      if (interimText) {
        onInterimRef.current?.(interimText);
      }

      const cleaned = finalText.trim();
      if (cleaned) {
        onInterimRef.current?.(""); // Clear interim when final is received
        onFinalRef.current?.(cleaned);
      }
    };

    recognitionRef.current = rec;
    return rec;
  }, [cleanupPermissionStream, interimResults, lang, restartRecognition]);

  const start = useCallback(async () => {
    // Guard: don't start if already listening or starting
    if (isListening || isStartingRef.current) {
      console.log('[SpeechToText] Already listening or starting, skip');
      return;
    }

    const rec = ensureRecognition();
    if (!rec) {
      onErrorRef.current?.("当前浏览器不支持语音输入（建议用 Chrome）");
      return;
    }

    shouldRestartRef.current = Boolean(persistent);
    setIsPersistentEnabled(Boolean(persistent));
    isStartingRef.current = true;

    try {
      rec.start();
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('already started')) {
        console.log('[SpeechToText] Already running');
        isStartingRef.current = false;
        setIsListening(true);
        return;
      }
      console.log('[SpeechToText] Direct start failed, trying with prime:', msg);
      isStartingRef.current = false;
      const ok = await prime();
      if (!ok) return;
      isStartingRef.current = true;
      try {
        rec.start();
      } catch (e2: any) {
        isStartingRef.current = false;
        const msg2 = String(e2?.message || '');
        if (msg2.includes('already started')) {
          setIsListening(true);
          return;
        }
        onErrorRef.current?.(String(e2?.message || "语音识别启动失败"));
        cleanupPermissionStream();
        shouldRestartRef.current = false;
        setIsPersistentEnabled(false);
      }
    }
  }, [cleanupPermissionStream, ensureRecognition, persistent, prime, isListening]);

  const stop = useCallback(() => {
    console.log('[SpeechToText] Stopping recognition');
    shouldRestartRef.current = false;
    setIsPersistentEnabled(false);
    setHasAudioActivity(false);
    try {
      recognitionRef.current?.stop();
    } finally {
      cleanupPermissionStream();
    }
  }, [cleanupPermissionStream]);

  const toggle = useCallback(async () => {
    if (isListening || isPersistentEnabled) {
      stop();
      return;
    }
    await start();
  }, [isListening, isPersistentEnabled, start, stop]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      stop();
    };
  }, [stop]);

  return {
    isSupported,
    isListening,
    isPersistentEnabled,
    hasAudioActivity,
    prime,
    start,
    stop,
    toggle,
  };
}
