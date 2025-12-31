import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Trash2, Plus, Save, Eye, EyeOff, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Theme {
  id: string;
  name: string;
  description: string | null;
  preview_url: string | null;
  app_icon_url: string | null;
  chat_background_url: string | null;
  global_background_url: string | null;
  lock_screen_bg_url: string | null;
  lock_screen_video_url: string | null;
  video_background_url: string | null;
  is_active: boolean;
  created_at: string;
}

const ADMIN_PASSWORD = '13160616007lxs'; // 管理员密码

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  
  // 新主题表单
  const [newTheme, setNewTheme] = useState({
    name: '',
    description: '',
    preview_url: '',
    app_icon_url: '',
    chat_background_url: '',
    global_background_url: '',
    lock_screen_bg_url: '',
    lock_screen_video_url: '',
    video_background_url: '',
  });
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      checkAdminRole();
    } else {
      setLoading(false);
    }
  }, [user]);

  const checkAdminRole = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (data) {
        setIsAdmin(true);
        setIsAuthenticated(true);
        fetchThemes();
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('Error checking admin role:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (password === ADMIN_PASSWORD) {
      if (!user) {
        toast.error('请先登录账号');
        return;
      }
      
      // 添加管理员角色
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id,role' });
      
      if (error) {
        console.error('Error adding admin role:', error);
        toast.error('设置管理员权限失败');
        return;
      }
      
      setIsAdmin(true);
      setIsAuthenticated(true);
      fetchThemes();
      toast.success('管理员登录成功');
    } else {
      toast.error('密码错误');
    }
  };

  const fetchThemes = async () => {
    const { data, error } = await supabase
      .from('themes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching themes:', error);
      return;
    }
    
    setThemes(data || []);
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('themes')
      .upload(fileName, file);
    
    if (error) {
      console.error('Upload error:', error);
      toast.error('上传失败');
      return null;
    }
    
    const { data } = supabase.storage.from('themes').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(field);
    const url = await uploadFile(file, field);
    if (url) {
      setNewTheme(prev => ({ ...prev, [field]: url }));
      toast.success('上传成功');
    }
    setUploading(null);
  };

  const handleSaveTheme = async () => {
    if (!newTheme.name) {
      toast.error('请输入主题名称');
      return;
    }
    
    const { error } = await supabase
      .from('themes')
      .insert({
        ...newTheme,
        created_by: user?.id,
        is_active: true,
      });
    
    if (error) {
      console.error('Error saving theme:', error);
      toast.error('保存失败');
      return;
    }
    
    toast.success('主题保存成功');
    setNewTheme({
      name: '',
      description: '',
      preview_url: '',
      app_icon_url: '',
      chat_background_url: '',
      global_background_url: '',
      lock_screen_bg_url: '',
      lock_screen_video_url: '',
      video_background_url: '',
    });
    fetchThemes();
  };

  const toggleThemeActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('themes')
      .update({ is_active: !isActive })
      .eq('id', id);
    
    if (error) {
      toast.error('更新失败');
      return;
    }
    
    fetchThemes();
    toast.success(isActive ? '已隐藏主题' : '已激活主题');
  };

  const deleteTheme = async (id: string) => {
    const { error } = await supabase
      .from('themes')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('删除失败');
      return;
    }
    
    fetchThemes();
    toast.success('主题已删除');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold mb-2">请先登录</h1>
        <p className="text-muted-foreground mb-4">需要登录账号才能访问管理后台</p>
        <Button onClick={() => navigate('/auth')}>前往登录</Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <Shield className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold">管理员后台</h1>
            <p className="text-muted-foreground mt-2">请输入管理员密码</p>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="输入管理员密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button className="w-full" onClick={handlePasswordLogin}>
                  登录
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate(-1)}>
                  返回
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const uploadFields = [
    { key: 'preview_url', label: '主题预览图', accept: 'image/*' },
    { key: 'app_icon_url', label: 'APP图标', accept: 'image/*' },
    { key: 'chat_background_url', label: '聊天背景', accept: 'image/*' },
    { key: 'global_background_url', label: '桌面壁纸', accept: 'image/*' },
    { key: 'lock_screen_bg_url', label: '锁屏壁纸', accept: 'image/*' },
    { key: 'lock_screen_video_url', label: '锁屏视频', accept: 'video/*' },
    { key: 'video_background_url', label: '动态壁纸', accept: 'video/*' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold">主题管理</h1>
          </div>
          <Shield className="w-5 h-5 text-primary" />
        </div>
      </div>

      <div className="p-4 space-y-6 pb-20">
        {/* 新建主题 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              创建新主题
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>主题名称 *</Label>
              <Input
                value={newTheme.name}
                onChange={(e) => setNewTheme(prev => ({ ...prev, name: e.target.value }))}
                placeholder="输入主题名称"
              />
            </div>
            
            <div>
              <Label>主题描述</Label>
              <Textarea
                value={newTheme.description}
                onChange={(e) => setNewTheme(prev => ({ ...prev, description: e.target.value }))}
                placeholder="输入主题描述"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {uploadFields.map(({ key, label, accept }) => (
                <div key={key} className="space-y-2">
                  <Label className="text-xs">{label}</Label>
                  <div className="relative">
                    <input
                      type="file"
                      accept={accept}
                      onChange={(e) => handleFileUpload(e, key)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploading === key}
                    />
                    <div className={`border-2 border-dashed rounded-lg p-3 text-center ${newTheme[key as keyof typeof newTheme] ? 'border-primary bg-primary/5' : 'border-muted'}`}>
                      {uploading === key ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto" />
                      ) : newTheme[key as keyof typeof newTheme] ? (
                        <div className="text-xs text-primary truncate">已上传</div>
                      ) : (
                        <Upload className="w-5 h-5 mx-auto text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button className="w-full" onClick={handleSaveTheme}>
              <Save className="w-4 h-4 mr-2" />
              保存主题
            </Button>
          </CardContent>
        </Card>

        {/* 主题列表 */}
        <Card>
          <CardHeader>
            <CardTitle>已创建的主题 ({themes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {themes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">暂无主题</p>
            ) : (
              <div className="space-y-3">
                {themes.map((theme) => (
                  <motion.div
                    key={theme.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    {theme.preview_url ? (
                      <img
                        src={theme.preview_url}
                        alt={theme.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <Shield className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{theme.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {theme.description || '无描述'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={theme.is_active}
                        onCheckedChange={() => toggleThemeActive(theme.id, theme.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteTheme(theme.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPage;
