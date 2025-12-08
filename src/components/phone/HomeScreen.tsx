import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Image,
  User,
  Settings,
  Palette,
  Users,
  Globe,
  Gamepad2,
  MessageCircle,
  Music,
  Mail,
  Camera,
} from 'lucide-react';

const apps = [
  { id: 'album', name: '相册', icon: Image, color: 'from-candy-blue to-candy-mint', route: '/album' },
  { id: 'profile', name: '我的', icon: User, color: 'from-candy-pink to-candy-purple', route: '/profile' },
  { id: 'settings', name: '设置', icon: Settings, color: 'from-gray-400 to-gray-600', route: '/settings' },
  { id: 'customize', name: '美化', icon: Palette, color: 'from-candy-purple to-candy-blue', route: '/customize' },
  { id: 'friends', name: '好友', icon: Users, color: 'from-candy-orange to-candy-pink', route: '/friends' },
  { id: 'space', name: '空间', icon: Globe, color: 'from-candy-yellow to-candy-orange', route: '/space' },
  { id: 'games', name: '游戏', icon: Gamepad2, color: 'from-candy-mint to-candy-blue', route: '/games' },
  { id: 'group', name: '群聊', icon: MessageCircle, color: 'from-candy-pink to-candy-orange', route: '/group' },
  { id: 'music', name: '音乐', icon: Music, color: 'from-candy-purple to-candy-pink', route: '/music' },
  { id: 'bottle', name: '漂流瓶', icon: Mail, color: 'from-candy-blue to-candy-purple', route: '/bottle' },
  { id: 'camera', name: '相机', icon: Camera, color: 'from-gray-700 to-gray-900', route: '/camera' },
];

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    show: { opacity: 1, scale: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background p-6 pt-12">
      {/* Status bar placeholder */}
      <div className="flex justify-between items-center mb-8 px-2">
        <span className="text-sm font-medium text-muted-foreground">
          {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-2 bg-muted-foreground/50 rounded-sm" />
          <div className="w-6 h-3 bg-candy-mint rounded-sm" />
        </div>
      </div>

      {/* App grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 gap-6"
      >
        {apps.map((app) => (
          <motion.button
            key={app.id}
            variants={itemVariants}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(app.route)}
            className="flex flex-col items-center gap-2"
          >
            <div className={`app-icon bg-gradient-to-br ${app.color}`}>
              <app.icon className="w-7 h-7 text-white" />
            </div>
            <span className="text-xs font-medium text-foreground/80">{app.name}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm">
        <div className="glass rounded-3xl px-6 py-4 flex justify-around items-center shadow-card">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/friends')}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-candy-orange to-candy-pink flex items-center justify-center shadow-soft">
              <Users className="w-6 h-6 text-white" />
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/album')}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-candy-blue to-candy-mint flex items-center justify-center shadow-soft">
              <Image className="w-6 h-6 text-white" />
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/music')}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-candy-purple to-candy-pink flex items-center justify-center shadow-soft">
              <Music className="w-6 h-6 text-white" />
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
