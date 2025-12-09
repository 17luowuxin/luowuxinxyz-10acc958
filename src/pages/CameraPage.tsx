import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, RotateCcw, Download, Sparkles, Frame, Sticker, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

// 滤镜预设
const FILTERS = [
  { id: 'none', name: '原图', filter: '' },
  { id: 'warm', name: '暖阳', filter: 'sepia(0.3) saturate(1.3) brightness(1.05)' },
  { id: 'cool', name: '清冷', filter: 'saturate(0.8) hue-rotate(20deg) brightness(1.1)' },
  { id: 'vintage', name: '复古', filter: 'sepia(0.5) contrast(1.1) brightness(0.95)' },
  { id: 'pink', name: '少女', filter: 'saturate(1.2) hue-rotate(-10deg) brightness(1.05)' },
  { id: 'bw', name: '黑白', filter: 'grayscale(1) contrast(1.2)' },
  { id: 'drama', name: '戏剧', filter: 'contrast(1.4) saturate(1.3) brightness(0.9)' },
  { id: 'soft', name: '柔和', filter: 'contrast(0.9) brightness(1.1) saturate(0.9)' },
];

// 相框预设
const FRAMES = [
  { id: 'none', name: '无', border: '' },
  { id: 'white', name: '白框', border: '8px solid white' },
  { id: 'black', name: '黑框', border: '8px solid black' },
  { id: 'pink', name: '粉框', border: '8px solid #FFB5C5' },
  { id: 'gold', name: '金框', border: '8px solid #D4AF37' },
  { id: 'polaroid', name: '拍立得', border: 'polaroid' },
  { id: 'rounded', name: '圆角', border: 'rounded' },
  { id: 'double', name: '双线', border: 'double 6px #333' },
];

// 贴纸预设
const STICKERS = [
  { id: 'heart', emoji: '❤️' },
  { id: 'star', emoji: '⭐' },
  { id: 'sparkle', emoji: '✨' },
  { id: 'flower', emoji: '🌸' },
  { id: 'butterfly', emoji: '🦋' },
  { id: 'rainbow', emoji: '🌈' },
  { id: 'crown', emoji: '👑' },
  { id: 'kiss', emoji: '💋' },
  { id: 'cat', emoji: '🐱' },
  { id: 'bunny', emoji: '🐰' },
  { id: 'bear', emoji: '🐻' },
  { id: 'moon', emoji: '🌙' },
];

interface StickerItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
}

const CameraPage: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState<'filter' | 'frame' | 'sticker'>('filter');
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [selectedFrame, setSelectedFrame] = useState('none');
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [draggingSticker, setDraggingSticker] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('无法访问相机');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setStreaming(false);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        setPhoto(canvas.toDataURL('image/png'));
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    setSelectedFilter('none');
    setSelectedFrame('none');
    setStickers([]);
    startCamera();
  };

  const addSticker = (emoji: string) => {
    const newSticker: StickerItem = {
      id: Date.now().toString(),
      emoji,
      x: 50,
      y: 50,
      size: 48,
    };
    setStickers(prev => [...prev, newSticker]);
  };

  const removeSticker = (id: string) => {
    setStickers(prev => prev.filter(s => s.id !== id));
  };

  const handleStickerDrag = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDraggingSticker(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingSticker) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setStickers(prev => prev.map(s => 
        s.id === draggingSticker ? { ...s, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : s
      ));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggingSticker && e.touches[0]) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
      const y = ((e.touches[0].clientY - rect.top) / rect.height) * 100;
      setStickers(prev => prev.map(s => 
        s.id === draggingSticker ? { ...s, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : s
      ));
    }
  };

  const handleDragEnd = () => {
    setDraggingSticker(null);
  };

  const getFrameStyle = () => {
    const frame = FRAMES.find(f => f.id === selectedFrame);
    if (!frame || frame.id === 'none') return {};
    
    if (frame.border === 'polaroid') {
      return {
        border: '12px solid white',
        borderBottom: '48px solid white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      };
    }
    if (frame.border === 'rounded') {
      return {
        border: '6px solid white',
        borderRadius: '24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      };
    }
    return { border: frame.border };
  };

  const saveToLocal = async () => {
    if (!photo) return;
    
    // 创建最终画布包含滤镜、相框和贴纸
    const finalCanvas = document.createElement('canvas');
    const img = new Image();
    img.src = photo;
    
    await new Promise(resolve => { img.onload = resolve; });
    
    finalCanvas.width = img.width;
    finalCanvas.height = img.height;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;
    
    // 应用滤镜
    const filter = FILTERS.find(f => f.id === selectedFilter);
    if (filter?.filter) {
      ctx.filter = filter.filter;
    }
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';
    
    // 绘制贴纸
    for (const sticker of stickers) {
      ctx.font = `${sticker.size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const x = (sticker.x / 100) * finalCanvas.width;
      const y = (sticker.y / 100) * finalCanvas.height;
      ctx.fillText(sticker.emoji, x, y);
    }
    
    // 下载
    const link = document.createElement('a');
    link.download = `photo-${Date.now()}.png`;
    link.href = finalCanvas.toDataURL('image/png');
    link.click();
    
    toast.success('照片已保存到本地!');
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="min-h-screen bg-background/80 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold ml-2">相机</h1>
      </div>

      {/* Photo/Video Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div 
          className="relative w-full max-w-sm overflow-hidden bg-muted rounded-2xl"
          style={photo ? getFrameStyle() : {}}
          onMouseMove={handleMouseMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleDragEnd}
        >
          {photo ? (
            <>
              <img 
                src={photo} 
                className="w-full aspect-[3/4] object-cover"
                style={{ 
                  filter: FILTERS.find(f => f.id === selectedFilter)?.filter || '',
                  borderRadius: selectedFrame === 'rounded' ? '18px' : '0',
                }}
              />
              {/* 贴纸层 */}
              {stickers.map(sticker => (
                <div
                  key={sticker.id}
                  className="absolute cursor-move select-none"
                  style={{
                    left: `${sticker.x}%`,
                    top: `${sticker.y}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: sticker.size,
                    zIndex: 10,
                  }}
                  onMouseDown={(e) => handleStickerDrag(sticker.id, e)}
                  onTouchStart={(e) => handleStickerDrag(sticker.id, e)}
                >
                  {sticker.emoji}
                  <button
                    className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs"
                    onClick={() => removeSticker(sticker.id)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full aspect-[3/4] object-cover" 
            />
          )}
        </div>
        
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      {photo ? (
        <div className="p-4 space-y-4">
          {/* 编辑选项卡 */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="filter" className="gap-1">
                <Sparkles className="w-4 h-4" />滤镜
              </TabsTrigger>
              <TabsTrigger value="frame" className="gap-1">
                <Frame className="w-4 h-4" />相框
              </TabsTrigger>
              <TabsTrigger value="sticker" className="gap-1">
                <Sticker className="w-4 h-4" />贴纸
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* 滤镜选项 */}
          {activeTab === 'filter' && (
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {FILTERS.map(filter => (
                <button
                  key={filter.id}
                  className={`flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedFilter === filter.id ? 'border-primary scale-105' : 'border-transparent'
                  }`}
                  onClick={() => setSelectedFilter(filter.id)}
                >
                  <img 
                    src={photo} 
                    className="w-full h-14 object-cover"
                    style={{ filter: filter.filter }}
                  />
                  <p className="text-xs text-center py-1">{filter.name}</p>
                </button>
              ))}
            </div>
          )}

          {/* 相框选项 */}
          {activeTab === 'frame' && (
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {FRAMES.map(frame => (
                <button
                  key={frame.id}
                  className={`flex-shrink-0 w-16 h-20 rounded-lg flex flex-col items-center justify-center border-2 transition-all ${
                    selectedFrame === frame.id ? 'border-primary bg-primary/10' : 'border-muted bg-muted'
                  }`}
                  onClick={() => setSelectedFrame(frame.id)}
                >
                  <div className="w-10 h-10 bg-card rounded border flex items-center justify-center">
                    {frame.id === 'none' ? <X className="w-4 h-4 text-muted-foreground" /> : 
                     frame.id === 'polaroid' ? <div className="w-6 h-8 bg-white border shadow-sm" style={{borderBottom: '12px solid white'}} /> :
                     <div className="w-6 h-6 bg-muted" style={frame.border !== 'polaroid' && frame.border !== 'rounded' ? {border: frame.border.replace('8px', '2px')} : {}} />
                    }
                  </div>
                  <p className="text-xs mt-1">{frame.name}</p>
                </button>
              ))}
            </div>
          )}

          {/* 贴纸选项 */}
          {activeTab === 'sticker' && (
            <div className="grid grid-cols-6 gap-2">
              {STICKERS.map(sticker => (
                <button
                  key={sticker.id}
                  className="w-12 h-12 flex items-center justify-center text-2xl bg-muted rounded-lg hover:bg-primary/10 transition-colors"
                  onClick={() => addSticker(sticker.emoji)}
                >
                  {sticker.emoji}
                </button>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={retakePhoto}>
              <RotateCcw className="w-4 h-4 mr-2" />重拍
            </Button>
            <Button variant="candy" className="flex-1" onClick={saveToLocal}>
              <Download className="w-4 h-4 mr-2" />保存本地
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 flex justify-center">
          {!streaming ? (
            <Button variant="candy" size="lg" onClick={startCamera}>
              <Camera className="w-5 h-5 mr-2" />打开相机
            </Button>
          ) : (
            <Button 
              variant="candy" 
              size="lg" 
              className="w-16 h-16 rounded-full"
              onClick={takePhoto}
            >
              <Camera className="w-8 h-8" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default CameraPage;