import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Trash2, Plus, Save, Shield, Image, MessageCircle, Users, Music, Settings, Camera, User, Palette, Star, Gamepad2, Mail, BookOpen, BarChart3, Hammer, Wallet, Edit, X, LayoutGrid, TrendingUp, Calendar, AlertTriangle, Clock, RefreshCw, Megaphone, Search, KeyRound, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import InviteCodeManager from '@/components/admin/InviteCodeManager';

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

// Admin authentication is now handled server-side via user_roles table

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

interface ActivityTrendData {
  date: string;
  activeUsers: number;
  totalSessions: number;
}


interface AdminUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  last_activity_at: string | null;
  message_count: number;
  nickname: string | null;
  avatar_url: string | null;
}

interface InactiveUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  last_activity_at: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  wechat_id: string | null;
  is_active: boolean;
}

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AppStats>({ totalUsers: 0, totalCharacters: 0, totalMessages: 0, todayUsers: 0 });
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [activityTrend, setActivityTrend] = useState<ActivityTrendData[]>([]);
  const [weeklyActiveUsers, setWeeklyActiveUsers] = useState(0);
  const [todayActiveUsers, setTodayActiveUsers] = useState(0);
  
  // 用户搜索
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // 新增状态：管理用户
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUser[]>([]);
  const [inactiveMonths, setInactiveMonths] = useState<string>('6');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  
  // 密码重置状态
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  
  // 公告管理状态
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    wechat_id: '',
    is_active: true
  });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  
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
        fetchActivityTrend();
        fetchAdminUsers();
        fetchAnnouncement();
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('Error checking admin role:', err);
    } finally {
      setLoading(false);
    }
  };

  // 获取公告
  const fetchAnnouncement = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setAnnouncement(data);
      setAnnouncementForm({
        title: data.title || '',
        content: data.content || '',
        wechat_id: data.wechat_id || '',
        is_active: data.is_active ?? true
      });
    }
  };

  // 保存公告
  const saveAnnouncement = async () => {
    setSavingAnnouncement(true);
    try {
      if (announcement) {
        // 更新
        const { error } = await supabase
          .from('announcements')
          .update({
            title: announcementForm.title,
            content: announcementForm.content,
            wechat_id: announcementForm.wechat_id || null,
            is_active: announcementForm.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', announcement.id);
        
        if (error) throw error;
        toast.success('公告已更新');
      } else {
        // 新建
        const { error } = await supabase
          .from('announcements')
          .insert({
            title: announcementForm.title,
            content: announcementForm.content,
            wechat_id: announcementForm.wechat_id || null,
            is_active: announcementForm.is_active
          });
        
        if (error) throw error;
        toast.success('公告已创建');
      }
      
      fetchAnnouncement();
    } catch (err) {
      console.error('Error saving announcement:', err);
      toast.error('保存公告失败');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  // Admin authentication is now handled entirely server-side
  // The checkAdminRole function verifies admin status via user_roles table on page load

  const fetchStats = async () => {
    try {
      // 使用edge function来获取统计，绕过RLS限制
      const { data, error } = await supabase.functions.invoke('admin-stats', {
        body: { action: 'get_stats' }
      });
      
      if (error) {
        console.error('Error from edge function:', error);
        // Fallback to direct query (只能看到自己的数据)
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
        return;
      }
      
      if (data) {
        setStats({
          totalUsers: data.totalUsers || 0,
          totalCharacters: data.totalCharacters || 0,
          totalMessages: data.totalMessages || 0,
          todayUsers: data.todayUsers || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchTrendData = async () => {
    try {
      // 使用edge function来获取趋势数据，绕过RLS限制
      const { data, error } = await supabase.functions.invoke('admin-stats', {
        body: { action: 'get_trend' }
      });
      
      if (error) {
        console.error('Error from edge function:', error);
        // Fallback: 直接查询（数据可能不完整）
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const [usersRes, msgsRes] = await Promise.all([
          supabase.from('profiles')
            .select('created_at')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .limit(1000),
          supabase.from('chat_messages')
            .select('created_at')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .limit(1000),
        ]);
        
        const dateMap: Record<string, { users: number; messages: number }> = {};
        for (let i = 29; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          dateMap[dateStr] = { users: 0, messages: 0 };
        }
        
        (usersRes.data || []).forEach(item => {
          const date = item.created_at.split('T')[0];
          if (dateMap[date]) dateMap[date].users++;
        });
        
        (msgsRes.data || []).forEach(item => {
          const date = item.created_at.split('T')[0];
          if (dateMap[date]) dateMap[date].messages++;
        });
        
        const trend = Object.entries(dateMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, data]) => ({
            date: date.slice(5),
            users: data.users,
            messages: data.messages,
          }));
        
        setTrendData(trend);
        return;
      }
      
      if (data?.trend) {
        setTrendData(data.trend);
      }
    } catch (err) {
      console.error('Error fetching trend data:', err);
    }
  };

  // 获取活跃用户趋势
  const fetchActivityTrend = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-stats', {
        body: { action: 'get_active_users_trend' }
      });
      
      if (error) {
        console.error('Error fetching activity trend:', error);
        return;
      }
      
      if (data?.trend) {
        setActivityTrend(data.trend);
        setWeeklyActiveUsers(data.weeklyActiveUsers || 0);
        setTodayActiveUsers(data.todayActiveUsers || 0);
      }
    } catch (err) {
      console.error('Error fetching activity trend:', err);
    }
  };


  // 获取所有用户（包含邮箱）
  const fetchAdminUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'get_users' }
      });
      
      if (error) {
        console.error('Error fetching admin users:', error);
        toast.error('获取用户列表失败');
        return;
      }
      
      setAdminUsers(data?.users || []);
    } catch (err) {
      console.error('Error fetching admin users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 获取不活跃用户
  const fetchInactiveUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'get_inactive_users', inactiveMonths: parseInt(inactiveMonths) }
      });
      
      if (error) {
        console.error('Error fetching inactive users:', error);
        toast.error('获取不活跃用户失败');
        return;
      }
      
      setInactiveUsers(data?.users || []);
      toast.success(`找到 ${data?.users?.length || 0} 个超过 ${inactiveMonths} 个月未活跃的用户`);
    } catch (err) {
      console.error('Error fetching inactive users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 清理单个用户数据
  const cleanupUserData = async (userId: string) => {
    setCleaningUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'cleanup_user_data', userId }
      });
      
      if (error) {
        console.error('Error cleaning up user:', error);
        toast.error('清理用户数据失败');
        return;
      }
      
      toast.success('用户数据已清理');
      fetchAdminUsers();
      fetchInactiveUsers();
    } catch (err) {
      console.error('Error cleaning up user:', err);
    } finally {
      setCleaningUp(false);
    }
  };

  // 重置用户密码
  const resetUserPassword = async () => {
    if (!resetPasswordUserId || !newPassword) {
      toast.error('请输入新密码');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('密码至少需要6个字符');
      return;
    }
    
    setResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'reset_password', userId: resetPasswordUserId, newPassword }
      });
      
      if (error) {
        console.error('Error resetting password:', error);
        toast.error('重置密码失败');
        return;
      }
      
      toast.success('密码已重置');
      setResetPasswordUserId(null);
      setNewPassword('');
    } catch (err) {
      console.error('Error resetting password:', err);
      toast.error('重置密码失败');
    } finally {
      setResettingPassword(false);
    }
  };

  const batchCleanupInactiveUsers = async () => {
    if (inactiveUsers.length === 0) {
      toast.error('没有需要清理的用户');
      return;
    }
    
    setCleaningUp(true);
    try {
      const userIds = inactiveUsers.map(u => u.id);
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'batch_cleanup', userIds }
      });
      
      if (error) {
        console.error('Error batch cleanup:', error);
        toast.error('批量清理失败');
        return;
      }
      
      toast.success(`已清理 ${data?.cleanedCount || 0} 个用户的数据`);
      setInactiveUsers([]);
      fetchAdminUsers();
    } catch (err) {
      console.error('Error batch cleanup:', err);
    } finally {
      setCleaningUp(false);
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
          className="w-full max-w-sm text-center"
        >
          <Shield className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold">访问被拒绝</h1>
          <p className="text-muted-foreground mt-2 mb-6">
            您没有管理员权限。如需管理员访问权限，请联系现有管理员。
          </p>
          <Button variant="ghost" className="w-full" onClick={() => navigate(-1)}>
            返回
          </Button>
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

        {/* 公告管理 */}
        <Card className="border-purple-500/30 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-900/20 dark:to-pink-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <Megaphone className="w-5 h-5" />
              公告管理
            </CardTitle>
            <CardDescription>
              编辑登录后弹出的公告内容（用户关闭后不再显示）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="announcement-title">公告标题</Label>
              <Input
                id="announcement-title"
                placeholder="例如：梦境小手机交流群"
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="announcement-content">公告内容</Label>
              <Textarea
                id="announcement-content"
                placeholder="公告正文内容..."
                value={announcementForm.content}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="announcement-wechat">微信号（可点击复制）</Label>
              <Input
                id="announcement-wechat"
                placeholder="例如：XxyLxs9201314"
                value={announcementForm.wechat_id}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, wechat_id: e.target.value }))}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={announcementForm.is_active}
                  onCheckedChange={(checked) => setAnnouncementForm(prev => ({ ...prev, is_active: checked }))}
                />
                <Label>启用公告</Label>
              </div>
              
              <Button 
                onClick={saveAnnouncement}
                disabled={savingAnnouncement || !announcementForm.title}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {savingAnnouncement ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                保存公告
              </Button>
            </div>
            
            {announcement && (
              <p className="text-xs text-muted-foreground">
                上次更新: {new Date(announcement.id ? (announcement as any).updated_at || (announcement as any).created_at : Date.now()).toLocaleString('zh-CN')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 邀请码管理 */}
        <InviteCodeManager />

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

          </CardContent>
        </Card>

        {/* 用户活跃度图表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              用户活跃度（近30天）
            </CardTitle>
            <CardDescription>
              基于每日发送消息的唯一用户数统计
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 活跃度统计卡片 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">今日活跃</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">{todayActiveUsers}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">周活跃用户</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{weeklyActiveUsers}</p>
              </div>
            </div>

            {/* 每日活跃用户趋势 */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-500" />
                每日活跃用户 (DAU)
              </h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityTrend}>
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
                    <Bar dataKey="activeUsers" fill="hsl(24.6 95% 53.1%)" name="活跃用户" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 每日会话数趋势 */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                每日用户发送消息数
              </h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityTrend}>
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
                      dataKey="totalSessions" 
                      stroke="hsl(152 76.1% 36.5%)" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(152 76.1% 36.5%)', strokeWidth: 0, r: 3 }}
                      name="用户消息数"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 数据清理政策说明 */}
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              数据管理政策
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-800 dark:text-amber-300 space-y-2">
            <p>📌 <strong>数据保留政策：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>超过 <strong>6个月</strong> 未使用的账号数据将被清理</li>
              <li>清理后，用户仍可使用相同邮箱重新注册</li>
              <li>清理的数据包括：聊天记录、角色、照片、音乐等</li>
              <li>账号本身不会被删除，仅清理用户数据</li>
            </ul>
            <p className="mt-3 text-xs opacity-80">💡 此政策类似 Telegram 的账号不活跃清理机制，旨在节省存储空间和保护用户隐私。</p>
          </CardContent>
        </Card>

        {/* 用户管理（按活跃度排序 + 搜索） */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                用户活跃度排行
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchAdminUsers}
                disabled={loadingUsers}
              >
                {loadingUsers ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                刷新
              </Button>
            </CardTitle>
            <CardDescription>
              按消息数量排序，显示用户活跃度（自动加载）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户昵称或邮箱..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {adminUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {loadingUsers ? '加载中...' : '暂无用户数据'}
              </p>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {adminUsers
                    .filter(user => {
                      if (!userSearchQuery) return true;
                      const query = userSearchQuery.toLowerCase();
                      return (
                        (user.nickname?.toLowerCase().includes(query)) ||
                        (user.email?.toLowerCase().includes(query))
                      );
                    })
                    .map((user, index) => (
                    <div 
                      key={user.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex flex-col items-center w-8">
                        <span className={`text-xs font-bold ${index < 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                          {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                        </span>
                      </div>
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
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
                          {user.nickname || user.email || '未知用户'}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email || '无邮箱'}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-sm font-bold text-primary flex items-center gap-1 justify-end">
                          <MessageCircle className="w-3 h-3" />
                          {user.message_count.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" />
                          {user.last_activity_at 
                            ? new Date(user.last_activity_at).toLocaleDateString('zh-CN')
                            : '从未'
                          }
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setResetPasswordUserId(user.id);
                          setNewPassword('');
                        }}
                        title="重置密码"
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* 密码重置弹窗 */}
        <AlertDialog open={!!resetPasswordUserId} onOpenChange={(open) => !open && setResetPasswordUserId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                重置用户密码
              </AlertDialogTitle>
              <AlertDialogDescription>
                为用户设置新密码（最少6个字符）
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="请输入新密码（至少6个字符）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-2"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setResetPasswordUserId(null);
                setNewPassword('');
              }}>
                取消
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={resetUserPassword}
                disabled={resettingPassword || newPassword.length < 6}
                className="bg-primary"
              >
                {resettingPassword ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                确认重置
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 不活跃用户清理 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              不活跃用户数据清理
            </CardTitle>
            <CardDescription>
              查找并清理长期未使用的用户数据（账号保留，仅清理数据）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Label>不活跃时间：</Label>
              <Select value={inactiveMonths} onValueChange={setInactiveMonths}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 个月</SelectItem>
                  <SelectItem value="6">6 个月</SelectItem>
                  <SelectItem value="12">12 个月</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={fetchInactiveUsers}
                disabled={loadingUsers}
              >
                {loadingUsers ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                查找不活跃用户
              </Button>
            </div>

            {inactiveUsers.length > 0 && (
              <>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm text-destructive font-medium">
                    找到 {inactiveUsers.length} 个超过 {inactiveMonths} 个月未活跃的用户
                  </p>
                </div>

                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {inactiveUsers.map((user) => (
                      <div 
                        key={user.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-destructive" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{user.email || '无邮箱'}</p>
                          <p className="text-xs text-muted-foreground">
                            最后活跃: {user.last_activity_at 
                              ? new Date(user.last_activity_at).toLocaleDateString('zh-CN')
                              : user.last_sign_in_at 
                                ? new Date(user.last_sign_in_at).toLocaleDateString('zh-CN')
                                : '从未'
                            }
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认清理用户数据</AlertDialogTitle>
                              <AlertDialogDescription>
                                将清理该用户的所有数据（聊天记录、角色、照片等），但保留账号。用户仍可重新登录使用。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => cleanupUserData(user.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                确认清理
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full" disabled={cleaningUp}>
                      {cleaningUp ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      批量清理所有 {inactiveUsers.length} 个不活跃用户数据
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认批量清理</AlertDialogTitle>
                      <AlertDialogDescription>
                        将清理 {inactiveUsers.length} 个用户的所有数据。此操作不可撤销，但用户账号会保留，仍可重新登录使用。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={batchCleanupInactiveUsers}
                        className="bg-destructive text-destructive-foreground"
                      >
                        确认批量清理
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </CardContent>
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
