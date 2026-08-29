import React, { useEffect, useRef, useState } from 'react';
import { Download, HardDrive, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  createLocalBackup,
  downloadLocalBackup,
  getLocalStorageStatus,
  importLocalBackup,
  isLocalModeEnabled,
  LocalBackupPackage,
  setLocalModeEnabled,
} from '@/lib/localDataStore';
import { syncLocalDataToCloud } from '@/utils/localToCloudMigration';

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(0, bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const DataMigrationCard: React.FC = () => {
  const { user } = useAuth();
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [localMode, setLocalMode] = useState<boolean | null>(null);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  useEffect(() => {
    if (!user?.id) {
      setLocalMode(null);
      return;
    }

    isLocalModeEnabled(user.id)
      .then(setLocalMode)
      .catch(() => setLocalMode(false));
  }, [user?.id]);

  const exportPreparedBackup = async () => {
    if (!user) return;
    const backup = await createLocalBackup(user.id);
    const recordCount = Object.values(backup.tables).reduce((sum, rows) => sum + rows.length, 0);
    if (recordCount === 0) throw new Error('没有可导出的数据');
    downloadLocalBackup(backup);
    return { recordCount, assetCount: backup.assets.length };
  };

  const handleExport = async () => {
    if (!user || localMode === null || exporting) return;
    setExporting(true);
    try {
      const exported = await exportPreparedBackup();
      toast.success(`完整备份已保存到下载文件夹，共 ${exported.recordCount} 条记录和 ${exported.assetCount} 个文件`);
    } catch (error) {
      toast.error(`导出失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !localMode) return;
    try {
      const currentStorage = await getLocalStorageStatus();
      const available = currentStorage?.quota ? currentStorage.quota - currentStorage.usage : null;
      if (available !== null && file.size > available) {
        toast.error(`本机空间不足：备份约 ${formatBytes(file.size)}，当前剩余约 ${formatBytes(available)}`);
        return;
      }
      if (!window.confirm('导入会替换这台设备上的现有本机数据，确认继续吗？')) return;
      const parsed = JSON.parse(await file.text()) as LocalBackupPackage;
      const result = await importLocalBackup(user.id, parsed);
      toast.success(`已导入 ${result.records} 条数据和 ${result.assets} 个文件`);
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      toast.error(`导入失败：${error instanceof Error ? error.message : '备份文件无效'}`);
    } finally {
      event.target.value = '';
    }
  };

  const handleReturnToCloud = async () => {
    if (!user || syncing || exporting) return;
    if (!window.confirm('确认把这台设备的本机数据同步到云端，并改回云端保存吗？同步失败时仍会保持本机模式。')) return;
    setSyncing(true);
    try {
      const result = await syncLocalDataToCloud(user.id, (label, current, total) => {
        setSyncProgress(`${label}（${current}/${total}）`);
      });
      await setLocalModeEnabled(user.id, false);
      toast.success(`已切回云端，共同步 ${result.records} 条数据和 ${result.files} 个文件`);
      setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      toast.error(`暂未切换：${error instanceof Error ? error.message : '同步失败'}`, { duration: 8000 });
    } finally {
      setSyncing(false);
      setSyncProgress('');
    }
  };

  if (localMode !== true) return null;

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 space-y-3 border border-emerald-100">
      <div className="flex items-start gap-2">
        <HardDrive className="w-4 h-4 text-amber-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">本机数据保护</h3>
          <p className="text-xs text-muted-foreground mt-1">
            这台设备以前已启用本机保存，将继续使用本机数据，不会影响现有记录。
          </p>
        </div>
      </div>
      <p className="text-xs text-amber-700 bg-amber-50/80 rounded-lg px-2 py-1.5">
        请先导出一份备用文件，再把本机数据同步回云端。
      </p>
      <Button className="w-full rounded-xl" onClick={handleReturnToCloud} disabled={syncing || exporting}>
        {syncing && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
        {syncing ? '正在同步到云端' : '同步到云端并切换'}
      </Button>
      {syncProgress && <p className="text-xs text-center text-emerald-700">{syncProgress}</p>}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={handleExport} disabled={exporting || syncing}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
          {exporting ? '导出中' : '一键导出'}
        </Button>
        <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => backupInputRef.current?.click()} disabled={syncing}>
          <Upload className="w-4 h-4 mr-1" />
          一键导入
        </Button>
      </div>
      <input ref={backupInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
      <p className="text-[11px] text-amber-700 bg-amber-50/80 rounded-lg px-2 py-1.5">
        卸载浏览器或清除网站数据前，请先导出备份；备份内含 API 密钥，请妥善保管。
      </p>
    </div>
  );
};

export default DataMigrationCard;
