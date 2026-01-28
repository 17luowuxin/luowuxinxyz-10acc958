import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Image as ImageIcon, FolderPlus, Folder, X, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Album {
  id: string;
  name: string;
  cover_url?: string;
  created_at: string;
}

interface Photo {
  id: string;
  url: string;
  album_id?: string;
  created_at: string;
}

const AlbumPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [deleteAlbumId, setDeleteAlbumId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchAlbums();
      fetchPhotos();
    }
  }, [user]);

  const fetchAlbums = async () => {
    const { data } = await supabase
      .from('albums')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    if (data) setAlbums(data);
  };

  const fetchPhotos = async (albumId?: string) => {
    let query = supabase
      .from('photos')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (albumId) {
      query = query.eq('album_id', albumId);
    } else {
      query = query.is('album_id', null);
    }
    
    const { data } = await query;
    if (data) setPhotos(data);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      // 压缩图片（最大宽度1080px，质量0.8）
      const { compressImage, blobToFile } = await import('@/utils/imageCompressor');
      const compressedBlob = await compressImage(file, 1080, 0.8);
      const compressedFile = blobToFile(compressedBlob, file.name);
      
      const filePath = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, compressedFile);
      
      if (uploadError) {
        toast.error('上传失败');
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(filePath);
      await supabase.from('photos').insert({ 
        user_id: user.id, 
        url: publicUrl,
        album_id: currentAlbum?.id || null
      });
      toast.success('上传成功!');
      fetchPhotos(currentAlbum?.id);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('上传失败');
    }
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim() || !user) return;
    
    const { error } = await supabase.from('albums').insert({
      user_id: user.id,
      name: newAlbumName.trim()
    });
    
    if (error) {
      toast.error('创建失败');
      return;
    }
    
    toast.success('相册创建成功!');
    setNewAlbumName('');
    setShowCreateAlbum(false);
    fetchAlbums();
  };

  const handleDeleteAlbum = async () => {
    if (!deleteAlbumId) return;
    
    // 将相册中的照片移到未分类
    await supabase
      .from('photos')
      .update({ album_id: null })
      .eq('album_id', deleteAlbumId);
    
    await supabase.from('albums').delete().eq('id', deleteAlbumId);
    toast.success('相册已删除');
    setDeleteAlbumId(null);
    fetchAlbums();
    if (currentAlbum?.id === deleteAlbumId) {
      setCurrentAlbum(null);
      fetchPhotos();
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    await supabase.from('photos').delete().eq('id', photoId);
    toast.success('照片已删除');
    setSelectedPhoto(null);
    fetchPhotos(currentAlbum?.id);
  };

  const openAlbum = (album: Album) => {
    setCurrentAlbum(album);
    fetchPhotos(album.id);
  };

  const goBack = () => {
    if (currentAlbum) {
      setCurrentAlbum(null);
      fetchPhotos();
    } else {
      navigate('/home');
    }
  };

  return (
    <div className="min-h-screen bg-background/80 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold">
          {currentAlbum ? currentAlbum.name : '相册'}
        </h1>
        <div className="flex gap-1">
          {!currentAlbum && (
            <Button variant="ghost" size="icon" onClick={() => setShowCreateAlbum(true)}>
              <FolderPlus className="w-6 h-6" />
            </Button>
          )}
          <label>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            <Button variant="ghost" size="icon" asChild>
              <span><Plus className="w-6 h-6" /></span>
            </Button>
          </label>
        </div>
      </div>

      {/* 相册列表 */}
      {!currentAlbum && albums.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">相册合集</h2>
          <div className="grid grid-cols-2 gap-3">
            {albums.map((album) => (
              <motion.div
                key={album.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative bg-card rounded-2xl p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openAlbum(album)}
              >
                <div className="aspect-square rounded-xl bg-muted flex items-center justify-center mb-2 overflow-hidden">
                  {album.cover_url ? (
                    <img src={album.cover_url} className="w-full h-full object-cover" />
                  ) : (
                    <Folder className="w-12 h-12 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate flex-1">{album.name}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 w-7 h-7 bg-background/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteAlbumId(album.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 照片网格 */}
      <div>
        {!currentAlbum && <h2 className="text-sm font-medium text-muted-foreground mb-3">所有照片</h2>}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <motion.div 
              key={photo.id} 
              initial={{ opacity: 0, scale: 0.8 }} 
              animate={{ opacity: 1, scale: 1 }} 
              transition={{ delay: i * 0.05 }} 
              className="aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer"
              onClick={() => setSelectedPhoto(photo)}
            >
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
            </motion.div>
          ))}
          {photos.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
              <p>{currentAlbum ? '相册暂无图片' : '暂无图片，点击右上角添加'}</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* 创建相册对话框 */}
      <Dialog open={showCreateAlbum} onOpenChange={setShowCreateAlbum}>
        <DialogContent className="max-w-[90%] rounded-2xl">
          <DialogHeader>
            <DialogTitle>创建相册</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={newAlbumName}
              onChange={(e) => setNewAlbumName(e.target.value)}
              placeholder="相册名称"
            />
            <Button variant="candy" className="w-full" onClick={handleCreateAlbum}>
              创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 照片预览 */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white"
              onClick={() => setSelectedPhoto(null)}
            >
              <X className="w-6 h-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-4 right-4 text-white"
              onClick={(e) => {
                e.stopPropagation();
                handleDeletePhoto(selectedPhoto.id);
              }}
            >
              <Trash2 className="w-6 h-6" />
            </Button>
            <img 
              src={selectedPhoto.url} 
              alt="" 
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 删除相册确认 */}
      <AlertDialog open={!!deleteAlbumId} onOpenChange={() => setDeleteAlbumId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除相册？</AlertDialogTitle>
            <AlertDialogDescription>
              相册将被删除，其中的照片会移到未分类。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAlbum} className="bg-destructive text-destructive-foreground">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AlbumPage;