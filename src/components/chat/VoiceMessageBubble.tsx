import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface VoiceMessageBubbleProps {
  audioBase64: string;
  duration?: number; // seconds
  transcript?: string;
  isUser?: boolean;
  onTranscriptRequest?: () => void;
  bubbleColor?: string;
  fontColor?: string;
}

const VoiceMessageBubble: React.FC<VoiceMessageBubbleProps> = ({
  audioBase64,
  duration = 0,
  transcript,
  isUser = false,
  onTranscriptRequest,
  bubbleColor,
  fontColor = '#333',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [currentDuration, setCurrentDuration] = useState(duration);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Waveform bars - random heights for visual effect
  const waveformBars = useRef(
    Array.from({ length: 20 }, () => 0.3 + Math.random() * 0.7)
  ).current;

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

  // Calculate bubble width based on duration (min 80px, max 200px)
  const bubbleWidth = Math.min(200, Math.max(80, 80 + (currentDuration * 8)));

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Voice bubble */}
      <div
        className={`relative flex items-center gap-2 px-3 py-2 rounded-2xl cursor-pointer transition-all hover:opacity-90 ${
          isUser ? 'rounded-br-sm' : 'rounded-bl-sm'
        }`}
        style={{
          width: bubbleWidth,
          backgroundColor: bubbleColor || (isUser ? '#95ec69' : '#ffffff'),
          color: fontColor,
        }}
        onClick={togglePlay}
      >
        {/* Play/Pause button */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black/10 flex items-center justify-center">
          {isPlaying ? (
            <Pause className="w-3 h-3" />
          ) : (
            <Play className="w-3 h-3 ml-0.5" />
          )}
        </div>

        {/* Waveform animation */}
        <div className="flex-1 flex items-center gap-[2px] h-5 overflow-hidden">
          {waveformBars.map((height, i) => {
            const isActive = (i / waveformBars.length) * 100 <= progress;
            return (
              <div
                key={i}
                className={`w-[3px] rounded-full transition-all duration-100 ${
                  isPlaying ? 'animate-pulse' : ''
                }`}
                style={{
                  height: `${height * 100}%`,
                  backgroundColor: isActive 
                    ? (isUser ? '#2d8c3c' : '#07c160') 
                    : 'rgba(0,0,0,0.2)',
                  animationDelay: isPlaying ? `${i * 50}ms` : '0ms',
                }}
              />
            );
          })}
        </div>

        {/* Duration */}
        <span className="flex-shrink-0 text-xs opacity-70 min-w-[24px] text-right">
          {formatDuration(currentDuration)}
        </span>

        {/* Sound wave indicator (WeChat style) */}
        {!isUser && (
          <div className={`absolute ${isUser ? 'right-[-20px]' : 'left-[-20px]'} flex items-center`}>
            <Volume2 className={`w-4 h-4 opacity-50 ${isPlaying ? 'animate-pulse' : ''}`} />
          </div>
        )}
      </div>

      {/* Transcript toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleTranscript();
        }}
        className="text-[10px] text-muted-foreground mt-1 hover:text-foreground transition-colors"
      >
        {showTranscript ? '收起文字' : '转文字'}
      </button>

      {/* Transcript text */}
      {showTranscript && transcript && (
        <div
          className={`mt-1 px-3 py-2 rounded-lg text-xs max-w-[200px] ${
            isUser ? 'bg-primary/10' : 'bg-muted'
          }`}
          style={{ color: fontColor }}
        >
          {transcript}
        </div>
      )}
    </div>
  );
};

export default VoiceMessageBubble;
