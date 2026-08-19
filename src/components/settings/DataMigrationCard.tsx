import React, { useEffect, useRef, useState } from 'react';
import { CloudDownload, Download, HardDrive, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { copyCloudDataToLocal } from '@/utils/cloudToLocalMigration';
import {
  createLocalBackup,
  downloadLocalBackup,
  importLocalBackup,
  isLocalModeEnabled,
  LocalBackupPackage,
  requestPersistentLocalStorage,
  setLocalModeEnabled,
} from '@/lib/localDataStore';

const DataMigrationCard: React.FC = () => {
  const { user } = useAuth();
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [copying, setCopying] = useState(false);
  const [progress, setProgress] = useState('');
  const [localReady, setLocalReady] = useState(false);
  const [localMode, setLocalMode] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLocalReady(false);
      setLocalMode(null);
      return;
    }

    Promise.all([isLocalModeEnabled(user.id), createLocalBackup(user.id)])
      .then(([enabled, backup]) => {
        const recordCount = Object.values(backup.tables).reduce((sum, rows) => sum + rows.length, 0);
        setLocalMode(enabled);
        setLocalReady(recordCount > 0);
      })
      .catch(() => {
        setLocalMode(false);
        setLocalReady(false);
      });
  }, [user?.id]);

  const handleSafeCloudCopy = async () => {
    if (!user || copying || localMode !== false) return;
    setCopying(true);
    setProgress('正在准备本机数据库...');
    try {
      const result = await copyCloudDataToLocal(user.id, (table, current, total) => {
        setProgress(`正在复制 ${table}（${current}/${total}）`);
      });
      setLocalReady(true);
      if (result.warnings.length > 0) {
        toast.warning(`已复制 ${result.copiedRecords} 条记录和 ${result.copiedAssets} 个文件；有 ${result.warnings.length} 个网络文件未复制，云端原数据仍完整保留`, { duration: 10000 });
      } else {
        toast.success(`已安全复制 ${result.copiedRecords} 条记录和 ${result.copiedAssets} 个文件，云端原数据未改动`);
      }
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
    await requestPersistentLocalStorage();
    setLocalMode(true);
    toast.success('已启用本机保存，正在重新载入');
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
      if (!window.confirm('导入会替换这台设备上的现有数据，确认继续吗？')) return;
      const parsed = JSON.parse(await file.text()) as LocalBackupPackage;
      const result = await importLocalBackup(user.id, parsed);
      await setLocalModeEnabled(user.id, true);
      await requestPersistentLocalStorage();
      setLocalReady(true);
      setLocalMode(true);
      toast.success(`已导入 ${result.records} 条数据和 ${result.assets} 个文件，正在使用本机数据`);
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
    </div>
  );
};

export default DataMigrationCard;
