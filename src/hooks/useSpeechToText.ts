import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/types/speech-recognition.d.ts";

type UseSpeechToTextOptions = {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  /** If true, recognition will restart automatically when it ends (persistent mode) */
  persistent?: boolean;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
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

  const onFinalRef = useRef(options.onFinal);
  const onErrorRef = useRef(options.onError);

  useEffect(() => {
    onFinalRef.current = options.onFinal;
  }, [options.onFinal]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  const isSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);
  const [isListening, setIsListening] = useState(false);
  const [isPersistentEnabled, setIsPersistentEnabled] = useState(false);

  const cleanupPermissionStream = useCallback(() => {
    const stream = permissionStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      permissionStreamRef.current = null;
    }
  }, []);

  const restartRecognition = useCallback(() => {
    if (!shouldRestartRef.current || !recognitionRef.current) return;
    
    // Small delay before restarting to avoid rapid restarts
    setTimeout(() => {
      if (shouldRestartRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // Recognition might already be running
        }
      }
    }, 100);
  }, []);

  const ensureRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true; // Always use continuous for persistent mode
    rec.interimResults = interimResults;

    rec.onstart = () => setIsListening(true);
    
    rec.onend = () => {
      setIsListening(false);
      // In persistent mode, auto-restart unless explicitly stopped
      if (shouldRestartRef.current) {
        restartRecognition();
      }
    };

    rec.onerror = (e: any) => {
      const errorType = String(e?.error || "unknown");
      // Don't show error for no-speech in persistent mode, just restart
      if (errorType === "no-speech" && shouldRestartRef.current) {
        restartRecognition();
        return;
      }
      // Don't show error for aborted (happens on restart)
      if (errorType === "aborted" && shouldRestartRef.current) {
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
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const txt = result?.[0]?.transcript || "";
        if (result.isFinal) {
          finalText += txt;
        }
      }

      const cleaned = finalText.trim();
      if (cleaned) {
        onFinalRef.current?.(cleaned);
      }
    };

    recognitionRef.current = rec;
    return rec;
  }, [cleanupPermissionStream, interimResults, lang, restartRecognition]);

  const start = useCallback(async () => {
    const rec = ensureRecognition();
    if (!rec) {
      onErrorRef.current?.("当前浏览器不支持语音输入（建议用 Chrome）");
      return;
    }

    // 提前触发麦克风权限弹窗
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStreamRef.current = stream;
    } catch {
      onErrorRef.current?.("无法获取麦克风权限");
      return;
    }

    shouldRestartRef.current = persistent || true;
    setIsPersistentEnabled(true);

    try {
      rec.start();
    } catch (e: any) {
      onErrorRef.current?.(String(e?.message || "语音识别启动失败"));
      cleanupPermissionStream();
      shouldRestartRef.current = false;
      setIsPersistentEnabled(false);
    }
  }, [cleanupPermissionStream, ensureRecognition, persistent]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    setIsPersistentEnabled(false);
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
    isPersistentEnabled, // New: whether persistent mode is active
    start, 
    stop, 
    toggle 
  };
}
