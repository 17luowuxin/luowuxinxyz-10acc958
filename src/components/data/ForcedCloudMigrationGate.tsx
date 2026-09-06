import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const UserCloudMigrationGate: React.FC<{ children: React.ReactNode; userId: string }> = ({ children, userId }) => {
  const [ready, setReady] = useState(false);
  const [usesLocalData, setUsesLocalData] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const runningRef = useRef(false);
  const activeRef = useRef(true);

  const migrate = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setMigrating(true);
    setError('');
    try {
      const local = await isLocalModeEnabled(userId);
      if (!activeRef.current) return;
      setUsesLocalData(local);
      if (!local) {
        setReady(true);
        return;
      }
      setProgress('正在整理本机数据');
      await syncLocalDataToCloud(userId, (label, current, total) => {
        if (activeRef.current) setProgress(`${label}（${current}/${total}）`);
      });
      if (!activeRef.current) return;
      await setLocalModeEnabled(userId, false);
      setReady(true);
    } catch (migrationError) {
      if (activeRef.current) setError(migrationError instanceof Error ? migrationError.message : '同步失败，请检查网络后重试');
    } finally {
      runningRef.current = false;
      if (activeRef.current) {
        setMigrating(false);
        setProgress('');
      }
    }
  }, [userId]);

  useEffect(() => {
    activeRef.current = true;
    void migrate();
    return () => { activeRef.current = false; };
  }, [migrate]);

  const downloadBackup = async () => {
    try {
      downloadLocalBackup(await createLocalBackup(userId));
    } catch {
      setError('备用文件导出失败，请勿清除浏览器数据');
    }
  };

  if (ready) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-pink-50 p-5 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-3xl border border-purple-100 bg-white/90 p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100">
          <Cloud className="h-7 w-7 text-purple-600" />
        </div>
        <h1 className="text-lg font-bold text-gray-800">{usesLocalData ? '正在恢复云端保存' : '正在打开小手机'}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          {usesLocalData ? '正在把这台设备上的聊天、角色、图片和其他数据同步到云端，请保持网络连接。' : '正在检查数据保存方式。'}
        </p>

        {!error && (
          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-purple-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress || '正在检查本机数据'}
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

const ForcedCloudMigrationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, authError, retryAuth, authSource } = useAuth();
  if (loading || authError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          {loading ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />正在确认登录状态
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{authError}</p>
              <Button onClick={retryAuth} className="rounded-xl"><RefreshCw className="mr-2 h-4 w-4" />重新连接</Button>
            </>
          )}
        </div>
      </div>
    );
  }
  if (!user) return <>{children}</>;
  return <UserCloudMigrationGate key={`${authSource}:${user.id}`} userId={user.id}>{children}</UserCloudMigrationGate>;
};

export default ForcedCloudMigrationGate;
