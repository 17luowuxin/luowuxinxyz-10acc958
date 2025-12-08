import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const AlbumPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<any[]>([]);

  useEffect(() => {
    if (user) fetchPhotos();
  }, [user]);

  const fetchPhotos = async () => {
    const { data } = await supabase.from('photos').select('*').eq('user_id', user?.id).order('created_at', { ascending: false });
    if (data) setPhotos(data);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const filePath = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, file);
    
    if (uploadError) {
      toast.error('上传失败');
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(filePath);
    await supabase.from('photos').insert({ user_id: user.id, url: publicUrl });
    toast.success('上传成功!');
    fetchPhotos();
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold">相册</h1>
        <label>
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          <Button variant="ghost" size="icon" asChild>
            <span><Plus className="w-6 h-6" /></span>
          </Button>
        </label>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-2">
        {photos.map((photo, i) => (
          <motion.div key={photo.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="aspect-square rounded-xl overflow-hidden bg-muted">
            <img src={photo.url} alt="" className="w-full h-full object-cover" />
          </motion.div>
        ))}
        {photos.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
            <p>暂无图片，点击右上角添加</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AlbumPage;
