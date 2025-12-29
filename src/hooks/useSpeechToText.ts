import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type UseSpeechToTextOptions = {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
};

const getSpeechRecognitionCtor = (): SpeechRecognitionConstructor | null => {
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SpeechRecognitionConstructor | null;
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
  const { lang = "zh-CN", continuous = false, interimResults = true } = options;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const permissionStreamRef = useRef<MediaStream | null>(null);

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

  const cleanupPermissionStream = useCallback(() => {
    const stream = permissionStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      permissionStreamRef.current = null;
    }
  }, []);

  const ensureRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = interimResults;

    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);

    rec.onerror = (e: any) => {
      const message = mapSpeechError(String(e?.error || "unknown"));
      onErrorRef.current?.(message);
      cleanupPermissionStream();
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
  }, [cleanupPermissionStream, continuous, interimResults, lang]);

  const start = useCallback(async () => {
    const rec = ensureRecognition();
    if (!rec) {
      onErrorRef.current?.("当前浏览器不支持语音输入（建议用 Chrome）");
      return;
    }

    // 提前触发麦克风权限弹窗（有些浏览器更稳定）
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStreamRef.current = stream;
    } catch {
      onErrorRef.current?.("无法获取麦克风权限");
      return;
    }

    try {
      rec.start();
    } catch (e: any) {
      onErrorRef.current?.(String(e?.message || "语音识别启动失败"));
      cleanupPermissionStream();
    }
  }, [cleanupPermissionStream, ensureRecognition]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } finally {
      cleanupPermissionStream();
    }
  }, [cleanupPermissionStream]);

  const toggle = useCallback(async () => {
    if (isListening) {
      stop();
      return;
    }
    await start();
  }, [isListening, start, stop]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { isSupported, isListening, start, stop, toggle };
}
