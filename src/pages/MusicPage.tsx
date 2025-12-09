import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Music, Play, Pause, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const MusicPage: React.FC = () => {
  const navigate = useNavigate();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAudioUrl(URL.createObjectURL(file));
  };

  const togglePlay = () => {
    if (audioRef.current) {
      playing ? audioRef.current.pause() : audioRef.current.play();
      setPlaying(!playing);
    }
  };

  return (
    <div className="min-h-screen bg-background/80 backdrop-blur-sm p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/home')}><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-xl font-bold ml-2">音乐</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-10">
        <motion.div animate={{ rotate: playing ? 360 : 0 }} transition={{ repeat: playing ? Infinity : 0, duration: 3, ease: 'linear' }} className="w-48 h-48 rounded-full bg-gradient-to-br from-candy-purple to-candy-pink flex items-center justify-center shadow-glow mb-8">
          <Music className="w-20 h-20 text-white" />
        </motion.div>

        {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />}

        <div className="flex gap-4">
          {audioUrl && (
            <Button variant="candy" size="lg" onClick={togglePlay}>
              {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </Button>
          )}
          <label>
            <input type="file" accept="audio/*" onChange={handleUpload} className="hidden" />
            <Button variant="outline" size="lg" asChild><span><Upload className="w-5 h-5 mr-2" />上传音乐</span></Button>
          </label>
        </div>
      </div>
    </div>
  );
};
export default MusicPage;
