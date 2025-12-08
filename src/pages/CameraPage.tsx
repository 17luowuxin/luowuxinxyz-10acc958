import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CameraPage: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      setPhoto(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/home')}><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-xl font-bold ml-2">相机</h1>
      </div>

      <div className="flex flex-col items-center">
        {photo ? (
          <>
            <img src={photo} className="w-full max-w-sm rounded-2xl mb-4" />
            <Button variant="outline" onClick={() => setPhoto(null)}><RotateCcw className="w-4 h-4 mr-2" />重拍</Button>
          </>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-sm rounded-2xl bg-muted mb-4" />
            {!streaming ? (
              <Button variant="candy" onClick={startCamera}><Camera className="w-5 h-5 mr-2" />打开相机</Button>
            ) : (
              <Button variant="candy" size="lg" onClick={takePhoto}><Camera className="w-6 h-6" /></Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default CameraPage;
