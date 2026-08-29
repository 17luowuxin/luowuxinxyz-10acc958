import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, Download, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  createLocalBackup,
  downloadLocalBackup,
  isLocalModeEnabled,
  setLocalModeEnabled,
} from '@/lib/localDataStore';
import { syncLocalDataToCloud } from '@/utils/localToCloudMigration';

const ForcedCloudMigrationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const [ready, setReady] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const migrate = useCallback(async () => {
    if (!user?.id) return;
    setMigrating(true);
    setError('');
    try {
      const usesLocalData = await isLocalModeEnabled(user.id);
      if (!usesLocalData) {
        setReady(true);
        return;
      }
      await syncLocalDataToCloud(user.id, (label, current, total) => {
        setProgress(`${label}（${current}/${total}）`);
      });
      await setLocalModeEnabled(user.id, false);
      setReady(true);
    } catch (migrationError) {
      setError(migrationError instanceof Error ? migrationError.message : '同步失败，请检查网络后重试');
    } finally {
      setMigrating(false);
      setProgress('');
    }
  }, [user?.id]);

  useEffect(() => {
    setReady(false);
    setError('');
    if (!loading && user?.id) void migrate();
  }, [loading, migrate, user?.id]);

  const downloadBackup = async () => {
    if (!user?.id) return;
    try {
      downloadLocalBackup(await createLocalBackup(user.id));
    } catch {
      setError('备用文件导出失败，请勿清除浏览器数据');
    }
  };

  if (!loading && !user) return <>{children}</>;
  if (ready) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-pink-50 p-5 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-3xl border border-purple-100 bg-white/90 p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100">
          <Cloud className="h-7 w-7 text-purple-600" />
        </div>
        <h1 className="text-lg font-bold text-gray-800">正在恢复云端保存</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          正在把这台设备上的聊天、角色、图片和其他数据安全同步到云端，请保持网络连接。
        </p>

        {!error && (
          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-purple-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress || (loading ? '正在确认登录状态' : '正在检查本机数据')}
          </div>
        )}

        {error && (
          <div className="mt-5 space-y-3">
            <p className="rounded-xl bg-red-50 px-3 py-2 text-left text-xs leading-relaxed text-red-600">
              暂未切换云端：{error}。本机原数据仍完整保留。
            </p>
            <Button className="w-full rounded-xl" onClick={() => void migrate()} disabled={migrating}>
              {migrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              重新同步
            </Button>
            <Button variant="outline" className="w-full rounded-xl" onClick={() => void downloadBackup()} disabled={migrating}>
              <Download className="mr-2 h-4 w-4" />
              先下载备用文件
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForcedCloudMigrationGate;
