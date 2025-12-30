import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface VoiceMessageBubbleProps {
  audioBase64: string;
  duration?: number; // seconds
  transcript?: string;
  isUser?: boolean;
  onTranscriptRequest?: () => void;
  bubbleColor?: string;
  fontColor?: string;
  bubbleStyle?: React.CSSProperties;
}

const VoiceMessageBubble: React.FC<VoiceMessageBubbleProps> = ({
  audioBase64,
  duration = 0,
  transcript,
  isUser = false,
  onTranscriptRequest,
  bubbleColor,
  fontColor = '#333',
  bubbleStyle,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [currentDuration, setCurrentDuration] = useState(duration);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Waveform bars - random heights for visual effect (memoized)
  const waveformBars = useMemo(
    () => Array.from({ length: 16 }, () => 0.25 + Math.random() * 0.75),
    []
  );

  useEffect(() => {
    // Create audio element
    const audioUrl = audioBase64.startsWith('data:') 
      ? audioBase64 
      : `data:audio/mpeg;base64,${audioBase64}`;
    audioRef.current = new Audio(audioUrl);
    
    audioRef.current.onloadedmetadata = () => {
      if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
        setCurrentDuration(Math.ceil(audioRef.current.duration));
      }
    };

    audioRef.current.onended = () => {
      setIsPlaying(false);
      setProgress(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioBase64]);

  const updateProgress = () => {
    if (audioRef.current && isPlaying) {
      const currentProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(currentProgress);
      animationRef.current = requestAnimationFrame(updateProgress);
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        animationRef.current = requestAnimationFrame(updateProgress);
      } catch (err) {
        console.error('Audio playback error:', err);
      }
    }
  };

  const toggleTranscript = () => {
    if (!transcript && onTranscriptRequest) {
      onTranscriptRequest();
    }
    setShowTranscript(!showTranscript);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "0''";
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    if (mins > 0) {
      return `${mins}'${secs.toString().padStart(2, '0')}''`;
    }
    return `${secs}''`;
  };

  // Calculate bubble width based on duration (min 100px, max 180px)
  const bubbleWidth = Math.min(180, Math.max(100, 100 + (currentDuration * 6)));

  // Default bubble colors
  const defaultBg = isUser 
    ? 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' 
    : 'linear-gradient(135deg, #fff1eb 0%, #ace0f9 100%)';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Voice bubble - WeChat style with beautification */}
      <div
        className={`relative flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${
          isUser ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'
        }`}
        style={{
          width: bubbleWidth,
          background: bubbleColor || defaultBg,
          color: fontColor,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          ...bubbleStyle,
        }}
        onClick={togglePlay}
      >
        {/* Play/Pause button - gradient circle */}
        <div 
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
            isPlaying ? 'scale-110' : ''
          }`}
          style={{
            background: isUser 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 text-white" />
          ) : (
            <Play className="w-3.5 h-3.5 text-white ml-0.5" />
          )}
        </div>

        {/* Waveform animation - more dynamic */}
        <div className="flex-1 flex items-center gap-[3px] h-6 overflow-hidden">
          {waveformBars.map((height, i) => {
            const isActive = (i / waveformBars.length) * 100 <= progress;
            const animationDelay = `${i * 80}ms`;
            return (
              <div
                key={i}
                className={`w-[3px] rounded-full transition-all duration-150 ${
                  isPlaying ? 'animate-bounce' : ''
                }`}
                style={{
                  height: `${height * 100}%`,
                  background: isActive 
                    ? (isUser 
                        ? 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)' 
                        : 'linear-gradient(180deg, #f093fb 0%, #f5576c 100%)')
                    : 'rgba(0,0,0,0.15)',
                  animationDelay: isPlaying ? animationDelay : '0ms',
                  animationDuration: '0.6s',
                }}
              />
            );
          })}
        </div>

        {/* Duration badge */}
        <span 
          className="flex-shrink-0 text-[11px] font-medium min-w-[28px] text-right"
          style={{ opacity: 0.75 }}
        >
          {formatDuration(currentDuration)}
        </span>

        {/* Sound wave indicator (WeChat style) - only for friend messages */}
        {!isUser && (
          <div className="absolute left-[-22px] flex items-center">
            <Volume2 
              className={`w-4 h-4 transition-all duration-300 ${
                isPlaying ? 'text-pink-400 animate-pulse' : 'text-gray-400'
              }`} 
            />
          </div>
        )}
      </div>

      {/* Transcript toggle button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleTranscript();
        }}
        className="text-[10px] text-muted-foreground mt-1.5 hover:text-foreground transition-colors px-1"
      >
        {showTranscript ? '收起文字' : '转文字'}
      </button>

      {/* Transcript text with nice styling */}
      {showTranscript && (
        <div
          className={`mt-1.5 px-3 py-2 rounded-xl text-xs max-w-[200px] backdrop-blur-sm ${
            isUser 
              ? 'bg-gradient-to-r from-purple-100/80 to-pink-100/80' 
              : 'bg-gradient-to-r from-blue-50/80 to-purple-50/80'
          }`}
          style={{ 
            color: fontColor,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          {transcript || '正在识别...'}
        </div>
      )}
    </div>
  );
};

export default VoiceMessageBubble;
