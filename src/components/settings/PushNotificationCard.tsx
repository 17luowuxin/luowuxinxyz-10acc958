import React from 'react';
import { Bell, BellOff, Loader2, Check, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

export const PushNotificationCard: React.FC = () => {
  const { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast.success('已关闭消息推送');
      } else {
        toast.error('关闭推送失败');
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast.success('已开启消息推送', {
          description: '当角色回复时，你将收到通知'
        });
      } else if (permission === 'denied') {
        toast.error('推送权限被拒绝', {
          description: '请在浏览器设置中允许通知权限'
        });
      } else {
        toast.error('开启推送失败');
      }
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-gray-100/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <BellOff className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h2 className="font-bold text-gray-500">消息推送</h2>
            <p className="text-xs text-gray-400">
              你的浏览器不支持推送通知
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-blue-100/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isSubscribed 
              ? 'bg-gradient-to-br from-blue-100 to-purple-100' 
              : 'bg-gradient-to-br from-gray-100 to-gray-200'
          }`}>
            {isSubscribed ? (
              <Bell className="w-5 h-5 text-blue-500" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div>
            <h2 className="font-bold text-gray-800">消息推送通知</h2>
            <p className="text-xs text-gray-500">
              {isSubscribed 
                ? '角色回复时会收到手机通知' 
                : '开启后可在后台收到角色回复通知'}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
            isSubscribed 
              ? 'bg-gradient-to-r from-blue-400 to-purple-400' 
              : 'bg-gray-300'
          } ${loading ? 'opacity-70' : ''}`}
        >
          <span 
            className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 flex items-center justify-center ${
              isSubscribed ? 'translate-x-6' : 'translate-x-0'
            }`}
          >
            {loading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
          </span>
        </button>
      </div>

      {permission === 'denied' && (
        <div className="mt-3 flex items-center gap-2 text-xs text-orange-600 bg-orange-50 rounded-xl p-3">
          <AlertCircle className="w-4 h-4" />
          <span>通知权限被拒绝，请在浏览器设置中允许</span>
        </div>
      )}

      {isSubscribed && (
        <div className="mt-3 flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-xl p-3">
          <Check className="w-4 h-4" />
          <span>推送已开启 - 需要将网站添加到主屏幕以获得最佳体验</span>
        </div>
      )}
    </div>
  );
};

export default PushNotificationCard;
