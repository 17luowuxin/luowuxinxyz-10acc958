import React, { useEffect, useRef, useState } from 'react';

interface VoiceWaveformProps {
  isActive: boolean;
  color?: string;
  bars?: number;
}

const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  isActive,
  color = '#ef4444',
  bars = 5
}) => {
  const [heights, setHeights] = useState<number[]>(Array(bars).fill(8));
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setHeights(Array(bars).fill(8));
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = () => {
      setHeights(prev => 
        prev.map(() => 8 + Math.random() * 20)
      );
      animationRef.current = requestAnimationFrame(() => {
        setTimeout(animate, 100);
      });
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, bars]);

  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {heights.map((height, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-all duration-100"
          style={{
            height: `${height}px`,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
};

export default VoiceWaveform;
