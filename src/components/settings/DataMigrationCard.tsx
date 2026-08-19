import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CloudDownload, Download, HardDrive, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { copyCloudDataToLocal } from '@/utils/cloudToLocalMigration';
import {
  createLocalBackup,
  countLocalRecords,
  downloadLocalBackup,
  getLocalMeta,
  getLocalStorageStatus,
  importLocalBackup,
  isLocalModeEnabled,
  LocalBackupPackage,
  requestPersistentLocalStorage,
  setLocalModeEnabled,
} from '@/lib/localDataStore';

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(0, bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const DataMigrationCard: React.FC = () => {
  const { user } = useAuth();
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [copying, setCopying] = useState(false);
  const [progress, setProgress] = useState('');
  const [localReady, setLocalReady] = useState(false);
  const [localMode, setLocalMode] = useState<boolean | null>(null);
  const [storageStatus, setStorageStatus] = useState<Awaited<ReturnType<typeof getLocalStorageStatus>>>(null);

  const refreshStorageStatus = useCallback(async () => {
    setStorageStatus(await getLocalStorageStatus());
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLocalReady(false);
      setLocalMode(null);
      return;
    }

    Promise.all([
      isLocalModeEnabled(user.id),
      countLocalRecords(user.id),
      getLocalMeta<{ completed?: boolean }>(`cloud-copy:${user.id}`),
    ])
      .then(([enabled, recordCount, cloudCopy]) => {
        setLocalMode(enabled);
        setLocalReady(recordCount > 0 && (enabled || cloudCopy?.completed === true));
      })
      .catch(() => {
        setLocalMode(false);
        setLocalReady(false);
      });
    refreshStorageStatus();
  }, [refreshStorageStatus, user?.id]);

  const handleSafeCloudCopy = async () => {
    if (!user || copying || localMode !== false) return;
    setCopying(true);
    setLocalReady(false);
    setProgress('正在准备本机数据库...');
    try {
      const result = await copyCloudDataToLocal(user.id, (table, current, total) => {
        setProgress(`正在复制 ${table}（${current}/${total}）`);
      });
      setLocalReady(result.completed);
      if (result.warnings.length > 0) {
        toast.warning(`有 ${result.warnings.length} 项数据或文件未复制，请检查网络后重试；暂时不能切换，云端原数据仍完整保留`, { duration: 10000 });
      } else {
        toast.success(`已安全复制 ${result.copiedRecords} 条记录和 ${result.copiedAssets} 个文件，云端原数据未改动`);
      }
      await refreshStorageStatus();
    } catch (error) {
      toast.error(`复制中止：${error instanceof Error ? error.message : '未知错误'}。云端原数据未改动`, { duration: 10000 });
    } finally {
      setCopying(false);
      setProgress('');
    }
  };

  const handleEnableLocalMode = async () => {
    if (!user || !localReady || localMode) return;
    if (!window.confirm('确认开始使用本机数据？云端旧数据会保留，不会删除。')) return;
    await setLocalModeEnabled(user.id, true);
    const persisted = await requestPersistentLocalStorage();
    setLocalMode(true);
    toast.success(persisted ? '已启用本机保存，正在重新载入' : '已启用本机保存，请记得定期导出备份');
    setTimeout(() => window.location.reload(), 500);
  };

  const handleExport = async () => {
    if (!user) return;
    try {
      const backup = await createLocalBackup(user.id);
      const recordCount = Object.values(backup.tables).reduce((sum, rows) => sum + rows.length, 0);
      if (recordCount === 0) {
        toast.error('本机还没有可导出的数据');
        return;
      }
      downloadLocalBackup(backup);
      toast.success(`备份已导出，共 ${recordCount} 条记录和 ${backup.assets.length} 个文件`);
    } catch (error) {
      toast.error(`导出失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    try {
      const currentStorage = await getLocalStorageStatus();
      const available = currentStorage?.quota ? currentStorage.quota - currentStorage.usage : null;
      if (available !== null && file.size > available) {
        toast.error(`本机空间不足：备份约 ${formatBytes(file.size)}，当前剩余约 ${formatBytes(available)}`);
        return;
      }
      if (!window.confirm('导入会替换这台设备上的现有数据，确认继续吗？')) return;
      const parsed = JSON.parse(await file.text()) as LocalBackupPackage;
      const result = await importLocalBackup(user.id, parsed);
      await setLocalModeEnabled(user.id, true);
      const persisted = await requestPersistentLocalStorage();
      setLocalReady(true);
      setLocalMode(true);
      toast.success(`已导入 ${result.records} 条数据和 ${result.assets} 个文件${persisted ? '' : '，请定期导出备份'}`);
      await refreshStorageStatus();
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      toast.error(`导入失败：${error instanceof Error ? error.message : '备份文件无效'}`);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 space-y-3 border border-emerald-100">
      <div className="flex items-start gap-2">
        <HardDrive className="w-4 h-4 text-emerald-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">本机数据与备份</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {localMode ? '聊天、角色和个人资料只保存在这台设备。' : '先安全复制现有数据，确认后再切换到本机保存。'}
          </p>
        </div>
        {(localReady || localMode) && <ShieldCheck className="w-5 h-5 text-emerald-500" aria-label="本机数据已准备" />}
      </div>

      {localMode === null && <p className="text-xs text-muted-foreground text-center">正在检查本机数据...</p>}

      {localMode === false && (
        <>
          <Button variant="outline" size="sm" className="w-full rounded-xl border-emerald-200 text-emerald-700" onClick={handleSafeCloudCopy} disabled={copying}>
            {copying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CloudDownload className="w-4 h-4 mr-1" />}
            {copying ? '正在安全复制...' : '1. 复制现有数据到本机'}
          </Button>
          {progress && <p className="text-xs text-emerald-700 text-center">{progress}</p>}
          <Button size="sm" className="w-full rounded-xl" onClick={handleEnableLocalMode} disabled={!localReady || copying}>
            2. 开始使用本机数据
          </Button>
        </>
      )}

      {localMode === true && (
        <p className="text-xs text-emerald-700 bg-emerald-50/80 rounded-lg px-2 py-1.5">当前已启用本机保存。云端旧记录没有删除，也不会再被更新。</p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" />
          一键导出
        </Button>
        <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => backupInputRef.current?.click()}>
          <Upload className="w-4 h-4 mr-1" />
          一键导入
        </Button>
      </div>
      <input ref={backupInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
      <p className="text-[11px] text-amber-700 bg-amber-50/80 rounded-lg px-2 py-1.5">卸载浏览器或清除网站数据前，请先导出备份；备份内含 API 密钥，请妥善保管。</p>
      {storageStatus && storageStatus.quota > 0 && (
        <p className="text-[11px] text-muted-foreground text-center">
          本站本机空间：已用 {formatBytes(storageStatus.usage)} / 上限约 {formatBytes(storageStatus.quota)}
          {storageStatus.persisted ? '（已持久保存）' : '（请定期备份）'}
        </p>
      )}
    </div>
  );
};

export default DataMigrationCard;
