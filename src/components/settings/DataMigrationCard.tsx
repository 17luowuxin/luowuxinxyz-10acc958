import React, { useEffect, useRef, useState } from 'react';
import { Cloud, Download, HardDrive, ShieldCheck, Upload } from 'lucide-react';
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
} from '@/lib/localDataStore';

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(0, bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const DataMigrationCard: React.FC = () => {
  const { user } = useAuth();
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [localMode, setLocalMode] = useState<boolean | null>(null);
  const [storageStatus, setStorageStatus] = useState<Awaited<ReturnType<typeof getLocalStorageStatus>>>(null);

  useEffect(() => {
    if (!user?.id) {
      setLocalMode(null);
      return;
    }

    isLocalModeEnabled(user.id)
      .then(async (enabled) => {
        setLocalMode(enabled);
        if (enabled) setStorageStatus(await getLocalStorageStatus());
      })
      .catch(() => setLocalMode(false));
  }, [user?.id]);

  const handleExport = async () => {
    if (!user || !localMode) return;
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
      setStorageStatus(await getLocalStorageStatus());
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
        {localMode ? (
          <HardDrive className="w-4 h-4 text-amber-600 mt-0.5" />
        ) : (
          <Cloud className="w-4 h-4 text-emerald-600 mt-0.5" />
        )}
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{localMode ? '本机数据保护' : '云端数据保存'}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {localMode
              ? '这台设备以前已启用本机保存。为避免丢失本机新增记录，系统不会强制切回云端。'
              : '当前继续使用原来的云端保存，不会切换到本机。'}
          </p>
        </div>
        {localMode !== null && <ShieldCheck className="w-5 h-5 text-emerald-500" aria-label="数据模式已确认" />}
      </div>

      {localMode === null && <p className="text-xs text-muted-foreground text-center">正在检查数据保存方式...</p>}

      {localMode === false && (
        <p className="text-xs text-emerald-700 bg-emerald-50/80 rounded-lg px-2 py-1.5">
          已恢复保守方案：继续读取和保存云端数据。
        </p>
      )}

      {localMode === true && (
        <>
          <p className="text-xs text-amber-700 bg-amber-50/80 rounded-lg px-2 py-1.5">
            请先导出备份，再联系客服确认如何安全迁回云端。
          </p>
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
          <p className="text-[11px] text-amber-700 bg-amber-50/80 rounded-lg px-2 py-1.5">
            卸载浏览器或清除网站数据前，请先导出备份；备份内含 API 密钥，请妥善保管。
          </p>
          {storageStatus && storageStatus.quota > 0 && (
            <p className="text-[11px] text-muted-foreground text-center">
              本站本机空间：已用 {formatBytes(storageStatus.usage)} / 上限约 {formatBytes(storageStatus.quota)}
              {storageStatus.persisted ? '（已持久保存）' : '（请定期备份）'}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default DataMigrationCard;
