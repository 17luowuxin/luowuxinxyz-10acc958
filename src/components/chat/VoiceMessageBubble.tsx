import React, { useState, useRef, useEffect, useMemo } from 'react';

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

  // Waveform bars - simple dots like reference image
  const waveformBars = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({
      id: i,
      size: i < 2 || i > 3 ? 'small' : 'large'
    })),
    []
  );

  useEffect(() => {
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
    if (!seconds || seconds <= 0) return "0:00''";
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}''`;
  };

  // Calculate bubble width based on duration (min 120px, max 200px)
  const bubbleWidth = Math.min(200, Math.max(120, 120 + (currentDuration * 5)));

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Voice bubble - clean WeChat style like reference images */}
      <div
        className={`relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 hover:brightness-95 ${
          isUser ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'
        }`}
        style={{
          width: bubbleWidth,
          backgroundColor: bubbleColor || (isUser ? '#95ec69' : '#ffffff'),
          color: fontColor,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          ...bubbleStyle,
        }}
        onClick={togglePlay}
      >
        {/* Simple dot waveform like reference image */}
        <div className="flex-1 flex items-center justify-center gap-1 h-5">
          {waveformBars.map((bar) => {
            const activeIndex = Math.floor((progress / 100) * waveformBars.length);
            const isActive = bar.id <= activeIndex || isPlaying;
            const size = bar.size === 'large' ? 'w-1.5 h-4' : 'w-1.5 h-2';
            
            return (
              <div
                key={bar.id}
                className={`${size} rounded-full transition-all duration-150 ${
                  isPlaying ? 'animate-pulse' : ''
                }`}
                style={{
                  backgroundColor: isActive ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.25)',
                  animationDelay: isPlaying ? `${bar.id * 100}ms` : '0ms',
                }}
              />
            );
          })}
        </div>

        {/* Duration - right aligned like reference */}
        <span 
          className="flex-shrink-0 text-sm font-medium"
          style={{ color: 'rgba(0,0,0,0.5)' }}
        >
          {formatDuration(currentDuration)}
        </span>
      </div>

      {/* Transcript text - shown below like reference image 4 */}
      {showTranscript && transcript && (
        <div
          className={`mt-1.5 px-4 py-2.5 rounded-xl text-sm max-w-[220px] ${
            isUser ? 'rounded-br-sm' : 'rounded-bl-sm'
          }`}
          style={{ 
            backgroundColor: bubbleColor || (isUser ? '#95ec69' : '#ffffff'),
            color: fontColor,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          {transcript}
        </div>
      )}
      
      {/* Transcript toggle button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleTranscript();
        }}
        className="text-[10px] text-muted-foreground mt-1 hover:text-foreground transition-colors px-1"
      >
        {showTranscript ? '收起' : '转文字'}
      </button>
    </div>
  );
};

export default VoiceMessageBubble;
