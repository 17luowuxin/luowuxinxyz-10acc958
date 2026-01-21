import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Trash2, Plus, Save, Eye, EyeOff, Shield, Image, MessageCircle, Users, Music, Settings, Camera, User, Palette, Star, Gamepad2, Mail, BookOpen, BarChart3, Hammer, Wallet, Edit, X, LayoutGrid, TrendingUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  app_icons: Record<string, string> | null;
  desktop_widgets: string[] | null;
  is_active: boolean;
  created_at: string;
}

interface ThemeForm {
  id?: string;
  name: string;
  description: string;
  preview_url: string;
  chat_background_url: string;
  global_background_url: string;
  lock_screen_bg_url: string;
  lock_screen_video_url: string;
  video_background_url: string;
  app_icons: Record<string, string>;
  desktop_widgets: string[];
}

const ADMIN_PASSWORD = '13160616007lxs'; // 管理员密码

// 所有APP图标配置 (16个)
const allAppIcons = [
  // 桌面应用 (12个)
  { id: 'album', name: '相册', icon: Image, color: 'bg-[#F06292]' },
  { id: 'camera', name: '相机', icon: Camera, color: 'bg-[#42A5F5]' },
  { id: 'profile', name: '我的', icon: User, color: 'bg-[#26A69A]' },
  { id: 'customize', name: '美化', icon: Palette, color: 'bg-[#FFA726]' },
  { id: 'space', name: '空间', icon: Star, color: 'bg-[#EC407A]' },
  { id: 'games', name: '游戏', icon: Gamepad2, color: 'bg-[#FFA726]' },
  { id: 'bottle', name: '漂流瓶', icon: Mail, color: 'bg-[#AB47BC]' },
  { id: 'diary', name: '日记', icon: BookOpen, color: 'bg-[#FF7043]' },
  { id: 'stats', name: '统计', icon: BarChart3, color: 'bg-[#66BB6A]' },
  { id: 'workshop', name: '工坊', icon: Hammer, color: 'bg-[#7E57C2]' },
  { id: 'finance', name: '财务', icon: Wallet, color: 'bg-[#FF9800]' },
  { id: 'visual-novel', name: '剧场', icon: BookOpen, color: 'bg-gradient-to-br from-pink-500 to-purple-600' },
  // Dock 图标 (4个)
  { id: 'friends', name: '好友', icon: MessageCircle, color: 'bg-[#42A5F5]' },
  { id: 'group', name: '群聊', icon: Users, color: 'bg-[#26A69A]' },
  { id: 'music', name: '音乐', icon: Music, color: 'bg-[#5C6BC0]' },
  { id: 'settings', name: '设置', icon: Settings, color: 'bg-[#78909C]' },
];

const emptyForm: ThemeForm = {
  name: '',
  description: '',
  preview_url: '',
  chat_background_url: '',
  global_background_url: '',
  lock_screen_bg_url: '',
  lock_screen_video_url: '',
  video_background_url: '',
  app_icons: {},
  desktop_widgets: ['', '', ''],
};

interface AppStats {
  totalUsers: number;
  totalCharacters: number;
  totalMessages: number;
  todayUsers: number;
}

interface TrendData {
  date: string;
  users: number;
  messages: number;
}

interface UserProfile {
  id: string;
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
}

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [stats, setStats] = useState<AppStats>({ totalUsers: 0, totalCharacters: 0, totalMessages: 0, todayUsers: 0 });
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [userList, setUserList] = useState<UserProfile[]>([]);
  const [showUserList, setShowUserList] = useState(false);
  
  // 编辑状态
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  
  // 主题表单
  const [themeForm, setThemeForm] = useState<ThemeForm>(emptyForm);
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
        fetchStats();
        fetchTrendData();
        fetchUserList();
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
        toast.error('设置管理员权限失败: ' + error.message);
        return;
      }
      
      setIsAdmin(true);
      setIsAuthenticated(true);
      fetchThemes();
      fetchStats();
      fetchTrendData();
      fetchUserList();
      toast.success('管理员登录成功');
    } else {
      toast.error('密码错误');
    }
  };

  const fetchStats = async () => {
    try {
      const [usersRes, charsRes, msgsRes, todayRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('characters').select('*', { count: 'exact', head: true }),
        supabase.from('chat_messages').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', new Date().toISOString().split('T')[0]),
      ]);
      
      setStats({
        totalUsers: usersRes.count || 0,
        totalCharacters: charsRes.count || 0,
        totalMessages: msgsRes.count || 0,
        todayUsers: todayRes.count || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchTrendData = async () => {
    try {
      // 获取过去30天的数据
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const [usersRes, msgsRes] = await Promise.all([
        supabase.from('profiles')
          .select('created_at')
          .gte('created_at', thirtyDaysAgo.toISOString()),
        supabase.from('chat_messages')
          .select('created_at')
          .gte('created_at', thirtyDaysAgo.toISOString()),
      ]);
      
      // 按日期分组
      const dateMap: Record<string, { users: number; messages: number }> = {};
      
      // 初始化过去30天的日期
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dateMap[dateStr] = { users: 0, messages: 0 };
      }
      
      // 统计用户
      (usersRes.data || []).forEach(item => {
        const date = item.created_at.split('T')[0];
        if (dateMap[date]) {
          dateMap[date].users++;
        }
      });
      
      // 统计消息
      (msgsRes.data || []).forEach(item => {
        const date = item.created_at.split('T')[0];
        if (dateMap[date]) {
          dateMap[date].messages++;
        }
      });
      
      // 转换为数组
      const trend = Object.entries(dateMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({
          date: date.slice(5), // 只显示月-日
          users: data.users,
          messages: data.messages,
        }));
      
      setTrendData(trend);
    } catch (err) {
      console.error('Error fetching trend data:', err);
    }
  };

  const fetchUserList = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setUserList(data || []);
    } catch (err) {
      console.error('Error fetching user list:', err);
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
    
    // Cast to Theme[] since desktop_widgets is a new column not yet in generated types
    const themesData = (data || []).map(item => {
      const themeItem = item as Record<string, unknown>;
      return {
        id: themeItem.id as string,
        name: themeItem.name as string,
        description: themeItem.description as string | null,
        preview_url: themeItem.preview_url as string | null,
        app_icon_url: themeItem.app_icon_url as string | null,
        chat_background_url: themeItem.chat_background_url as string | null,
        global_background_url: themeItem.global_background_url as string | null,
        lock_screen_bg_url: themeItem.lock_screen_bg_url as string | null,
        lock_screen_video_url: themeItem.lock_screen_video_url as string | null,
        video_background_url: themeItem.video_background_url as string | null,
        app_icons: themeItem.app_icons as Record<string, string> | null,
        desktop_widgets: (themeItem.desktop_widgets as string[]) || null,
        is_active: themeItem.is_active as boolean,
        created_at: themeItem.created_at as string,
      };
    });
    setThemes(themesData);
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('themes')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) {
      console.error('Upload error:', error);
      toast.error('上传失败: ' + error.message);
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
      setThemeForm(prev => ({ ...prev, [field]: url }));
      toast.success('上传成功');
    }
    setUploading(null);
  };

  const handleAppIconUpload = async (e: React.ChangeEvent<HTMLInputElement>, appId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(`app_${appId}`);
    const url = await uploadFile(file, `app_icons/${appId}`);
    if (url) {
      setThemeForm(prev => ({
        ...prev,
        app_icons: { ...prev.app_icons, [appId]: url }
      }));
      toast.success('图标上传成功');
    }
    setUploading(null);
  };

  const handleDesktopWidgetUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(`widget_${index}`);
    const url = await uploadFile(file, `desktop_widgets`);
    if (url) {
      setThemeForm(prev => {
        const newWidgets = [...prev.desktop_widgets];
        newWidgets[index] = url;
        return { ...prev, desktop_widgets: newWidgets };
      });
      toast.success('桌面大图上传成功');
    }
    setUploading(null);
  };

  const handleSaveTheme = async () => {
    if (!themeForm.name) {
      toast.error('请输入主题名称');
      return;
    }
    
    const themeData = {
      name: themeForm.name,
      description: themeForm.description,
      preview_url: themeForm.preview_url,
      chat_background_url: themeForm.chat_background_url,
      global_background_url: themeForm.global_background_url,
      lock_screen_bg_url: themeForm.lock_screen_bg_url,
      lock_screen_video_url: themeForm.lock_screen_video_url,
      video_background_url: themeForm.video_background_url,
      app_icons: themeForm.app_icons,
      desktop_widgets: themeForm.desktop_widgets.filter(w => w),
      is_active: true,
    };

    if (editingTheme) {
      // 更新主题
      const { error } = await supabase
        .from('themes')
        .update(themeData)
        .eq('id', editingTheme.id);
      
      if (error) {
        console.error('Error updating theme:', error);
        toast.error('更新失败');
        return;
      }
      
      toast.success('主题更新成功');
      setEditingTheme(null);
    } else {
      // 创建新主题
      const { error } = await supabase
        .from('themes')
        .insert({
          ...themeData,
          created_by: user?.id,
        });
      
      if (error) {
        console.error('Error saving theme:', error);
        toast.error('保存失败');
        return;
      }
      
      toast.success('主题保存成功');
    }
    
    setThemeForm(emptyForm);
    fetchThemes();
  };

  const startEditTheme = (theme: Theme) => {
    setEditingTheme(theme);
    setThemeForm({
      id: theme.id,
      name: theme.name,
      description: theme.description || '',
      preview_url: theme.preview_url || '',
      chat_background_url: theme.chat_background_url || '',
      global_background_url: theme.global_background_url || '',
      lock_screen_bg_url: theme.lock_screen_bg_url || '',
      lock_screen_video_url: theme.lock_screen_video_url || '',
      video_background_url: theme.video_background_url || '',
      app_icons: theme.app_icons || {},
      desktop_widgets: theme.desktop_widgets || ['', '', ''],
    });
    // 滚动到表单
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingTheme(null);
    setThemeForm(emptyForm);
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

  const backgroundFields = [
    { key: 'preview_url', label: '主题预览图', accept: 'image/*' },
    { key: 'chat_background_url', label: '聊天背景', accept: 'image/*' },
    { key: 'global_background_url', label: '桌面壁纸', accept: 'image/*' },
    { key: 'lock_screen_bg_url', label: '锁屏壁纸', accept: 'image/*' },
    { key: 'lock_screen_video_url', label: '锁屏视频', accept: 'video/*' },
    { key: 'video_background_url', label: '动态壁纸', accept: 'video/*' },
  ];

  const uploadedIconsCount = Object.keys(themeForm.app_icons).length;
  const uploadedWidgetsCount = themeForm.desktop_widgets.filter(w => w).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold">管理后台</h1>
          </div>
          <Shield className="w-5 h-5 text-primary" />
        </div>
      </div>

      <div className="p-4 space-y-6 pb-20">
        {/* 用户统计 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">总用户数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.todayUsers}</p>
                  <p className="text-xs text-muted-foreground">今日新增</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Star className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalCharacters}</p>
                  <p className="text-xs text-muted-foreground">角色总数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-pink-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">消息总数</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 数据趋势图表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              数据趋势（近30天）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 用户增长趋势 */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                每日新增用户
              </h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="users" fill="hsl(217.2 91.2% 59.8%)" name="新增用户" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 消息活跃度趋势 */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-pink-500" />
                每日消息量
              </h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="messages" 
                      stroke="hsl(330.4 81.2% 60.4%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(330.4 81.2% 60.4%)', strokeWidth: 0, r: 3 }}
                      name="消息数量"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                用户列表
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowUserList(!showUserList)}
              >
                {showUserList ? '收起' : '展开'}
              </Button>
            </CardTitle>
          </CardHeader>
          {showUserList && (
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {userList.map((profile, index) => (
                    <div 
                      key={profile.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
                      {profile.avatar_url ? (
                        <img 
                          src={profile.avatar_url} 
                          alt="" 
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {profile.nickname || '未设置昵称'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ID: {profile.user_id.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(profile.created_at).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          )}
        </Card>

        {/* 新建/编辑主题 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {editingTheme ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingTheme ? '编辑主题' : '创建新主题'}
              </div>
              {editingTheme && (
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  <X className="w-4 h-4 mr-1" />
                  取消编辑
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>主题名称 *</Label>
              <Input
                value={themeForm.name}
                onChange={(e) => setThemeForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="输入主题名称"
              />
            </div>
            
            <div>
              <Label>主题描述</Label>
              <Textarea
                value={themeForm.description}
                onChange={(e) => setThemeForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="输入主题描述"
                rows={2}
              />
            </div>

            <Tabs defaultValue="backgrounds" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="backgrounds">壁纸背景</TabsTrigger>
                <TabsTrigger value="icons">
                  APP图标 ({uploadedIconsCount}/15)
                </TabsTrigger>
                <TabsTrigger value="widgets">
                  桌面大图 ({uploadedWidgetsCount}/3)
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="backgrounds" className="mt-4">
                <div className="grid grid-cols-2 gap-3">
                  {backgroundFields.map(({ key, label, accept }) => (
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
                        <div className={`border-2 border-dashed rounded-lg p-3 text-center ${themeForm[key as keyof ThemeForm] ? 'border-primary bg-primary/5' : 'border-muted'}`}>
                          {uploading === key ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto" />
                          ) : themeForm[key as keyof ThemeForm] ? (
                            <div className="text-xs text-primary truncate">已上传</div>
                          ) : (
                            <Upload className="w-5 h-5 mx-auto text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="icons" className="mt-4">
                <p className="text-xs text-muted-foreground mb-3">
                  上传15个APP图标，让用户一键应用完整主题
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {allAppIcons.map((app) => {
                    const IconComponent = app.icon;
                    const hasIcon = themeForm.app_icons[app.id];
                    const isUploading = uploading === `app_${app.id}`;
                    
                    return (
                      <div key={app.id} className="flex flex-col items-center gap-1">
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleAppIconUpload(e, app.id)}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            disabled={isUploading}
                          />
                          {hasIcon ? (
                            <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-primary">
                              <img src={hasIcon} alt={app.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className={`w-12 h-12 rounded-xl ${app.color} flex items-center justify-center relative`}>
                              {isUploading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                              ) : (
                                <>
                                  <IconComponent className="w-5 h-5 text-white" />
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-muted rounded-full flex items-center justify-center">
                                    <Plus className="w-3 h-3" />
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{app.name}</span>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="widgets" className="mt-4">
                <p className="text-xs text-muted-foreground mb-3">
                  上传3张桌面大图，显示在用户桌面上
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((index) => {
                    const widgetUrl = themeForm.desktop_widgets[index];
                    const isUploading = uploading === `widget_${index}`;
                    
                    return (
                      <div key={index} className="space-y-2">
                        <Label className="text-xs">大图 {index + 1}</Label>
                        <div className="relative aspect-[4/3]">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleDesktopWidgetUpload(e, index)}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            disabled={isUploading}
                          />
                          {widgetUrl ? (
                            <div className="w-full h-full rounded-lg overflow-hidden ring-2 ring-primary">
                              <img src={widgetUrl} alt={`大图${index + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-full h-full border-2 border-dashed border-muted rounded-lg flex flex-col items-center justify-center">
                              {isUploading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                              ) : (
                                <>
                                  <LayoutGrid className="w-6 h-6 text-muted-foreground mb-1" />
                                  <span className="text-xs text-muted-foreground">点击上传</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>

            <Button className="w-full" onClick={handleSaveTheme}>
              <Save className="w-4 h-4 mr-2" />
              {editingTheme ? '更新主题' : '保存主题'}
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
                    className={`flex items-center gap-3 p-3 rounded-lg border bg-card ${editingTheme?.id === theme.id ? 'ring-2 ring-primary' : ''}`}
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
                        {theme.app_icons ? `${Object.keys(theme.app_icons).length}个图标` : '无图标'} 
                        · {theme.desktop_widgets ? `${theme.desktop_widgets.length}张大图` : '无大图'}
                        · {theme.description || '无描述'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditTheme(theme)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
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
