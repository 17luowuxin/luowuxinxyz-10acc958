import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GameBGMProps {
  gameType: 'werewolf' | 'script-murder' | 'truth-dare' | 'riddle';
  isPlaying?: boolean;
}

// Free BGM URLs (royalty-free ambient music from freesound.org & other sources)
const BGM_URLS: Record<string, string> = {
  'werewolf': 'https://cdn.pixabay.com/audio/2022/10/25/audio_46b97e1957.mp3',
  'script-murder': 'https://cdn.pixabay.com/audio/2022/03/15/audio_8cb749d484.mp3',
  'truth-dare': 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
  'riddle': 'https://cdn.pixabay.com/audio/2021/11/25/audio_91b32e02f9.mp3',
};

const GameBGM: React.FC<GameBGMProps> = ({ gameType, isPlaying = true }) => {
  const [isMuted, setIsMuted] = useState(() => {
    // Load muted state from localStorage
    const saved = localStorage.getItem('gameBgmMuted');
    return saved === 'true';
  });
  const [volume, setVolume] = useState(0.3);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
    audio.loop = true;

    if (isPlaying && !isMuted) {
      audio.play().catch(() => {
        // Autoplay might be blocked, that's okay
        console.log('Autoplay blocked, user needs to interact first');
      });
    } else {
      audio.pause();
    }

    return () => {
      audio.pause();
    };
  }, [isPlaying, isMuted, volume]);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem('gameBgmMuted', String(newMuted));

    if (audioRef.current) {
      if (newMuted) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  return (
    <>
      <audio ref={audioRef} src={BGM_URLS[gameType]} preload="auto" />
      <motion.button
        onClick={toggleMute}
        className="fixed bottom-20 right-4 z-50 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white shadow-lg border border-white/20"
        whileTap={{ scale: 0.9 }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
      >
        <AnimatePresence mode="wait">
          {isMuted ? (
            <motion.div
              key="muted"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
            >
              <VolumeX className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="playing"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
            >
              <Volume2 className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
      
      {/* Visual music indicator */}
      {!isMuted && isPlaying && (
        <motion.div
          className="fixed bottom-20 right-16 z-40 flex items-center gap-0.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="w-1 bg-white/60 rounded-full"
              animate={{
                height: [4, 16, 8, 12, 4],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>
      )}
    </>
  );
};

export default GameBGM;